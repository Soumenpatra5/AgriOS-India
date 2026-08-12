/* Vercel Cron — release stock held by abandoned (unpaid) checkouts.

   Cancels `pending_payment` orders older than the TTL and returns their reserved
   stock to the listings, so an abandoned cart never locks stock forever. Secured
   by CRON_SECRET (set it in Vercel and in the cron's Authorization header). */

import { getSql } from "../../_lib/db.js";
import { sendError } from "../../_lib/http.js";

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured -> allow (dev/preview)
  return (req.headers.authorization || "") === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  try {
    if (!authorized(req)) return res.status(401).json({ error: { message: "Unauthorized" } });
    const sql = getSql();
    const ttlMin = Number(process.env.ORDER_RESERVATION_TTL_MIN || 30);
    const released = await releaseStaleOrders(sql, ttlMin);
    return res.status(200).json({ ok: true, released });
  } catch (err) {
    return sendError(res, err, "commerce/cron/release-stale");
  }
}

/* Cancel unpaid orders older than `ttlMinutes` and return their stock. Each
   order is re-guarded (where status='pending_payment') inside its own
   transaction, so a concurrent payment/transition is never clobbered. Returns
   the number of orders released. Exported for testing. */
export async function releaseStaleOrders(sql, ttlMinutes) {
  const stale = await sql`
    select id from orders
    where status = 'pending_payment'
      and created_at < now() - (${ttlMinutes} * interval '1 minute')`;
  let count = 0;
  for (const { id } of stale) {
    await sql.begin(async (tx) => {
      const [moved] = await tx`update orders set status = 'cancelled' where id = ${id} and status = 'pending_payment' returning id`;
      if (!moved) return; // paid/transitioned in the meantime
      const items = await tx`select listing_id, quantity from order_items where order_id = ${id}`;
      for (const it of items) {
        await tx`update listings set qty_available = qty_available + ${it.quantity} where id = ${it.listing_id}`;
      }
      count++;
    });
  }
  return count;
}
