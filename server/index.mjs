import express from "express";
import { loadEncryptedSecrets } from "./secureConfig.mjs";

// โหลดค่าลับจากไฟล์เข้ารหัส (ถ้ามี) ก่อนส่วนอื่นอ่าน process.env
loadEncryptedSecrets();

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import generatePayload from "promptpay-qr";
import { buildBookingLineMessage, buildNearEndLineMessage, isLineConfigured, sendLineMessage } from "./notifications.mjs";
import { buildReceipt, filterTransactions, paymentMethods } from "./transactions.mjs";
import { getIntegrationReadiness } from "./integrations.mjs";
import { sendReceiptEmail } from "./receiptEmail.mjs";
import { addFeedbackNote, countNewFeedback, listFeedback, listFeedbackNotes, storeFeedback, updateFeedbackStatus } from "./feedback.mjs";
import { requireAdminKey } from "./adminAccess.mjs";
import { dispatchNearEndAlerts, getNearEndSchedulerConfig, listTables, updateTable } from "./tables.mjs";
import { authenticateCronRequest } from "./cronAuth.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const app = express();
app.use(express.json({ limit: "64kb" }));

const paymentLedger = new Map();
const sanitizeMoney = (amount) => Math.round(Number(amount || 0) * 100) / 100;

// Health endpoint สำหรับ Render health check และ keep-alive ping จาก cron ภายนอก
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()), checkedAt: new Date().toISOString() });
});
const transactions = [
  { reference: "CS-DEMO-1001", amount: 245, paymentMethod: "cash", status: "verified", createdAt: "2026-08-21T11:30:00.000Z", paidAt: "2026-08-21T11:32:00.000Z", customerName: "ลูกค้าหน้าร้าน", staffName: "พนักงานหน้าร้าน", items: [{ name: "ค่าโต๊ะ", quantity: 1, price: 200 }, { name: "น้ำดื่ม", quantity: 3, price: 15 }] },
  { reference: "CS-DEMO-1002", amount: 180, paymentMethod: "promptpay", status: "verified", createdAt: "2026-08-22T05:15:00.000Z", paidAt: "2026-08-22T05:17:00.000Z", customerName: "คุณสมชาย", staffName: "พนักงานหน้าร้าน", items: [{ name: "ค่าโต๊ะ", quantity: 1, price: 150 }, { name: "โค้กกระป๋อง", quantity: 1, price: 30 }] },
  { reference: "CS-DEMO-1003", amount: 100, paymentMethod: "wallet", status: "verified", createdAt: "2026-08-22T07:40:00.000Z", paidAt: "2026-08-22T07:41:00.000Z", customerName: "คุณวิชัย", staffName: "พนักงานหน้าร้าน", items: [{ name: "เติมเงิน Wallet", quantity: 1, price: 100 }] },
];
const tableClients = new Set();

async function broadcastTables() {
  const tables = await listTables();
  const payload = `data: ${JSON.stringify({ tables, updatedAt: new Date().toISOString() })}\n\n`;
  tableClients.forEach((client) => client.write(payload));
}

app.post("/api/payments/promptpay", (req, res) => {
  const amount = sanitizeMoney(req.body?.amount);
  const purpose = String(req.body?.purpose || "payment").slice(0, 40);
  const recipient = process.env.PROMPTPAY_RECIPIENT;
  if (!recipient) return res.status(503).json({ error: "PROMPTPAY_RECIPIENT ยังไม่ได้ตั้งค่า" });
  if (!(amount > 0)) return res.status(400).json({ error: "จำนวนเงินต้องมากกว่า 0 บาท" });

  const reference = `CS${Date.now().toString(36).toUpperCase()}`;
  const payload = generatePayload(recipient.replace(/\D/g, ""), { amount });
  paymentLedger.set(reference, { reference, amount, purpose, paymentMethod: "promptpay", status: "pending", createdAt: new Date().toISOString() });
  res.json({ reference, amount, payload, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
});

app.post("/api/payments/:reference/confirm", (req, res) => {
  const record = paymentLedger.get(req.params.reference);
  if (!record) return res.status(404).json({ error: "ไม่พบรายการชำระเงิน" });
  record.status = "verified";
  record.verifiedAt = new Date().toISOString();
  record.paidAt = record.verifiedAt;
  record.customerName = String(req.body?.customerName || "ลูกค้าทั่วไป").slice(0, 100);
  record.customerEmail = String(req.body?.customerEmail || "").slice(0, 200);
  record.staffName = "พนักงานหน้าร้าน";
  record.items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 30).map((item) => ({ name: String(item.name || "รายการ"), quantity: Math.max(1, Number(item.quantity || 1)), price: sanitizeMoney(item.price) })) : [];
  transactions.unshift(record);
  res.json({ ...record, receipt: buildReceipt(record) });
});

app.get("/api/tables", async (_req, res) => {
  try { res.json({ tables: await listTables(), updatedAt: new Date().toISOString() }); }
  catch (error) { res.status(error.status || 500).json({ error: error.message || "ไม่สามารถโหลดสถานะโต๊ะได้" }); }
});
app.get("/api/tables/stream", async (req, res) => {
  try {
    const tables = await listTables();
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.flushHeaders();
    tableClients.add(res);
    res.write(`data: ${JSON.stringify({ tables, updatedAt: new Date().toISOString() })}\n\n`);
    req.on("close", () => tableClients.delete(res));
  } catch (error) { res.status(error.status || 500).json({ error: error.message || "ไม่สามารถเปิดสถานะโต๊ะแบบเรียลไทม์ได้" }); }
});
app.patch("/api/tables/:id", async (req, res) => {
  try {
    const table = await updateTable(req.params.id, req.body || {});
    await broadcastTables();
    res.json({ table });
  } catch (error) { res.status(error.status || 500).json({ error: error.message || "อัปเดตสถานะโต๊ะไม่สำเร็จ" }); }
});

app.get("/api/transactions", (req, res) => {
  const method = String(req.query.method || "");
  if (method && !paymentMethods.includes(method)) return res.status(400).json({ error: "ช่องทางชำระเงินไม่ถูกต้อง" });
  res.json({ transactions: filterTransactions(transactions, req.query), total: transactions.length });
});

app.post("/api/transactions/:reference/receipt-email", async (req, res) => {
  const record = transactions.find((item) => item.reference === req.params.reference);
  if (!record) return res.status(404).json({ error: "ไม่พบรายการสำหรับส่งใบเสร็จ" });
  try {
    const result = await sendReceiptEmail({ receipt: buildReceipt(record), recipient: req.body?.email });
    res.json({ delivered: result.delivered });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "ไม่สามารถส่งอีเมลใบเสร็จได้" });
  }
});

app.get("/api/integrations/readiness", (_req, res) => res.json({ integrations: getIntegrationReadiness() }));

app.post("/api/feedback", async (req, res) => {
  try {
    const result = await storeFeedback(req.body);
    res.status(201).json({ ...result, message: "รับเรื่องแล้ว ขอบคุณสำหรับข้อเสนอแนะ" });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "ไม่สามารถส่งข้อความได้" });
  }
});

app.post("/api/admin/access", requireAdminKey, (_req, res) => res.json({ authorized: true }));

app.get("/api/admin/feedback/counts", requireAdminKey, async (_req, res) => {
  try {
    res.json({ newCount: await countNewFeedback() });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "ไม่สามารถนับรายงานใหม่ได้" });
  }
});

app.get("/api/admin/feedback", requireAdminKey, async (req, res) => {
  try {
    res.json({ reports: await listFeedback(req.query) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "ไม่สามารถโหลดรายงานได้" });
  }
});

app.patch("/api/admin/feedback/:id", requireAdminKey, async (req, res) => {
  try {
    res.json({ report: await updateFeedbackStatus(req.params.id, req.body?.status) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "ไม่สามารถอัปเดตสถานะได้" });
  }
});

app.get("/api/admin/feedback/:id/notes", requireAdminKey, async (req, res) => {
  try {
    res.json({ notes: await listFeedbackNotes(req.params.id) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "ไม่สามารถโหลดบันทึกภายในได้" });
  }
});

app.post("/api/admin/feedback/:id/notes", requireAdminKey, async (req, res) => {
  try {
    res.status(201).json({ note: await addFeedbackNote(req.params.id, req.body) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "ไม่สามารถบันทึกหมายเหตุได้" });
  }
});

app.post("/api/notifications/booking", async (req, res) => {
  const booking = req.body || {};
  try {
    const result = await sendLineMessage(buildBookingLineMessage(booking));
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/notifications/near-end", async (req, res) => {
  const session = req.body || {};
  try {
    const result = await sendLineMessage(buildNearEndLineMessage(session));
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/scheduled/near-end-alerts", async (req, res) => {
  try {
    console.info("[NearEndHeartbeat] callback received", { hasCookie: Boolean(req.headers.cookie), hasAuthorization: Boolean(req.headers.authorization) });
    const cron = await authenticateCronRequest(req);
    const config = await getNearEndSchedulerConfig(cron.taskUid);
    if (!config) return res.json({ ok: true, skipped: "orphaned_or_unconfigured_schedule" });
    if (!isLineConfigured()) return res.json({ ok: true, skipped: "line_not_configured", checked: 0, delivered: 0 });
    const result = await dispatchNearEndAlerts({
      windowMinutes: config.alertWindowMinutes,
      send: (table) => sendLineMessage(buildNearEndLineMessage({ tableName: table.label, remainingMinutes: table.remainingMinutes })),
    });
    res.json({ ok: true, taskUid: cron.taskUid, ...result, checkedAt: new Date().toISOString() });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "ไม่สามารถประมวลผลการแจ้งเตือนใกล้หมดเวลาได้", timestamp: new Date().toISOString() });
  }
});

const isDev = process.argv.includes("--dev");
if (isDev) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({ root, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    try {
      const template = await fs.readFile(path.join(root, "index.html"), "utf-8");
      res.status(200).set({ "Content-Type": "text/html" }).end(await vite.transformIndexHtml(req.originalUrl, template));
    } catch (error) { next(error); }
  });
} else {
  const publicDir = path.join(root, "dist", "public");
  app.use(express.static(publicDir));
  app.use("*", async (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Crazy Snooker Club server started at http://localhost:${port}`));
