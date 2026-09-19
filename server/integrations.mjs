function hasValue(value) {
  return Boolean(String(value || "").trim());
}

export function getIntegrationReadiness(env = process.env) {
  const promptpayReady = hasValue(env.PROMPTPAY_RECIPIENT);
  const emailReady = hasValue(env.RESEND_API_KEY) && hasValue(env.RECEIPT_EMAIL_FROM);
  return {
    promptpay: {
      ready: promptpayReady,
      label: "PromptPay QR",
      message: promptpayReady ? "พร้อมสร้าง QR สำหรับ POS และ Wallet" : "รอหมายเลข PromptPay ของร้านก่อนเปิดรับชำระจริง",
      requirements: ["PROMPTPAY_RECIPIENT"],
    },
    receiptEmail: {
      ready: emailReady,
      label: "อีเมลใบเสร็จจากระบบ",
      message: emailReady ? "พร้อมทดสอบการส่งใบเสร็จจากเซิร์ฟเวอร์" : "ใช้การเตรียมอีเมลผ่านโปรแกรมอีเมลของพนักงานอยู่; รอผู้ให้บริการ, API key และผู้ส่งที่ยืนยันแล้ว",
      requirements: ["RESEND_API_KEY", "RECEIPT_EMAIL_FROM"],
    },
  };
}
