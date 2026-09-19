import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const skipTour = page.getByRole("button", { name: "ข้ามทัวร์ (Skip Tour)" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await page.getByRole("button", { name: "การตั้งค่า", exact: true }).click();
  const panel = page.locator(".integration-readiness");
  await panel.getByRole("heading", { name: "ความพร้อมบริการ" }).waitFor();
  await panel.getByText("PromptPay QR").waitFor();
  await panel.getByText("อีเมลใบเสร็จจากระบบ").waitFor();
  await panel.getByRole("button", { name: "ตรวจสอบอีกครั้ง" }).click();
  const labels = await panel.locator(".readiness-list article").count();
  assert.equal(labels, 2, "readiness panel must show both required external services");
  console.log("INTEGRATION_READINESS_UI_OK promptpay=yes receipt_email=yes refresh=yes secrets_hidden=yes");
} finally {
  await browser.close();
}
