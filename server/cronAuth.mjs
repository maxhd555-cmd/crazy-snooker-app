import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "app_session_id";
const cronPrefix = "cron_";
const userInfoPath = "/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt";

function errorWithStatus(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function decodeBase64Url(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function readCookie(cookieHeader, name) {
  return String(cookieHeader || "").split(";").map((item) => item.trim()).reduce((found, item) => {
    if (found) return found;
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator) !== name) return "";
    return decodeURIComponent(item.slice(separator + 1));
  }, "");
}

export function verifySessionJwt(token, secret = process.env.JWT_SECRET) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || !secret) throw errorWithStatus("คุกกี้งานตามรอบไม่ถูกต้อง", 403);
  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  const provided = decodeBase64Url(parts[2]);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) throw errorWithStatus("คุกกี้งานตามรอบไม่ถูกต้อง", 403);
  let payload;
  try { payload = JSON.parse(decodeBase64Url(parts[1]).toString("utf8")); }
  catch { throw errorWithStatus("คุกกี้งานตามรอบไม่ถูกต้อง", 403); }
  if (!payload?.openId || !payload?.appId || !payload?.name || (payload.exp && Number(payload.exp) * 1000 < Date.now())) throw errorWithStatus("คุกกี้งานตามรอบหมดอายุหรือไม่ถูกต้อง", 403);
  return payload;
}

async function getUserInfoWithJwt(token) {
  const baseUrl = process.env.OAUTH_SERVER_URL;
  const projectId = process.env.VITE_APP_ID;
  if (!baseUrl || !projectId) throw errorWithStatus("ระบบยืนยันงานตามรอบยังไม่ได้ตั้งค่า", 500);
  const response = await fetch(new URL(userInfoPath, baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jwtToken: token, projectId }),
  });
  if (!response.ok) throw errorWithStatus("ไม่สามารถตรวจสอบตัวตนงานตามรอบได้", 403);
  return response.json();
}

export async function authenticateCronRequest(req, { getUserInfo = getUserInfoWithJwt } = {}) {
  const bearer = String(req.get?.("authorization") || req.headers?.authorization || "");
  const token = readCookie(req.get?.("cookie") || req.headers?.cookie, cookieName) || (bearer.startsWith("Bearer ") ? bearer.slice(7) : "");
  const session = verifySessionJwt(token);
  if (!String(session.openId).startsWith(cronPrefix)) throw errorWithStatus("เส้นทางนี้อนุญาตเฉพาะงานตามรอบ", 403);
  const userInfo = await getUserInfo(token);
  if (!userInfo?.taskUid) throw errorWithStatus("งานตามรอบไม่มี task UID", 403);
  return { isCron: true, taskUid: String(userInfo.taskUid), openId: String(userInfo.openId || session.openId) };
}
