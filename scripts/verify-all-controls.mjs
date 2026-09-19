import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

async function go(name) {
  await page.getByRole("button", { name, exact: true }).click();
  await page.waitForTimeout(100);
}

async function dismissNotice() {
  const close = page.getByRole("button", { name: "ปิดข้อความ" });
  if (await close.isVisible().catch(() => false)) await close.click();
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const skipTour = page.getByRole("button", { name: "ข้ามทัวร์ (Skip Tour)" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();

  for (const name of ["จุดขาย POS", "สมาชิกและ Wallet", "จองโต๊ะและแจ้งเตือน", "คลังและบาร์โค้ด", "สถานะโต๊ะ", "ประวัติรายการ", "การตั้งค่า", "รายงานผู้ใช้"]) {
    await go(name);
  }

  await go("จุดขาย POS");
  const posProducts = page.locator(".product");
  const productCount = await posProducts.count();
  assert.ok(productCount >= 4, "POS must render all catalog product controls");
  for (let index = 0; index < productCount; index += 1) await posProducts.nth(index).click();
  assert.equal(await page.locator(".cart-line").count(), productCount, "each product button must add a cart line");
  const firstLine = page.locator(".cart-line").first();
  await firstLine.getByRole("button", { name: "−" }).click();
  await firstLine.getByRole("button", { name: "+" }).click();
  const posScanner = page.locator(".pos-layout .scanner");
  await posScanner.getByRole("textbox").fill("UNKNOWN-CODE");
  await posScanner.getByRole("button", { name: "ค้นหา" }).click();
  await page.locator(".notice").filter({ hasText: "ไม่พบบาร์โค้ด" }).waitFor();
  await dismissNotice();
  await page.getByRole("button", { name: "สแกนด้วยกล้อง" }).click();
  await page.locator(".notice").waitFor();
  await dismissNotice();
  await page.getByRole("button", { name: "สร้าง QR PromptPay" }).click();
  await page.locator(".notice").waitFor();
  await dismissNotice();

  await go("สมาชิกและ Wallet");
  const memberOptions = await page.locator(".member").count();
  for (let index = 0; index < memberOptions; index += 1) await page.locator(".member").nth(index).click();
  await page.getByLabel("จำนวนเงิน (บาท)").fill("125");
  await page.getByRole("button", { name: /สร้าง QR เติมเงิน/ }).click();
  await page.locator(".notice").waitFor();
  await dismissNotice();

  await go("จองโต๊ะและแจ้งเตือน");
  await page.getByRole("button", { name: "บันทึกและแจ้ง LINE OA" }).click();
  await page.locator(".notice").filter({ hasText: "กรุณากรอกชื่อลูกค้าและเบอร์โทรศัพท์" }).waitFor();
  await dismissNotice();
  await page.getByLabel("ชื่อลูกค้า").fill("UAT Customer");
  await page.getByLabel("โทรศัพท์").fill("0800000000");
  assert.equal(await page.getByLabel("เวลาเริ่มเล่น").inputValue(), "19:00", "booking time control must remain editable");

  await go("คลังและบาร์โค้ด");
  const inventoryScanner = page.locator(".scanner").first();
  await inventoryScanner.getByRole("textbox").fill("UNKNOWN-CODE");
  await inventoryScanner.getByRole("button", { name: "ค้นหา" }).click();
  await page.locator(".notice").filter({ hasText: "ไม่พบบาร์โค้ดในคลัง" }).waitFor();
  await dismissNotice();
  await inventoryScanner.getByRole("textbox").fill("8850124018015");
  await inventoryScanner.getByRole("button", { name: "ค้นหา" }).click();
  await page.locator(".inventory-action").waitFor();
  await page.locator(".inventory-action select").selectOption("receive");
  await page.locator(".inventory-action input[type=number]").fill("1");
  await page.getByRole("button", { name: "บันทึกรายการจากบาร์โค้ด" }).click();
  await page.locator(".notice").filter({ hasText: "รับเข้า" }).waitFor();
  await dismissNotice();
  await page.locator(".inventory-action select").selectOption("adjust");
  await page.getByRole("button", { name: "บันทึกรายการจากบาร์โค้ด" }).click();
  await page.locator(".notice").filter({ hasText: "ปรับออก" }).waitFor();
  await dismissNotice();
  const firstInventoryRow = page.locator(".inventory-row").first();
  await firstInventoryRow.getByRole("button", { name: "+ รับเข้า" }).click();
  await firstInventoryRow.getByRole("button", { name: "− ปรับออก" }).click();
  await page.getByRole("button", { name: "สแกนด้วยกล้อง" }).click();
  await page.locator(".notice").waitFor();
  await dismissNotice();

  await go("สถานะโต๊ะ");
  const tableCard = page.locator(".table-card").filter({ hasText: "โต๊ะ 02" });
  const tableStatus = tableCard.getByRole("combobox", { name: "สถานะ โต๊ะ 02" });
  for (const status of ["reserved", "maintenance", "occupied", "available"]) {
    const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/tables/t2") && response.request().method() === "PATCH");
    await tableStatus.selectOption(status);
    const response = await responsePromise;
    assert.equal(response.status(), 200, `table API must accept ${status}`);
    await page.waitForFunction((expectedStatus) => document.querySelector('[aria-label="สถานะ โต๊ะ 02"]')?.value === expectedStatus, status);
    assert.equal(await tableStatus.inputValue(), status, `table status must update to ${status}`);
  }

  await go("ประวัติรายการ");
  await page.getByLabel("ตั้งแต่").fill("2026-08-01");
  await page.getByLabel("ถึง").fill("2026-08-31");
  await page.getByLabel("ชำระผ่าน").selectOption("cash");
  await page.getByPlaceholder("เลขอ้างอิง ชื่อ หรืออีเมล").fill("UAT");
  await page.getByRole("button", { name: "รีเฟรช" }).click();
  await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
  assert.equal(await page.getByLabel("ชำระผ่าน").inputValue(), "", "history filters must reset");

  await go("การตั้งค่า");
  const downloadPromise = page.waitForEvent("download");
  await page.locator(".settings-actions").getByRole("button", { name: "ดาวน์โหลดคู่มือ PDF" }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /crazy-snooker-user-manual-th\.pdf/, "manual PDF control must download the manual");
  await page.locator(".settings-actions").getByRole("button", { name: "เปิดคู่มือการใช้งาน" }).click();
  const helpSearch = page.getByLabel("ค้นหาหัวข้อ");
  await helpSearch.fill("ข้อความที่ไม่พบแน่นอน");
  await page.getByText("ไม่พบหัวข้อที่ค้นหา").waitFor();
  await page.getByRole("button", { name: "ล้างคำค้นหา" }).click();
  await helpSearch.fill("บาร์โค้ด");
  await page.locator(".help-sections").getByRole("heading", { name: "คลังและบาร์โค้ด", exact: true }).waitFor();
  const helpDownloadPromise = page.waitForEvent("download");
  await page.locator(".help-actions").getByRole("button", { name: "ดาวน์โหลด PDF" }).click();
  const helpDownload = await helpDownloadPromise;
  assert.match(helpDownload.suggestedFilename(), /crazy-snooker-user-manual-th\.pdf/, "Help download control must download the manual");
  await page.getByRole("button", { name: "รายงานปัญหา" }).click();
  await page.getByRole("button", { name: "ส่งข้อความ" }).click();
  await page.getByText("โปรดอธิบายรายละเอียดอย่างน้อย 10 ตัวอักษร").waitFor();
  await page.getByRole("button", { name: "ปิดแบบฟอร์มรายงานปัญหา" }).click();
  await page.locator(".help-fab").click();
  await page.locator(".help-modal").getByRole("button", { name: "ปิดคู่มือ", exact: true }).click();
  await page.getByRole("button", { name: "เริ่ม Interactive Tour ใหม่" }).click();
  await page.getByRole("button", { name: "ถัดไป" }).click();
  await page.getByRole("button", { name: "ย้อนกลับ" }).click();
  await page.getByRole("button", { name: "ข้ามการแนะนำ" }).click();
  await go("การตั้งค่า");
  await page.getByRole("button", { name: "เริ่ม Interactive Tour ใหม่" }).click();
  for (let index = 0; index < 5; index += 1) await page.getByRole("button", { name: "ถัดไป" }).click();
  await page.getByRole("button", { name: "เริ่มใช้งาน" }).click();

  console.log("ALL_CONTROLS_UI_OK navigation=yes pos=yes wallet_readiness=yes booking_validation=yes inventory=yes tables=yes history=yes help=yes tour=yes downloads=yes live_messages_not_sent=yes live_payment_not_confirmed=yes hardware_camera_error_path=yes");
} finally {
  await page.request.patch(`${baseUrl}/api/tables/t2`, { data: { status: "available" } }).catch(() => {});
  await browser.close();
}
