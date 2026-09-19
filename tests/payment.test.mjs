import { describe, expect, it } from "vitest";
import generatePayload from "promptpay-qr";

describe("PromptPay QR payload", () => {
  it("creates an EMV-style payload for a valid Thai mobile recipient and amount", () => {
    const payload = generatePayload("0812345678", { amount: 125 });
    expect(payload).toContain("000201");
    expect(payload).toContain("5303764");
    expect(payload).toContain("6304");
  });
});
