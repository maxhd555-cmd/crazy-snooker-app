export const paymentMethods = ["promptpay", "cash", "wallet", "card"];

export function filterTransactions(records, filters = {}) {
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
  const method = String(filters.method || "").trim();
  const query = String(filters.query || "").trim().toLowerCase();
  return records.filter((record) => {
    const timestamp = new Date(record.paidAt || record.createdAt).getTime();
    const searchable = `${record.reference} ${record.customerName || ""} ${record.customerEmail || ""}`.toLowerCase();
    return timestamp >= from && timestamp <= to
      && (!method || record.paymentMethod === method)
      && (!query || searchable.includes(query));
  }).sort((a, b) => new Date(b.paidAt || b.createdAt) - new Date(a.paidAt || a.createdAt));
}

export function buildReceipt(record) {
  return {
    reference: record.reference,
    receiptNumber: `R-${record.reference}`,
    issuedAt: record.paidAt || record.createdAt,
    paymentMethod: record.paymentMethod,
    amount: record.amount,
    customerName: record.customerName || "ลูกค้าทั่วไป",
    customerEmail: record.customerEmail || "",
    staffName: record.staffName || "พนักงานหน้าร้าน",
    items: record.items || [],
  };
}
