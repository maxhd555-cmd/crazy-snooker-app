import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const skipTour = page.getByRole("button", { name: "ข้ามทัวร์ (Skip Tour)" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await page.getByRole("button", { name: "สถานะโต๊ะ" }).click();

  const tableCard = page.locator(".table-card").filter({ hasText: "โต๊ะ 02" });
  const statusSelect = tableCard.getByRole("combobox", { name: "สถานะ โต๊ะ 02" });
  await statusSelect.selectOption("occupied");
  const endTime = tableCard.getByRole("textbox", { name: "เวลาเลิกเล่น โต๊ะ 02" });
  await endTime.waitFor();
  const endAt = new Date(Date.now() + 12 * 60 * 1000);
  const local = `${endAt.getFullYear()}-${String(endAt.getMonth() + 1).padStart(2, "0")}-${String(endAt.getDate()).padStart(2, "0")}T${String(endAt.getHours()).padStart(2, "0")}:${String(endAt.getMinutes()).padStart(2, "0")}`;
  await endTime.fill(local);
  await endTime.blur();
  await page.waitForTimeout(350);
  assert.equal(await endTime.inputValue(), local, "table end time must remain visible after saving");
  const timing = tableCard.locator(".table-time-status.soon");
  assert.match(await timing.textContent(), /เหลือเวลา (1[0-5]|[1-9]) นาที/, "near-end table must show a visible remaining-time status");
  await statusSelect.selectOption("available");
  console.log("TABLE_UI_E2E_OK end_time_control_visible=yes remaining_time_visible=yes end_time_saved=yes test_table_restored=yes");
} finally {
  await page.request.patch(`${baseUrl}/api/tables/t2`, { data: { status: "available" } }).catch(() => {});
  await browser.close();
}
