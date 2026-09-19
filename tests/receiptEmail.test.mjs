import { describe, expect, it } from "vitest";
import { buildReceiptEmail, sendReceiptEmail } from "../server/receiptEmail.mjs";

const receipt = { reference: "CS-EMAIL-001", receiptNumber: "R-CS-EMAIL-001", amount: 245, customerName: "ลูกค้า <ทดสอบ>", paymentMethod: "cash", items: [{ name: "ค่าโต๊ะ", quantity: 1, price: 200 }, { name: "น้ำดื่ม", quantity: 3, price: 15 }] };
const configuredEnv = { RESEND_API_KEY: "re_test_key", RECEIPT_EMAIL_FROM: "Crazy Snooker <receipts@example.test>" };

describe("receipt email sender", () => {
  it("builds a Thai receipt email with escaped customer content and deterministic idempotency key", () => {
    const message = buildReceiptEmail(receipt, "CUSTOMER@example.com", configuredEnv);
    expect(message).toMatchObject({ from: configuredEnv.RECEIPT_EMAIL_FROM, to: "customer@example.com", subject: "ใบเสร็จรับเงิน R-CS-EMAIL-001 | Crazy Snooker" });
    expect(message.text).toContain("ยอดชำระ");
    expect(message.html).toContain("ลูกค้า &lt;ทดสอบ&gt;");
    expect(message.idempotencyKey).toContain("CS-EMAIL-001");
  });

  it("blocks sending before service configuration without making a network call", async () => {
    let called = false;
    try { await sendReceiptEmail({ receipt, recipient: "customer@example.com", env: {}, fetchImpl: async () => { called = true; } }); } catch (error) { expect(error.status).toBe(503); }
    expect(called).toBe(false);
  });

  it("sends the documented Resend request with auth, user agent and idempotency protection", async () => {
    const calls = [];
    const result = await sendReceiptEmail({ receipt, recipient: "customer@example.com", env: configuredEnv, fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ id: "email_123" }) }; } });
    expect(result).toEqual({ delivered: true, providerMessageId: "email_123" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].init.headers).toMatchObject({ Authorization: "Bearer re_test_key", "User-Agent": "crazy-snooker-receipts/1.0" });
    expect(calls[0].init.headers["Idempotency-Key"]).toContain("CS-EMAIL-001");
  });
});
