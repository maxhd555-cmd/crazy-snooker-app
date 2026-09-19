import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const skipTour = page.getByRole("button", { name: "ข้ามทัวร์ (Skip Tour)" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await page.getByRole("button", { name: "ประวัติรายการ", exact: true }).click();
  const firstRecord = page.locator(".history-row").first();
  await firstRecord.getByRole("button", { name: "เปิดใบเสร็จ" }).click();
  await page.locator(".receipt-modal").waitFor();
  await page.evaluate(() => { window.print = () => { document.body.dataset.uatPrintCalled = "yes"; }; });
  await page.getByRole("button", { name: "พิมพ์ใบเสร็จ" }).click();
  assert.equal(await page.locator("body").getAttribute("data-uat-print-called"), "yes", "print control must invoke browser print");
  await page.getByRole("button", { name: "เตรียมอีเมลใบเสร็จ" }).click();
  await page.locator(".notice").filter({ hasText: "กรุณากรอกอีเมลลูกค้าก่อน" }).waitFor();
  await page.locator(".receipt-modal .close").click();
  await page.getByRole("button", { name: "ปิดข้อความ" }).click();
  await firstRecord.getByRole("button", { name: "เปิดใบเสร็จ" }).click();
  await page.getByPlaceholder("customer@example.com").fill("uat@example.test");
  assert.equal(await page.getByPlaceholder("customer@example.com").inputValue(), "uat@example.test", "receipt email input must accept a valid destination");
  await page.getByRole("button", { name: "เตรียมอีเมลใบเสร็จ" }).click({ noWaitAfter: true });
  await page.locator(".notice").filter({ hasText: "ระบบส่งตรงยังไม่พร้อม" }).waitFor();
  await page.locator(".receipt-modal .close").click();
  console.log("RECEIPT_CONTROLS_UI_OK open=yes print=yes email_validation=yes email_input=yes mail_fallback=yes no_email_sent=yes");
} finally {
  await browser.close();
}
