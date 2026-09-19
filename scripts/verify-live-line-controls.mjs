import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const skipTour = page.getByRole("button", { name: "ข้ามทัวร์ (Skip Tour)" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await page.getByRole("button", { name: "จองโต๊ะและแจ้งเตือน", exact: true }).click();
  const bookingForm = page.locator("form.panel");
  await bookingForm.locator("select").selectOption({ label: "โต๊ะ 01 VIP" });
  await bookingForm.locator("input").nth(0).fill("[TEST] UAT Booking");
  await bookingForm.locator("input").nth(1).fill("0800000000");
  await bookingForm.locator("input[type=time]").fill("19:30");
  await bookingForm.getByRole("button", { name: "บันทึกและแจ้ง LINE OA" }).click();
  await page.locator(".notice").filter({ hasText: "บันทึกการจองและส่ง LINE OA แล้ว" }).waitFor();

  await page.route("**/api/notifications/near-end", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ delivered: true, simulated: true }) }));
  await page.getByRole("button", { name: "ทดสอบส่งแจ้งเตือน" }).click();
  await page.locator(".notice").filter({ hasText: "ส่งแจ้งเตือน LINE OA แล้ว" }).waitFor();
  await page.unroute("**/api/notifications/near-end");

  const nearEndResponse = await page.request.post(`${baseUrl}/api/notifications/near-end`, {
    data: { tableName: "[TEST] UAT Near-End", remainingMinutes: 8 },
  });
  assert.equal(nearEndResponse.status(), 200, "labelled near-end LINE message must be accepted");
  assert.equal((await nearEndResponse.json()).delivered, true, "LINE API must confirm the labelled near-end message");
  console.log("LIVE_LINE_CONTROLS_OK booking_ui_sent=yes near_end_button_simulated=yes near_end_labelled_message_sent=yes");
} finally {
  await browser.close();
}
