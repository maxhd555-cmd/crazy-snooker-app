// Encrypted configuration store (AES-256-GCM) for sensitive integration values.
// Keeps PromptPay recipient, LINE OA credentials, and transactional-email keys
// encrypted at rest while still exposing them through process.env at runtime.
//
// Usage model:
//   - Store encrypted values in <root>/config/secrets.enc.json (git-ignored).
//   - Provide the 64-char hex master key via SECRETS_KEY env var at runtime.
//   - This module decrypts on boot and only fills env vars that are NOT already
//     set, so plain env vars always win (safe for local dev and platform envs).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SECRETS_PATH = path.resolve(__dirname, "..", "config", "secrets.enc.json");

/** Env keys that are allowed to be supplied through the encrypted store. */
const MANAGED_KEYS = [
  "PROMPTPAY_RECIPIENT",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "LINE_NOTIFY_TO",
  "RESEND_API_KEY",
  "RECEIPT_EMAIL_FROM",
];

const KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

export class SecretsKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = "SecretsKeyError";
  }
}

/**
 * Validate and normalize a hex master key.
 * @param {string} hex 64-char hex string (32 bytes)
 * @returns {Buffer}
 */
export function parseMasterKey(hex) {
  const normalized = String(hex || "").trim();
  if (!KEY_PATTERN.test(normalized)) {
    throw new SecretsKeyError("SECRETS_KEY ต้องเป็นเลขฐานสิบหก 64 ตัวอักษร (32 bytes)");
  }
  return Buffer.from(normalized, "hex");
}

/** Generate a fresh random master key (hex). */
export function generateMasterKey() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Encrypt a { ENV_KEY: value } map into a self-describing payload.
 * @param {Record<string,string>} secrets
 * @param {string} masterKeyHex
 */
export function encryptSecrets(secrets, masterKeyHex) {
  const key = parseMasterKey(masterKeyHex);
  const clean = {};
  for (const [name, value] of Object.entries(secrets || {})) {
    if (!MANAGED_KEYS.includes(name)) {
      throw new SecretsKeyError(`คีย์ ${name} ไม่อยู่ในรายการที่อนุญาต (${MANAGED_KEYS.join(", ")})`);
    }
    const text = String(value ?? "").trim();
    if (text) clean[name] = text;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(clean), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  };
}

/**
 * Decrypt a payload produced by encryptSecrets.
 * @param {{iv:string, tag:string, data:string}} payload
 * @param {string} masterKeyHex
 * @returns {Record<string,string>}
 */
export function decryptSecrets(payload, masterKeyHex) {
  const key = parseMasterKey(masterKeyHex);
  if (!payload || !payload.iv || !payload.tag || !payload.data) {
    throw new SecretsKeyError("รูปแบบไฟล์ secrets ไม่ถูกต้อง");
  }
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]);
    const parsed = JSON.parse(decrypted.toString("utf8"));
    const clean = {};
    for (const name of MANAGED_KEYS) {
      if (typeof parsed[name] === "string" && parsed[name].trim()) clean[name] = parsed[name].trim();
    }
    return clean;
  } catch (error) {
    if (error instanceof SecretsKeyError) throw error;
    throw new SecretsKeyError("ถอดรหัส secrets ไม่สำเร็จ — ตรวจสอบ SECRETS_KEY และไฟล์ secrets.enc.json");
  }
}

/** Write encrypted secrets to disk (mode 600 best-effort on POSIX). */
export function writeSecretsFile(secrets, masterKeyHex, filePath = DEFAULT_SECRETS_PATH) {
  const payload = encryptSecrets(secrets, masterKeyHex);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { mode: 0o600 });
  return filePath;
}

/** Read and decrypt the secrets file; returns {} when the file is absent. */
export function readSecretsFile(masterKeyHex, filePath = DEFAULT_SECRETS_PATH) {
  if (!fs.existsSync(filePath)) return {};
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return decryptSecrets(payload, masterKeyHex);
}

/**
 * Load encrypted secrets into process.env without overwriting existing values.
 * Safe no-op when the secrets file or SECRETS_KEY is missing.
 * @returns {{loaded: string[], source: (string|null)}}
 */
export function loadEncryptedSecrets({
  env = process.env,
  filePath = process.env.SECRETS_FILE || DEFAULT_SECRETS_PATH,
} = {}) {
  if (!fs.existsSync(filePath)) return { loaded: [], source: null };
  const keyHex = env.SECRETS_KEY;
  if (!keyHex) {
    console.warn(`[secure-config] พบไฟล์ secrets แต่ไม่มี SECRETS_KEY — ข้ามการถอดรหัส (${filePath})`);
    return { loaded: [], source: null };
  }
  const secrets = readSecretsFile(keyHex, filePath);
  const loaded = [];
  for (const [name, value] of Object.entries(secrets)) {
    if (!String(env[name] || "").trim()) {
      env[name] = value;
      loaded.push(name);
    }
  }
  if (loaded.length) {
    console.log(`[secure-config] โหลดค่าลับจากไฟล์เข้ารหัสแล้ว: ${loaded.join(", ")}`);
  }
  return { loaded, source: filePath };
}

export const SECRETS_FILE_PATH = DEFAULT_SECRETS_PATH;
export const MANAGED_SECRET_KEYS = [...MANAGED_KEYS];
