import { describe, expect, it, vi } from "vitest";
import { validateLineCredentials } from "../server/notifications.mjs";

describe("LINE OA credential validation", () => {
  it("uses the bot-info endpoint without sending a message", async () => {
    const originalToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const originalRecipient = process.env.LINE_NOTIFY_TO;
    const originalFetch = globalThis.fetch;
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
    process.env.LINE_NOTIFY_TO = "test-recipient";
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    try {
      await expect(validateLineCredentials()).resolves.toEqual({ configured: true, valid: true });
      expect(globalThis.fetch).toHaveBeenCalledWith("https://api.line.me/v2/bot/info", { headers: { Authorization: "Bearer test-token" } });
    } finally {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = originalToken;
      process.env.LINE_NOTIFY_TO = originalRecipient;
      globalThis.fetch = originalFetch;
    }
  });
});
