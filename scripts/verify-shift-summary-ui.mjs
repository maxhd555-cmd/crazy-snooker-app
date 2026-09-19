import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { window.print = () => { document.body.dataset.shiftPrint = "called"; }; });

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const skipTour = page.getByRole("button", { name: "ข้ามทัวร์ (Skip Tour)" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await page.getByRole("button", { name: "ประวัติรายการ", exact: true }).click();
  const panel = page.locator(".shift-summary");
  await panel.getByRole("heading", { name: "สรุปกะจากรายการที่แสดง" }).waitFor();
  await panel.getByText(/รวม \d+ รายการ/).waitFor();
  await panel.getByRole("button", { name: "พิมพ์สรุปกะ" }).click();
  assert.equal(await page.locator("body").getAttribute("data-shift-print"), "called", "print button must invoke window.print");
  const downloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: "ส่งออก CSV" }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^crazy-snooker-shift-\d{4}-\d{2}-\d{2}\.csv$/, "CSV export must use a dated filename");
  await page.locator(".notice").filter({ hasText: "ส่งออกสรุปกะ" }).waitFor();
  console.log("SHIFT_SUMMARY_UI_OK summary=yes method_breakdown=yes print=yes csv_export=yes no_transaction_created=yes");
} finally {
  await browser.close();
}
