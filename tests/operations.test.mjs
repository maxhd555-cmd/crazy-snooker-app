import { describe, expect, it } from "vitest";
import { clientFilterTransactions, receiptMailto, shiftSummaryCsv, summarizeTransactions, tableStates, tableTimeStatus } from "../src/lib/operations.mjs";
import { buildReceipt, filterTransactions } from "../server/transactions.mjs";

const records = [
  { reference: "CS-1", customerName: "มณี", amount: 100, paymentMethod: "cash", createdAt: "2026-08-20T10:00:00.000Z", paidAt: "2026-08-20T10:00:00.000Z" },
  { reference: "CS-2", customerName: "วิชัย", amount: 250, paymentMethod: "promptpay", createdAt: "2026-08-22T11:00:00.000Z", paidAt: "2026-08-22T11:00:00.000Z" },
];

describe("live table status", () => {
  it("exposes accessible labels for available and occupied tables", () => {
    expect(tableStates.available.label).toBe("ว่าง");
    expect(tableStates.occupied.label).toBe("ไม่ว่าง");
  });

  it("labels an occupied table as on-time, near-end, or overdue from a stable clock", () => {
    const now = new Date("2026-08-25T10:00:00.000Z");
    expect(tableTimeStatus("2026-08-25T10:25:00.000Z", now)).toMatchObject({ kind: "on-time", label: "เหลือเวลา 25 นาที" });
    expect(tableTimeStatus("2026-08-25T10:08:00.000Z", now)).toMatchObject({ kind: "soon", label: "เหลือเวลา 8 นาที" });
    expect(tableTimeStatus("2026-08-25T09:58:00.000Z", now)).toMatchObject({ kind: "overdue", label: "เกินเวลา 2 นาที" });
  });
});

describe("receipt delivery", () => {
  it("creates a mail client URL from the receipt record", () => {
    const receipt = buildReceipt({ ...records[1], customerEmail: "member@example.com", staffName: "แอน", items: [{ name: "ค่าโต๊ะ", quantity: 1, price: 250 }] });
    expect(receipt.receiptNumber).toBe("R-CS-2");
    expect(receiptMailto(receipt)).toContain("mailto:member%40example.com");
    expect(receiptMailto(receipt)).toContain("CS-2");
  });
});

describe("transaction-history filters", () => {
  it("combines date, payment method, and customer query filters", () => {
    const filters = { from: "2026-08-22", to: "2026-08-22", method: "promptpay", query: "วิชัย" };
    expect(clientFilterTransactions(records, filters).map((record) => record.reference)).toEqual(["CS-2"]);
    expect(filterTransactions(records, filters).map((record) => record.reference)).toEqual(["CS-2"]);
  });
});

describe("shift summary", () => {
  it("exports the filtered transaction set as escaped Thai CSV", () => {
    const csv = shiftSummaryCsv([
      { paidAt: "2026-08-22T11:00:00.000Z", reference: "CS-2", customerName: 'วิชัย "VIP"', paymentMethod: "promptpay", amount: 250 },
    ], { promptpay: "PromptPay" });
    expect(csv).toContain('"วันที่เวลา","เลขอ้างอิง","ลูกค้า","ช่องทางชำระเงิน","ยอดเงิน"');
    expect(csv).toContain('"วิชัย ""VIP""","PromptPay","250.00"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });


  it("summarizes the visible transaction set by count, amount, and payment method", () => {
    const summary = summarizeTransactions([
      { amount: 100, paymentMethod: "cash" },
      { amount: 120, paymentMethod: "promptpay" },
      { amount: 80, paymentMethod: "cash" },
    ]);
    expect(summary).toEqual({ count: 3, total: 300, methods: { cash: { count: 2, total: 180 }, promptpay: { count: 1, total: 120 } } });
  });
});
