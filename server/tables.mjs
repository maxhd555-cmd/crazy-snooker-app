import { createDatabasePool } from "./db.mjs";

export const tableStatuses = ["available", "occupied", "reserved", "maintenance"];
const statusSet = new Set(tableStatuses);
let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("ระบบจัดเก็บสถานะโต๊ะยังไม่พร้อมใช้งาน");
    error.status = 503;
    throw error;
  }
  if (!pool) pool = createDatabasePool();
  return pool;
}

function errorWithStatus(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function parseExpectedEndAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw errorWithStatus("เวลาเล่นสิ้นสุดไม่ถูกต้อง", 400);
  return date;
}

export function mapTableRow(row) {
  return {
    id: row.id,
    label: row.label,
    status: row.status,
    customerName: row.customerName || "",
    expectedEndAt: row.expectedEndAt ? new Date(row.expectedEndAt).toISOString() : "",
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
  };
}

export function createTableRepository(database) {
  return {
    async list() {
      const [rows] = await database.execute("SELECT id, label, status, customer_name AS customerName, expected_end_at AS expectedEndAt, updated_at AS updatedAt FROM club_tables ORDER BY id");
      return rows.map(mapTableRow);
    },
    async find(id) {
      const [rows] = await database.execute("SELECT id, label, status, customer_name AS customerName, expected_end_at AS expectedEndAt, updated_at AS updatedAt FROM club_tables WHERE id = ? LIMIT 1", [id]);
      return rows[0] ? mapTableRow(rows[0]) : null;
    },
    async update(id, input = {}) {
      const existing = await this.find(id);
      if (!existing) throw errorWithStatus("ไม่พบโต๊ะ", 404);
      const status = String(input.status || existing.status);
      if (!statusSet.has(status)) throw errorWithStatus("สถานะโต๊ะไม่ถูกต้อง", 400);
      const customerName = status === "available" || status === "maintenance" ? null : String(input.customerName ?? existing.customerName ?? "").trim().slice(0, 100) || null;
      const expectedEndAt = status === "occupied" ? parseExpectedEndAt(input.expectedEndAt ?? existing.expectedEndAt) : null;
      await database.execute(
        "UPDATE club_tables SET status = ?, customer_name = ?, expected_end_at = ?, near_end_alerted_for = NULL, near_end_alerted_at = NULL WHERE id = ?",
        [status, customerName, expectedEndAt, id],
      );
      return this.find(id);
    },
    async findNearEndCandidates(windowMinutes) {
      const minutes = Math.max(1, Math.min(60, Number(windowMinutes) || 10));
      const [rows] = await database.execute(
        "SELECT id, label, customer_name AS customerName, expected_end_at AS expectedEndAt FROM club_tables WHERE status = 'occupied' AND expected_end_at IS NOT NULL AND expected_end_at >= UTC_TIMESTAMP() AND expected_end_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE) ORDER BY expected_end_at ASC",
        [minutes],
      );
      return rows.map((row) => ({ ...mapTableRow({ ...row, status: "occupied", updatedAt: new Date() }), remainingMinutes: Math.max(0, Math.ceil((new Date(row.expectedEndAt).getTime() - Date.now()) / 60000)) }));
    },
    async claimNearEndAlert(candidate) {
      const expectedEndAt = parseExpectedEndAt(candidate.expectedEndAt);
      await database.execute(
        "UPDATE near_end_alerts SET status = 'pending' WHERE status = 'sending' AND attempted_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)",
      );
      await database.execute(
        "INSERT IGNORE INTO near_end_alerts (table_id, expected_end_at, remaining_minutes, status) VALUES (?, ?, ?, 'pending')",
        [candidate.id, expectedEndAt, candidate.remainingMinutes],
      );
      const [claimed] = await database.execute(
        "UPDATE near_end_alerts SET status = 'sending', attempt_count = attempt_count + 1, attempted_at = UTC_TIMESTAMP(), last_error = NULL WHERE table_id = ? AND expected_end_at = ? AND status IN ('pending', 'failed')",
        [candidate.id, expectedEndAt],
      );
      return Boolean(claimed.affectedRows);
    },
    async markAlertDelivered(candidate) {
      const expectedEndAt = parseExpectedEndAt(candidate.expectedEndAt);
      await database.execute(
        "UPDATE near_end_alerts SET status = 'delivered', delivered_at = UTC_TIMESTAMP() WHERE table_id = ? AND expected_end_at = ?",
        [candidate.id, expectedEndAt],
      );
      await database.execute(
        "UPDATE club_tables SET near_end_alerted_for = ?, near_end_alerted_at = UTC_TIMESTAMP() WHERE id = ?",
        [expectedEndAt, candidate.id],
      );
    },
    async markAlertFailed(candidate, error) {
      const expectedEndAt = parseExpectedEndAt(candidate.expectedEndAt);
      await database.execute(
        "UPDATE near_end_alerts SET status = 'failed', last_error = ? WHERE table_id = ? AND expected_end_at = ?",
        [String(error?.message || error || "ส่งแจ้งเตือนไม่สำเร็จ").slice(0, 500), candidate.id, expectedEndAt],
      );
    },
  };
}

export async function listTables() { return createTableRepository(getPool()).list(); }
export async function updateTable(id, input) { return createTableRepository(getPool()).update(id, input); }

export async function getNearEndSchedulerConfig(taskUid) {
  const [rows] = await getPool().execute(
    "SELECT schedule_task_uid AS taskUid, alert_window_minutes AS alertWindowMinutes FROM near_end_scheduler_config WHERE schedule_task_uid = ? LIMIT 1",
    [taskUid],
  );
  return rows[0] || null;
}

export async function dispatchNearEndAlerts({ windowMinutes = 10, send } = {}) {
  if (typeof send !== "function") throw new Error("ต้องระบุตัวส่งการแจ้งเตือน");
  const repository = createTableRepository(getPool());
  const candidates = await repository.findNearEndCandidates(windowMinutes);
  const result = { checked: candidates.length, claimed: 0, delivered: 0, failed: 0 };
  for (const candidate of candidates) {
    if (!await repository.claimNearEndAlert(candidate)) continue;
    result.claimed += 1;
    try {
      await send(candidate);
      await repository.markAlertDelivered(candidate);
      result.delivered += 1;
    } catch (error) {
      await repository.markAlertFailed(candidate, error);
      result.failed += 1;
    }
  }
  return result;
}
