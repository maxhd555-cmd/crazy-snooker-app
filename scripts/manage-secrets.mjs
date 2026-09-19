#!/usr/bin/env node
// CLI for managing the encrypted secrets store (config/secrets.enc.json).
//
//   node scripts/manage-secrets.mjs generate-key
//   node scripts/manage-secrets.mjs set <KEY> <value>      (uses SECRETS_KEY)
//   node scripts/manage-secrets.mjs list                   (uses SECRETS_KEY, masked)
//   node scripts/manage-secrets.mjs check                  (no key needed)
//
// Allowed keys: PROMPTPAY_RECIPIENT, LINE_CHANNEL_ACCESS_TOKEN, LINE_NOTIFY_TO,
//               RESEND_API_KEY, RECEIPT_EMAIL_FROM

import {
  MANAGED_SECRET_KEYS,
  SECRETS_FILE_PATH,
  SecretsKeyError,
  generateMasterKey,
  readSecretsFile,
  writeSecretsFile,
} from "../server/secureConfig.mjs";
import fs from "node:fs";

const [, , command, key, ...rest] = process.argv;
const value = rest.join(" ");

function requireMasterKey() {
  const hex = process.env.SECRETS_KEY;
  if (!hex) {
    console.error("ต้องตั้ง SECRETS_KEY ก่อน (ใช้คีย์จากคำสั่ง generate-key)");
    process.exit(1);
  }
  return hex;
}

function mask(text) {
  const s = String(text || "");
  if (s.length <= 4) return "****";
  return `${s.slice(0, 2)}${"*".repeat(Math.max(4, s.length - 4))}${s.slice(-2)}`;
}

try {
  switch (command) {
    case "generate-key": {
      console.log(generateMasterKey());
      console.error("เก็บคีย์นี้ไว้ใน SECRETS_KEY (ห้าม commit) — ใช้ถอดรหัส config/secrets.enc.json");
      break;
    }
    case "set": {
      if (!key || !value) {
        console.error(`ใช้งาน: node scripts/manage-secrets.mjs set <${MANAGED_SECRET_KEYS.join("|")}> <value>`);
        process.exit(1);
      }
      if (!MANAGED_SECRET_KEYS.includes(key)) {
        console.error(`คีย์ ${key} ไม่ได้รับอนุญาต — ใช้ได้เฉพาะ: ${MANAGED_SECRET_KEYS.join(", ")}`);
        process.exit(1);
      }
      const hex = requireMasterKey();
      const current = readSecretsFile(hex);
      current[key] = value.trim();
      writeSecretsFile(current, hex);
      console.log(`SECRETS_SET ${key}=${mask(value)} -> ${SECRETS_FILE_PATH}`);
      break;
    }
    case "list": {
      const hex = requireMasterKey();
      const secrets = readSecretsFile(hex);
      const names = Object.keys(secrets);
      if (!names.length) {
        console.log("ยังไม่มีค่าลับในไฟล์");
        break;
      }
      for (const name of names) console.log(`${name}=${mask(secrets[name])}`);
      break;
    }
    case "check": {
      const exists = fs.existsSync(SECRETS_FILE_PATH);
      console.log(`secrets_file=${exists ? "present" : "missing"} path=${SECRETS_FILE_PATH}`);
      console.log(`secrets_key_env=${process.env.SECRETS_KEY ? "set" : "missing"}`);
      break;
    }
    default:
      console.error("คำสั่ง: generate-key | set <KEY> <value> | list | check");
      process.exit(command ? 1 : 0);
  }
} catch (error) {
  if (error instanceof SecretsKeyError) {
    console.error(`SECRETS_ERROR ${error.message}`);
    process.exit(1);
  }
  throw error;
}
