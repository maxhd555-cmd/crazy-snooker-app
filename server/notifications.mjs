export function buildBookingLineMessage(booking = {}) {
  return `Crazy Snooker: มีการจองโต๊ะใหม่\nโต๊ะ: ${booking.tableName || "-"}\nลูกค้า: ${booking.customerName || "-"}\nเวลา: ${booking.startTime || "-"}`;
}

export function buildNearEndLineMessage(session = {}) {
  return `Crazy Snooker: ใกล้หมดเวลาเล่น\nโต๊ะ: ${session.tableName || "-"}\nเหลือเวลา: ${session.remainingMinutes || 0} นาที\nโปรดเตรียมสรุปค่าใช้บริการ`;
}

export function isLineConfigured() { return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_NOTIFY_TO); }

export async function validateLineCredentials() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_NOTIFY_TO;
  if (!token || !to) return { configured: false, valid: false, reason: "LINE OA ยังไม่ได้ตั้งค่า" };
  const response = await fetch("https://api.line.me/v2/bot/info", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return { configured: true, valid: false, status: response.status, reason: "LINE OA ไม่ยอมรับ access token" };
  return { configured: true, valid: true };
}

export async function sendLineMessage(text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_NOTIFY_TO;
  if (!token || !to) return { configured: false, delivered: false, reason: "LINE OA ยังไม่ได้ตั้งค่า" };
  let response;
  try {
    response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
    });
  } catch (error) {
    throw new Error(`ไม่สามารถเชื่อมต่อ LINE OA ได้ (${String(error?.cause?.code || "network_error")})`);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = String(payload?.message || payload?.details?.[0]?.message || "recipient_or_request_rejected").slice(0, 160);
    throw new Error(`LINE OA ปฏิเสธการส่ง (${response.status}: ${detail})`);
  }
  return { configured: true, delivered: true };
}
