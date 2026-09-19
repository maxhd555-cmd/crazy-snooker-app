import { timingSafeEqual } from "node:crypto";

export function isValidAdminKey(providedKey, configuredKey = process.env.ADMIN_FEEDBACK_KEY) {
  const provided = String(providedKey || "");
  const configured = String(configuredKey || "");
  if (!configured || !provided || provided.length !== configured.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(configured));
}

export function requireAdminKey(req, res, next) {
  if (!isValidAdminKey(req.get("x-admin-key"))) return res.status(401).json({ error: "ต้องใช้รหัสผู้ดูแลระบบ" });
  next();
}
