import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const adminKey = process.env.ADMIN_FEEDBACK_KEY;
if (!adminKey) throw new Error("ADMIN_FEEDBACK_KEY is required for UI verification");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let reportId;

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const skipTour = page.getByRole("button", { name: "ข้ามทัวร์ (Skip Tour)" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();

  const reportResponse = await page.request.post(`${baseUrl}/api/feedback`, {
    data: { category: "suggestion", message: "[TEST] ตรวจสอบ UI แบดจ์และบันทึกภายใน", contact: "" },
  });
  assert.equal(reportResponse.status(), 201, "feedback report must be accepted");
  reportId = (await reportResponse.json()).id;

  await page.getByRole("button", { name: "รายงานผู้ใช้" }).click();
  await page.locator('input[type="password"]').fill(adminKey);
  await page.locator('input[type="password"]').fill("invalid-test-key");
  await page.getByRole("button", { name: "ปลดล็อกศูนย์รายงาน" }).click();
  await page.getByText("ต้องใช้รหัสผู้ดูแลระบบ").waitFor();
  await page.locator('input[type="password"]').fill(adminKey);
  await page.getByRole("button", { name: "ปลดล็อกศูนย์รายงาน" }).click();
  await page.locator(".admin-report").filter({ hasText: `#${reportId}` }).waitFor();

  const badge = page.locator(".nav-badge");
  await badge.waitFor();
  assert.equal(await badge.isVisible(), true, "new-report badge must be visible for an authorized admin");

  const reportCard = page.locator(".admin-report").filter({ hasText: `#${reportId}` });
  await page.locator(".admin-filters").getByLabel("ประเภท").selectOption("suggestion");
  await reportCard.waitFor();
  await page.locator(".admin-filters").getByLabel("สถานะ").selectOption("new");
  await reportCard.waitFor();
  await page.locator(".admin-filters").getByLabel("ประเภท").selectOption("");
  await page.locator(".admin-filters").getByLabel("สถานะ").selectOption("");
  await page.getByRole("button", { name: "รีเฟรช" }).click();
  await reportCard.waitFor();
  const statusResponse = page.waitForResponse((response) => response.url().endsWith(`/api/admin/feedback/${reportId}`) && response.request().method() === "PATCH");
  await reportCard.getByRole("combobox", { name: `สถานะรายงาน ${reportId}` }).selectOption("in_progress");
  assert.equal((await statusResponse).status(), 200, "admin status update must succeed");
  await reportCard.locator(".report-status.in_progress").waitFor();
  await reportCard.getByRole("button", { name: "ดูรายละเอียด" }).click();
  await page.getByRole("heading", { name: "บันทึกภายใน" }).waitFor();
  await page.locator(".internal-notes").getByRole("button", { name: "บันทึกหมายเหตุ" }).click();
  await page.getByText("โปรดบันทึกข้อความอย่างน้อย 2 ตัวอักษร").waitFor();
  const noteText = "[TEST] ยืนยันการสร้างบันทึกภายในผ่านหน้าจอผู้ดูแล";
  await page.locator(".internal-notes textarea").fill(noteText);
  await page.locator(".internal-notes").getByRole("button", { name: "บันทึกหมายเหตุ" }).click();
  await page.getByText(noteText).waitFor();

  await page.getByRole("button", { name: "ปิดรายละเอียด", exact: true }).click();
  await page.getByRole("button", { name: "เปิดคู่มือการใช้งาน" }).click();
  await page.getByRole("button", { name: "ดูการแนะนำการใช้งานอีกครั้ง" }).click();
  await page.getByRole("heading", { name: "ยินดีต้อนรับสู่ Crazy Snooker" }).waitFor();

  const resolveResponse = await page.request.patch(`${baseUrl}/api/admin/feedback/${reportId}`, {
    headers: { "x-admin-key": adminKey }, data: { status: "resolved" },
  });
  assert.equal(resolveResponse.status(), 200, "test report must be resolved after verification");
  console.log(`UI_E2E_OK report_id=${reportId} invalid_admin_rejected=yes filters=yes refresh=yes status_update=yes internal_note_validation=yes badge_visible=yes internal_note_visible=yes help_replay_started=yes`);
} finally {
  if (reportId) await page.request.patch(`${baseUrl}/api/admin/feedback/${reportId}`, {
    headers: { "x-admin-key": adminKey }, data: { status: "resolved" },
  }).catch(() => {});
  await browser.close();
}
