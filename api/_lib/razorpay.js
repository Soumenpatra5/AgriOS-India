/* Razorpay integration — order creation + webhook signature verification.

   No SDK: Razorpay's REST API is a couple of calls, so we use fetch with Basic
   auth (key_id:key_secret). Secrets are server-only. The webhook secret is
   separate from the API key secret. */

import crypto from "node:crypto";

const ORDERS_URL = "https://api.razorpay.com/v1/orders";

export function razorpayConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/* Create a Razorpay order for `amountPaise`. Returns Razorpay's order object
   (notably `id`, which the client hands to Checkout and the webhook echoes back
   as payment.order_id). Throws on misconfiguration or a non-2xx response. */
export async function createRazorpayOrder({ amountPaise, receipt, currency = "INR" }) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("RAZORPAY not configured");

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const resp = await fetch(ORDERS_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount: amountPaise, currency, receipt: String(receipt).slice(0, 40) }),
  });
  if (!resp.ok) {
    let detail = `razorpay order failed (${resp.status})`;
    try { detail = (await resp.json())?.error?.description || detail; } catch { /* opaque */ }
    throw new Error(detail);
  }
  return resp.json();
}

/* Refund a captured payment (full refund by default). Returns Razorpay's refund
   object. Throws on misconfiguration or a non-2xx response. */
export async function refundPayment(providerPaymentId, { amountPaise } = {}) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("RAZORPAY not configured");
  if (!providerPaymentId) throw new Error("no payment to refund");

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const resp = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(providerPaymentId)}/refund`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
    body: JSON.stringify(amountPaise ? { amount: amountPaise } : {}),
  });
  if (!resp.ok) {
    let detail = `razorpay refund failed (${resp.status})`;
    try { detail = (await resp.json())?.error?.description || detail; } catch { /* opaque */ }
    throw new Error(detail);
  }
  return resp.json();
}

/* Verify a Razorpay webhook: HMAC-SHA256(rawBody, webhookSecret) as hex must
   equal the X-Razorpay-Signature header, compared in constant time. rawBody
   MUST be the exact bytes received (hence bodyParser is disabled on the route). */
export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!secret || !signature || rawBody == null) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
