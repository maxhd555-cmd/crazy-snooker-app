import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  SecretsKeyError,
  decryptSecrets,
  encryptSecrets,
  generateMasterKey,
  loadEncryptedSecrets,
  readSecretsFile,
  writeSecretsFile,
} from "../server/secureConfig.mjs";

let tmpDir;
let secretsPath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-secrets-"));
  secretsPath = path.join(tmpDir, "secrets.enc.json");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("encrypted configuration store", () => {
  it("round-trips PromptPay and LINE credentials through AES-256-GCM", () => {
    const key = generateMasterKey();
    writeSecretsFile(
      {
        PROMPTPAY_RECIPIENT: "0812345678",
        LINE_CHANNEL_ACCESS_TOKEN: "line-token-abc",
        LINE_NOTIFY_TO: "U1234567890abcdef",
      },
      key,
      secretsPath,
    );

    // ไฟล์บนดิสก์ต้องไม่มีค่าจริงหลงเหลือ
    const rawOnDisk = fs.readFileSync(secretsPath, "utf8");
    expect(rawOnDisk).not.toContain("0812345678");
    expect(rawOnDisk).not.toContain("line-token-abc");

    const loaded = readSecretsFile(key, secretsPath);
    expect(loaded).toEqual({
      PROMPTPAY_RECIPIENT: "0812345678",
      LINE_CHANNEL_ACCESS_TOKEN: "line-token-abc",
      LINE_NOTIFY_TO: "U1234567890abcdef",
    });
  });

  it("rejects keys outside the managed allow-list", () => {
    const key = generateMasterKey();
    expect(() => encryptSecrets({ DATABASE_URL: "mysql://x" }, key)).toThrow(SecretsKeyError);
  });

  it("fails to decrypt with the wrong master key", () => {
    const key = generateMasterKey();
    const otherKey = generateMasterKey();
    writeSecretsFile({ PROMPTPAY_RECIPIENT: "0812345678" }, key, secretsPath);
    expect(() => readSecretsFile(otherKey, secretsPath)).toThrow(SecretsKeyError);
  });

  it("loads secrets into env without overwriting existing values", () => {
    const key = generateMasterKey();
    writeSecretsFile({ PROMPTPAY_RECIPIENT: "0899999999", LINE_NOTIFY_TO: "Uabc" }, key, secretsPath);

    const env = { SECRETS_KEY: key, PROMPTPAY_RECIPIENT: "0800000000" };
    const result = loadEncryptedSecrets({ env, filePath: secretsPath });

    expect(env.PROMPTPAY_RECIPIENT).toBe("0800000000"); // env เดิมชนะ
    expect(env.LINE_NOTIFY_TO).toBe("Uabc"); // เติมเฉพาะที่ยังว่าง
    expect(result.loaded).toEqual(["LINE_NOTIFY_TO"]);
  });

  it("is a safe no-op when the secrets file is missing", () => {
    const env = { SECRETS_KEY: generateMasterKey() };
    const result = loadEncryptedSecrets({ env, filePath: path.join(tmpDir, "nope.json") });
    expect(result.loaded).toEqual([]);
    expect(result.source).toBeNull();
  });

  it("validates the master key format", () => {
    expect(() => decryptSecrets({ iv: "a", tag: "b", data: "c" }, "not-hex")).toThrow(SecretsKeyError);
  });
});
