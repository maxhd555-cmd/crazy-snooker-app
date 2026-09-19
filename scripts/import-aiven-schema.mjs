// One-off: import database/init.sql into Aiven MySQL over TLS.
// Usage: DATABASE_URL="mysql://user:pass@host:port/db" DATABASE_SSL=true node scripts/import-aiven-schema.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(root, "database", "init.sql"), "utf8");

const url = new URL(process.env.DATABASE_URL);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, "") || "defaultdb",
  ssl: { rejectUnauthorized: false },
  multipleStatements: true,
});

console.log("connected:", url.hostname);
const [result] = await connection.query(sql);
const statements = Array.isArray(result) ? result.length : 1;
console.log(`schema imported (${statements} statements)`);

const [tables] = await connection.query("SHOW TABLES");
console.log("tables:", tables.map((row) => Object.values(row)[0]).join(", "));
const [rows] = await connection.query("SELECT id, label, status FROM club_tables ORDER BY id");
console.log("club_tables rows:", rows.length);
await connection.end();
