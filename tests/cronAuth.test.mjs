import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authenticateCronRequest, verifySessionJwt } from "../server/cronAuth.mjs";

const base64Url = (value) => Buffer.from(value).toString("base64url");
function signSession(payload, secret) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

describe("Heartbeat cron authentication", () => {
  it("verifies a signed session and rejects tampering", () => {
    const token = signSession({ openId: "cron_demo", appId: "app-1", name: "Scheduled task", exp: Math.floor(Date.now() / 1000) + 60 }, "test-secret");
    expect(verifySessionJwt(token, "test-secret")).toEqual(expect.objectContaining({ openId: "cron_demo" }));
    expect(() => verifySessionJwt(`${token}x`, "test-secret")).toThrow("คุกกี้งานตามรอบไม่ถูกต้อง");
  });

  it("accepts only cron identities with a platform task UID", async () => {
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-secret";
    try {
      const token = signSession({ openId: "cron_demo", appId: "app-1", name: "Scheduled task", exp: Math.floor(Date.now() / 1000) + 60 }, "test-secret");
      const request = { headers: { cookie: `app_session_id=${token}` } };
      await expect(authenticateCronRequest(request, { getUserInfo: async () => ({ openId: "cron_demo", taskUid: "task-123" }) })).resolves.toEqual({ isCron: true, taskUid: "task-123", openId: "cron_demo" });
      const userToken = signSession({ openId: "user_demo", appId: "app-1", name: "User", exp: Math.floor(Date.now() / 1000) + 60 }, "test-secret");
      await expect(authenticateCronRequest({ headers: { cookie: `app_session_id=${userToken}` } }, { getUserInfo: async () => ({ taskUid: "task-123" }) })).rejects.toThrow("เฉพาะงานตามรอบ");
    } finally { process.env.JWT_SECRET = originalSecret; }
  });
});
