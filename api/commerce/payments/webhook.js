/* POST /api/commerce/payments/webhook — Razorpay payment webhook.

   This is the SOURCE OF TRUTH for fulfilment (never the client success
   callback). It is authenticated by HMAC signature, not a Firebase token, so
   bodyParser is disabled to verify the exact raw bytes. Every event is recorded
   in webhook_events for idempotency; a duplicate is acked without re-processing.
   On payment.captured/order.paid the payment is marked captured and the order
   moves to `confirmed`.

   NOTE: server-initiated push (FCM) to notify buyer/seller needs a server FCM
   sender (service account), which this project intentionally does not have yet
   — the status change is reflected when the client next loads its orders. That
   push is a B3/B4 extension point, not built here. */

import { getSql } from "../../_lib/db.js";
import { verifyWebhookSignature } from "../../_lib/razorpay.js";
import { sendError } from "../../_lib/http.js";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: { message: "POST only" } });

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: { message: "Webhook not configured" } });

    const raw = await readRawBody(req);
    if (!verifyWebhookSignature(raw, req.headers["x-razorpay-signature"], secret)) {
      return res.status(401).json({ error: { message: "Invalid signature" } });
    }

    let event;
    try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: { message: "Invalid JSON" } }); }
    const eventId = req.headers["x-razorpay-event-id"] || event.id || `${event.event}:${raw.length}`;

    const sql = getSql();
    // Idempotency: first writer wins; a duplicate delivery is acked as no-op.
    const inserted = await sql`
      insert into webhook_events (provider, event_id, payload)
      values ('razorpay', ${eventId}, ${sql.json(event)})
      on conflict (provider, event_id) do nothing
      returning id`;
    if (!inserted.length) return res.status(200).json({ ok: true, duplicate: true });

    await handleEvent(sql, event);
    await sql`update webhook_events set processed_at = now() where provider = 'razorpay' and event_id = ${eventId}`;
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendError(res, err, "commerce/webhook");
  }
}

async function handleEvent(sql, event) {
  if (event.event !== "payment.captured" && event.event !== "order.paid") return;

  const entity = event.payload?.payment?.entity;
  const rzpOrderId = entity?.order_id;
  const rzpPaymentId = entity?.id;
  if (!rzpOrderId) return;

  await sql.begin(async (tx) => {
    const [payment] = await tx`select * from payments where provider_order_id = ${rzpOrderId} for update`;
    if (!payment || payment.status === "captured") return; // unknown or already fulfilled

    await tx`update payments set status = 'captured', provider_payment_id = ${rzpPaymentId}, raw = ${tx.json(event)} where id = ${payment.id}`;
    await tx`update orders set status = 'confirmed' where id = ${payment.order_id} and status in ('pending_payment', 'paid')`;
  });
}
