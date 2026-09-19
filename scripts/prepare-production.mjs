import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
await mkdir(dist, { recursive: true });
for (const file of ["index.mjs", "notifications.mjs", "transactions.mjs", "integrations.mjs", "receiptEmail.mjs", "feedback.mjs", "adminAccess.mjs", "tables.mjs", "cronAuth.mjs", "secureConfig.mjs", "db.mjs"]) {
  await cp(path.join(root, "server", file), path.join(dist, file === "index.mjs" ? "index.js" : file));
}
