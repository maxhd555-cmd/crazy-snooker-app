import { createDatabasePool } from "./db.mjs";

const allowedCategories = new Set(["problem", "data", "suggestion"]);
export const feedbackStatuses = ["new", "in_progress", "resolved"];
const allowedStatuses = new Set(feedbackStatuses);
let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("ระบบจัดเก็บข้อเสนอแนะยังไม่พร้อมใช้งาน");
    error.status = 503;
    throw error;
  }
  if (!pool) pool = createDatabasePool();
  return pool;
}

export async function storeFeedback(input = {}) {
  const category = String(input.category || "").trim();
  const message = String(input.message || "").trim();
  const contact = String(input.contact || "").trim().slice(0, 320) || null;
  const currentView = String(input.currentView || "unknown").trim().slice(0, 64);
  if (!allowedCategories.has(category)) {
    const error = new Error("กรุณาเลือกประเภทข้อความ");
    error.status = 400;
    throw error;
  }
  if (message.length < 10 || message.length > 2000) {
    const error = new Error("โปรดอธิบายรายละเอียดระหว่าง 10–2,000 ตัวอักษร");
    error.status = 400;
    throw error;
  }
  const [result] = await getPool().execute(
    "INSERT INTO feedback_reports (category, message, contact, current_view) VALUES (?, ?, ?, ?)",
    [category, message, contact, currentView],
  );
  return { id: result.insertId, status: "new" };
}

export function isFeedbackStatus(value) { return allowedStatuses.has(String(value || "")); }

export function buildFeedbackFilters(filters = {}) {
  const category = String(filters.category || "").trim();
  const status = String(filters.status || "").trim();
  if (category && !allowedCategories.has(category)) {
    const error = new Error("ประเภทข้อความไม่ถูกต้อง"); error.status = 400; throw error;
  }
  if (status && !isFeedbackStatus(status)) {
    const error = new Error("สถานะไม่ถูกต้อง"); error.status = 400; throw error;
  }
  const conditions = [];
  const values = [];
  if (category) { conditions.push("category = ?"); values.push(category); }
  if (status) { conditions.push("status = ?"); values.push(status); }
  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", values };
}

function feedbackIdOrThrow(id) {
  const reportId = Number(id);
  if (!Number.isSafeInteger(reportId) || reportId <= 0) {
    const error = new Error("เลขอ้างอิงรายงานไม่ถูกต้อง"); error.status = 400; throw error;
  }
  return reportId;
}

export function validateInternalNote(value) {
  const note = String(value || "").trim();
  if (note.length < 2 || note.length > 2000) {
    const error = new Error("บันทึกภายในต้องมีความยาว 2–2,000 ตัวอักษร"); error.status = 400; throw error;
  }
  return note;
}

export function createFeedbackRepository(database) {
  return {
    async list(filters = {}) {
      const { where, values } = buildFeedbackFilters(filters);
      const [rows] = await database.execute(
        `SELECT id, category, message, contact, current_view AS currentView, created_at AS createdAt, status FROM feedback_reports ${where} ORDER BY FIELD(status, 'new', 'in_progress', 'resolved'), created_at DESC LIMIT 100`,
        values,
      );
      return rows;
    },
    async updateStatus(id, status) {
      const reportId = feedbackIdOrThrow(id);
      if (!isFeedbackStatus(status)) {
        const error = new Error("สถานะไม่ถูกต้อง"); error.status = 400; throw error;
      }
      const [result] = await database.execute("UPDATE feedback_reports SET status = ? WHERE id = ?", [status, reportId]);
      if (!result.affectedRows) {
        const error = new Error("ไม่พบรายงานที่ต้องการ"); error.status = 404; throw error;
      }
      return { id: reportId, status };
    },
    async countNew() {
      const [rows] = await database.execute("SELECT COUNT(*) AS count FROM feedback_reports WHERE status = 'new'");
      return Number(rows[0]?.count || 0);
    },
    async listNotes(id) {
      const reportId = feedbackIdOrThrow(id);
      const [rows] = await database.execute(
        "SELECT id, feedback_id AS feedbackId, note_body AS noteBody, author_context AS authorContext, created_at AS createdAt FROM feedback_internal_notes WHERE feedback_id = ? ORDER BY created_at DESC, id DESC",
        [reportId],
      );
      return rows;
    },
    async addNote(id, input = {}) {
      const reportId = feedbackIdOrThrow(id);
      const note = validateInternalNote(input.noteBody);
      const [exists] = await database.execute("SELECT id FROM feedback_reports WHERE id = ?", [reportId]);
      if (!exists.length) {
        const error = new Error("ไม่พบรายงานที่ต้องการ"); error.status = 404; throw error;
      }
      const authorContext = "ผู้ดูแลระบบ";
      const [result] = await database.execute(
        "INSERT INTO feedback_internal_notes (feedback_id, note_body, author_context) VALUES (?, ?, ?)",
        [reportId, note, authorContext],
      );
      return { id: result.insertId, feedbackId: reportId, noteBody: note, authorContext, createdAt: new Date().toISOString() };
    },
  };
}

export async function listFeedback(filters = {}) {
  return createFeedbackRepository(getPool()).list(filters);
}

export async function updateFeedbackStatus(id, status) {
  return createFeedbackRepository(getPool()).updateStatus(id, status);
}

export async function countNewFeedback() { return createFeedbackRepository(getPool()).countNew(); }
export async function listFeedbackNotes(id) { return createFeedbackRepository(getPool()).listNotes(id); }
export async function addFeedbackNote(id, input) { return createFeedbackRepository(getPool()).addNote(id, input); }
