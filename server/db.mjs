// Shared MySQL pool factory with optional TLS for managed databases (Aiven, etc.)
// - DATABASE_URL  : mysql://user:pass@host:port/dbname
// - DATABASE_SSL  : "true" เปิด TLS (ไม่ต้องใช้ CA ไฟล์)
// - DATABASE_CA   : PEM ของ CA (เช่น Aiven CA cert) — วางเป็นหลายบรรทัดได้เลย
import mysql from "mysql2/promise";

export function createDatabasePool(url = process.env.DATABASE_URL) {
  if (!url) {
    const error = new Error("ระบบฐานข้อมูลยังไม่พร้อมใช้งาน");
    error.status = 503;
    throw error;
  }
  const options = { uri: url, waitForConnections: true, connectionLimit: 5, queueLimit: 0 };
  const wantsSsl = String(process.env.DATABASE_SSL || "").toLowerCase() === "true" || Boolean(process.env.DATABASE_CA);
  if (wantsSsl) {
    const ca = String(process.env.DATABASE_CA || "").trim();
    options.ssl = ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
  }
  return mysql.createPool(options);
}
