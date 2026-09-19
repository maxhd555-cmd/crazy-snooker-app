const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function operationalError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function formatAmount(amount) {
  return `${Number(amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
}

function configuredSender(env) {
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  const from = String(env.RECEIPT_EMAIL_FROM || "").trim();
  if (!apiKey || !from) throw operationalError(503, "ระบบส่งอีเมลใบเสร็จยังไม่ได้ตั้งค่าผู้ให้บริการหรืออีเมลผู้ส่ง");
  return { apiKey, from };
}

function receiptLines(receipt) {
  return (receipt.items || []).map((item) => ({
    name: String(item.name || "รายการ"),
    quantity: Math.max(1, Number(item.quantity || 1)),
    total: Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)),
  }));
}

export function buildReceiptEmail(receipt, recipient, env = process.env) {
  const { from } = configuredSender(env);
  const to = String(recipient || "").trim().toLowerCase();
  if (!emailPattern.test(to)) throw operationalError(400, "กรุณากรอกอีเมลลูกค้าให้ถูกต้องก่อนส่งใบเสร็จ");

  const receiptNumber = String(receipt?.receiptNumber || `R-${receipt?.reference || ""}`).trim();
  if (!receipt?.reference || !receiptNumber) throw operationalError(400, "ข้อมูลใบเสร็จไม่ครบถ้วน");
  const lines = receiptLines(receipt);
  const plainLines = lines.map((line) => `- ${line.name} × ${line.quantity}: ${formatAmount(line.total)}`).join("\n") || "- ไม่มีรายละเอียดรายการ";
  const htmlLines = lines.map((line) => `<tr><td>${escapeHtml(line.name)} × ${line.quantity}</td><td style="text-align:right">${escapeHtml(formatAmount(line.total))}</td></tr>`).join("") || "<tr><td colspan=\"2\">ไม่มีรายละเอียดรายการ</td></tr>";
  const customerName = String(receipt.customerName || "ลูกค้าทั่วไป");
  const total = formatAmount(receipt.amount);
  const text = `ใบเสร็จรับเงิน ${receiptNumber}\n\nลูกค้า: ${customerName}\nเลขอ้างอิง: ${receipt.reference}\nช่องทางชำระเงิน: ${receipt.paymentMethod || "-"}\n\n${plainLines}\n\nยอดชำระ: ${total}\n\nขอบคุณที่ใช้บริการ Crazy Snooker`;
  const html = `<!doctype html><html lang="th"><body style="font-family:Arial,sans-serif;color:#163c2e"><h2>ใบเสร็จรับเงิน</h2><p>เรียน ${escapeHtml(customerName)}</p><p>เลขที่ใบเสร็จ: <strong>${escapeHtml(receiptNumber)}</strong><br>เลขอ้างอิง: ${escapeHtml(receipt.reference)}<br>ช่องทางชำระเงิน: ${escapeHtml(receipt.paymentMethod || "-")}</p><table style="width:100%;border-collapse:collapse" cellspacing="0" cellpadding="8"><thead><tr><th style="text-align:left;border-bottom:1px solid #d8e3dc">รายการ</th><th style="text-align:right;border-bottom:1px solid #d8e3dc">จำนวนเงิน</th></tr></thead><tbody>${htmlLines}</tbody></table><p style="font-size:18px"><strong>ยอดชำระ: ${escapeHtml(total)}</strong></p><p>ขอบคุณที่ใช้บริการ Crazy Snooker</p></body></html>`;
  return { from, to, subject: `ใบเสร็จรับเงิน ${receiptNumber} | Crazy Snooker`, text, html, idempotencyKey: `receipt-${String(receipt.reference).slice(0, 80)}-${Buffer.from(to).toString("base64url").slice(0, 80)}` };
}

export async function sendReceiptEmail({ receipt, recipient, env = process.env, fetchImpl = fetch }) {
  const sender = configuredSender(env);
  const message = buildReceiptEmail(receipt, recipient, env);
  let response;
  try {
    response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${sender.apiKey}`, "Content-Type": "application/json", "User-Agent": "crazy-snooker-receipts/1.0", "Idempotency-Key": message.idempotencyKey },
      body: JSON.stringify({ from: message.from, to: message.to, subject: message.subject, text: message.text, html: message.html }),
    });
  } catch {
    throw operationalError(502, "ไม่สามารถเชื่อมต่อบริการส่งอีเมลใบเสร็จได้");
  }
  let payload = {};
  try { payload = await response.json(); } catch { /* provider response is intentionally not surfaced */ }
  if (!response.ok) throw operationalError(502, "ผู้ให้บริการอีเมลปฏิเสธการส่งใบเสร็จ โปรดตรวจสอบ API key และผู้ส่งที่ยืนยันแล้ว");
  return { delivered: true, providerMessageId: String(payload?.id || "") };
}
