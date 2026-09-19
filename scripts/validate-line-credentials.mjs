import { validateLineCredentials } from "../server/notifications.mjs";

const result = await validateLineCredentials();
if (!result.valid) {
  console.error(`LINE_CREDENTIAL_VALIDATION_FAILED reason=${result.reason || "unknown"}${result.status ? ` status=${result.status}` : ""}`);
  process.exit(1);
}
console.log("LINE_CREDENTIAL_VALIDATION_OK bot_info_access=yes recipient_configured=yes");
