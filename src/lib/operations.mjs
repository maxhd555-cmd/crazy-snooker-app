export const tableStates = {
  available: { label: "ว่าง", tone: "available" },
  occupied: { label: "ไม่ว่าง", tone: "occupied" },
  reserved: { label: "จองแล้ว", tone: "reserved" },
  maintenance: { label: "ปิดปรับปรุง", tone: "maintenance" },
};

export function tableTimeStatus(expectedEndAt, now = new Date()) {
  if (!expectedEndAt) return { kind: "unset", deadline: "ยังไม่ได้กำหนด", label: "ยังไม่ได้กำหนดเวลาเลิกเล่น" };
  const target = new Date(expectedEndAt).getTime();
  const current = new Date(now).getTime();
  if (Number.isNaN(target) || Number.isNaN(current)) return { kind: "unset", deadline: "ยังไม่ได้กำหนด", label: "เวลาเลิกเล่นไม่ถูกต้อง" };
  const minutes = Math.ceil((target - current) / 60000);
  if (minutes <= 0) return { kind: "overdue", deadline: "ครบกำหนดแล้ว", label: `เกินเวลา ${Math.abs(minutes)} นาที` };
  if (minutes <= 15) return { kind: "soon", deadline: "ใกล้หมดเวลา", label: `เหลือเวลา ${minutes} นาที` };
  return { kind: "on-time", deadline: "กำลังเล่น", label: `เหลือเวลา ${minutes} นาที` };
}

export function clientFilterTransactions(records, filters = {}) {
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
  const method = filters.method || "";
  const query = String(filters.query || "").trim().toLowerCase();
  return records.filter((record) => {
    const timestamp = new Date(record.paidAt || record.createdAt).getTime();
    const searchable = `${record.reference} ${record.customerName || ""} ${record.customerEmail || ""}`.toLowerCase();
    return timestamp >= from && timestamp <= to && (!method || record.paymentMethod === method) && (!query || searchable.includes(query));
  });
}

export function summarizeTransactions(records = []) {
  return records.reduce((summary, record) => {
    const amount = Number(record.amount || 0);
    const method = record.paymentMethod || "other";
    summary.count += 1;
    summary.total += amount;
    const current = summary.methods[method] || { count: 0, total: 0 };
    summary.methods[method] = { count: current.count + 1, total: current.total + amount };
    return summary;
  }, { count: 0, total: 0, methods: {} });
}

export function shiftSummaryCsv(records = [], methodLabels = {}) {
  const headers = ["วันที่เวลา", "เลขอ้างอิง", "ลูกค้า", "ช่องทางชำระเงิน", "ยอดเงิน"];
  const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = records.map((record) => [
    record.paidAt || record.createdAt || "",
    record.reference || "",
    record.customerName || "ลูกค้าทั่วไป",
    methodLabels[record.paymentMethod] || record.paymentMethod || "อื่นๆ",
    Number(record.amount || 0).toFixed(2),
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

export function receiptMailto(receipt) {
  const subject = encodeURIComponent(`ใบเสร็จ ${receipt.receiptNumber} | Crazy Snooker Club`);
  const lines = [
    "ขอบคุณที่ใช้บริการ Crazy Snooker Club",
    `ใบเสร็จเลขที่: ${receipt.receiptNumber}`,
    `อ้างอิง: ${receipt.reference}`,
    `ยอดชำระ: ${Number(receipt.amount).toFixed(2)} บาท`,
    `ช่องทางชำระ: ${receipt.paymentMethod}`,
  ];
  return `mailto:${encodeURIComponent(receipt.customerEmail || "")}?subject=${subject}&body=${encodeURIComponent(lines.join("\n"))}`;
}
