import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const baseUrl = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

async function openView(name) {
  await page.getByRole("button", { name }).click();
  await page.waitForTimeout(120);
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const skipTour = page.getByRole("button", { name: "ข้ามทัวร์ (Skip Tour)" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();

  await openView("จุดขาย POS");
  const posScanner = page.locator(".pos-layout .scanner");
  await posScanner.getByRole("textbox").fill("8850124018015");
  await posScanner.getByRole("button", { name: "ค้นหา" }).click();
  await page.locator(".cart-line").filter({ hasText: "น้ำดื่ม" }).waitFor();
  assert.match(await page.locator(".total").textContent(), /15/, "POS total must reflect the scanned product");

  await openView("สมาชิกและ Wallet");
  assert.equal(await page.getByRole("button", { name: /สร้าง QR เติมเงิน/ }).isEnabled(), true, "wallet top-up control must be available");

  await openView("จองโต๊ะและแจ้งเตือน");
  await page.getByRole("button", { name: "บันทึกและแจ้ง LINE OA" }).click();
  await page.locator(".notice").filter({ hasText: "กรุณากรอกชื่อลูกค้าและเบอร์โทรศัพท์" }).waitFor();

  await openView("คลังและบาร์โค้ด");
  const inventoryScanner = page.locator(".scanner").first();
  await inventoryScanner.getByRole("textbox").fill("8850124018015");
  await inventoryScanner.getByRole("button", { name: "ค้นหา" }).click();
  await page.locator(".inventory-action").filter({ hasText: "น้ำดื่ม" }).waitFor();

  await openView("ประวัติรายการ");
  await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
  await page.locator(".history-table").waitFor();

  await openView("การตั้งค่า");
  await page.locator(".settings-actions").getByRole("button", { name: "เปิดคู่มือการใช้งาน" }).click();
  await page.getByRole("button", { name: "ดูการแนะนำการใช้งานอีกครั้ง" }).click();
  await page.getByRole("heading", { name: "ยินดีต้อนรับสู่ Crazy Snooker" }).waitFor();
  await page.getByRole("button", { name: "ข้ามทัวร์ (Skip Tour)" }).click();

  console.log("UAT_UI_CORE_OK pos=yes wallet_readiness=yes booking_validation=yes inventory=yes history=yes help_replay=yes");
} finally {
  await browser.close();
}

execFileSync("node", ["scripts/verify-table-ui.mjs"], { cwd: process.cwd(), stdio: "inherit", env: process.env });
execFileSync("node", ["scripts/verify-feedback-ui.mjs"], { cwd: process.cwd(), stdio: "inherit", env: process.env });
console.log("UAT_ALL_WORKFLOWS_OK tables=yes admin_feedback=yes live_notifications_not_sent=yes");
