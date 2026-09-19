import { describe, expect, it } from "vitest";
import { getIntegrationReadiness } from "../server/integrations.mjs";

describe("external integration readiness", () => {
  it("does not expose values and marks services unavailable when required configuration is absent", () => {
    const readiness = getIntegrationReadiness({});
    expect(readiness.promptpay.ready).toBe(false);
    expect(readiness.receiptEmail.ready).toBe(false);
    expect(JSON.stringify(readiness)).not.toContain("secret");
  });

  it("requires both email credentials and recognizes configured PromptPay", () => {
    const readiness = getIntegrationReadiness({ PROMPTPAY_RECIPIENT: "0812345678", RESEND_API_KEY: "key", RECEIPT_EMAIL_FROM: "receipt@example.test" });
    expect(readiness.promptpay.ready).toBe(true);
    expect(readiness.receiptEmail.ready).toBe(true);
    expect(getIntegrationReadiness({ RESEND_API_KEY: "key" }).receiptEmail.ready).toBe(false);
  });
});
