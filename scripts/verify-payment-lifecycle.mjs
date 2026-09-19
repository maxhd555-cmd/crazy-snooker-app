import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 3107;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("node", ["dist/index.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), PROMPTPAY_RECIPIENT: "0812345678" },
  stdio: ["ignore", "pipe", "pipe"],
});

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/transactions`);
      if (response.ok) return;
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw lastError || new Error("isolated payment test server did not start");
}

try {
  await waitForServer();
  const createResponse = await fetch(`${baseUrl}/api/payments/promptpay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 125, purpose: "uat-isolated-payment" }),
  });
  assert.equal(createResponse.status, 200, "isolated PromptPay QR creation must succeed");
  const payment = await createResponse.json();
  assert.match(payment.reference, /^CS/, "payment must receive a reference");
  assert.ok(payment.payload.length > 20, "payment must return a QR payload");

  const confirmResponse = await fetch(`${baseUrl}/api/payments/${payment.reference}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerName: "[TEST] UAT", customerEmail: "uat@example.test", items: [{ name: "UAT item", quantity: 1, price: 125 }] }),
  });
  assert.equal(confirmResponse.status, 200, "isolated payment confirmation must succeed");
  const confirmed = await confirmResponse.json();
  assert.equal(confirmed.status, "verified", "confirmation must mark the payment verified");
  assert.equal(confirmed.receipt.amount, 125, "receipt must preserve the paid amount");
  assert.equal(confirmed.receipt.customerEmail, "uat@example.test", "receipt must preserve its email destination");
  console.log("PAYMENT_LIFECYCLE_ISOLATED_OK qr=yes confirmation=yes receipt=yes no_live_payment=yes");
} finally {
  server.kill("SIGTERM");
}
