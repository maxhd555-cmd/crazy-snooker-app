import { describe, expect, it } from "vitest";
import { isValidAdminKey } from "../server/adminAccess.mjs";

describe("admin feedback access", () => {
  it("accepts only the exact configured admin key", () => {
    const configuredKey = "test-admin-access-key";
    expect(isValidAdminKey(configuredKey, configuredKey)).toBe(true);
    expect(isValidAdminKey("wrong-key", configuredKey)).toBe(false);
    expect(isValidAdminKey("", configuredKey)).toBe(false);
  });
});
