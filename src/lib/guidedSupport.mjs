export const TOUR_STORAGE_KEY = "crazy-snooker-guided-support-v1";
export const manualPdfPath = "/manus-storage/crazy-snooker-user-manual-th_328c2e5a.pdf";
export const feedbackCategories = [
  { value: "problem", label: "ปัญหาการใช้งาน" },
  { value: "data", label: "ข้อมูลไม่ถูกต้อง" },
  { value: "suggestion", label: "ข้อเสนอแนะ" },
];

export const manualSections = [
  { id: "start", title: "เริ่มต้นใช้งาน", body: "ใช้เมนูด้านซ้ายเพื่อเข้าสู่ POS, สมาชิก, การจอง, คลัง, สถานะโต๊ะ และประวัติรายการ ตรวจสอบสถานะกะก่อนเริ่มงาน" },
  { id: "pos", title: "จุดขาย POS และ PromptPay", body: "เพิ่มสินค้าด้วยการคลิกหรือสแกนบาร์โค้ด ตรวจสอบตะกร้า สร้าง QR แล้วให้พนักงานยืนยันยอดจริงก่อนบันทึกการรับชำระ" },
  { id: "members", title: "สมาชิกและ Wallet", body: "เลือกสมาชิก ระบุยอดเติมเงิน สร้าง QR และยืนยันรับชำระก่อนยอดเงินจะเข้ากระเป๋าสมาชิก" },
  { id: "tables", title: "สถานะโต๊ะแบบเรียลไทม์", body: "สีเขียวคือว่าง สีแดงคือไม่ว่าง สีเหลืองคือจองแล้ว และสีเทาคือปิดปรับปรุง เปลี่ยนสถานะทันทีเมื่อสถานะหน้างานเปลี่ยน" },
  { id: "booking", title: "จองโต๊ะและแจ้งเตือน", body: "กรอกโต๊ะ ชื่อลูกค้า โทรศัพท์ และเวลาเริ่มเล่น ระบบจะส่ง LINE OA ได้เมื่อผู้ดูแลกำหนดข้อมูลเชื่อมต่อแล้ว" },
  { id: "inventory", title: "คลังและบาร์โค้ด", body: "สแกนสินค้าในหน้าคลังเพื่อเลือกรับสินค้าเข้าหรือปรับสินค้าออก การสแกนหน้านี้จะไม่เพิ่มสินค้าเข้า POS" },
  { id: "receipt", title: "ใบเสร็จและประวัติรายการ", body: "เปิดใบเสร็จจากรายการชำระเงินเพื่อพิมพ์หรือเตรียมอีเมล ใช้วันที่ วิธีชำระเงิน และคำค้นหาเพื่อกรองประวัติ" },
  { id: "support", title: "ความช่วยเหลือเพิ่มเติม", body: "เปิดคู่มือฉบับเต็มจากปุ่มนี้ได้ทุกเมื่อ และดาวน์โหลด PDF ได้ในหน้าการตั้งค่า" },
];

export const tourSteps = [
  { id: "welcome", view: "pos", title: "ยินดีต้อนรับสู่ Crazy Snooker", body: "ทัวร์สั้นนี้จะแนะนำจุดสำคัญสำหรับเริ่มกะการทำงาน" },
  { id: "sell", view: "pos", title: "เริ่มขายที่ POS", body: "สแกนบาร์โค้ดหรือเลือกสินค้า ตรวจสอบตะกร้า และสร้าง QR PromptPay เมื่อพร้อมรับชำระ" },
  { id: "tables", view: "console", title: "ตรวจสอบสถานะโต๊ะ", body: "สีและข้อความบนบัตรโต๊ะบอกความพร้อมใช้งาน เปลี่ยนสถานะจากเมนูบนบัตรให้ตรงกับหน้างาน" },
  { id: "inventory", view: "inventory", title: "จัดการคลังสินค้า", body: "ใช้บาร์โค้ดเพื่อรับสินค้าเข้า หรือปรับสินค้าออก โดยไม่กระทบตะกร้า POS" },
  { id: "history", view: "history", title: "ค้นหารายการและใบเสร็จ", body: "กรองตามวันที่และช่องทางชำระเงิน แล้วเปิดใบเสร็จสำหรับพิมพ์หรือเตรียมอีเมล" },
  { id: "settings", view: "settings", title: "ตั้งค่าและค้นหาความช่วยเหลือ", body: "ที่นี่คุณเริ่มทัวร์ใหม่ เปิดคู่มือ และดาวน์โหลดคู่มือ PDF ได้ทุกเมื่อ" },
];

export function isTourComplete(storage) { return storage?.getItem(TOUR_STORAGE_KEY) === "complete"; }
export function completeTour(storage) { storage?.setItem(TOUR_STORAGE_KEY, "complete"); }
export function resetTour(storage) { storage?.removeItem(TOUR_STORAGE_KEY); }
export function filterManualSections(sections, query) {
  const normalized = String(query || "").trim().toLocaleLowerCase("th-TH");
  if (!normalized) return sections;
  return sections.filter((section) => `${section.title} ${section.body}`.toLocaleLowerCase("th-TH").includes(normalized));
}
export function feedbackIsValid(message) { const length = String(message || "").trim().length; return length >= 10 && length <= 2000; }
