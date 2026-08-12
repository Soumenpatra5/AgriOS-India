/* /api/commerce/orders/[id]
     GET   — order detail + items. Buyer or seller only.
     PATCH — advance the lifecycle via { action }: seller ship/deliver,
             buyer cancel (unpaid → releases reserved stock). The status guard
             runs inside the transaction so concurrent transitions can't
             double-apply (e.g. release stock twice). */

import { getSql } from "../../_lib/db.js";
import { requireUser } from "../../_lib/requireUser.js";
import { sendError, HttpError } from "../../_lib/http.js";
import { publicOrder } from "../../_lib/orders.js";
import { resolveTransition } from "../../_lib/orderTransitions.js";
import { refundPayment } from "../../_lib/razorpay.js";

export default async function handler(req, res) {
  try {
    const sql = getSql();
    const user = await requireUser(req, res, sql);
    if (!user) return;

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: { message: "id required" } });

    if (req.method === "GET") return getOne(res, sql, user, id);
    if (req.method === "PATCH") return transition(req, res, sql, user, id);
    return res.status(405).json({ error: { message: "GET or PATCH only" } });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: { message: err.message } });
    return sendError(res, err, "commerce/orders/[id]");
  }
}

function roleOf(order, user) {
  if (order.seller_id === user.id) return "seller";
  if (order.buyer_id === user.id) return "buyer";
  return null;
}

async function getOne(res, sql, user, id) {
  const [order] = await sql`select * from orders where id = ${id}`;
  if (!order) return res.status(404).json({ error: { message: "Not found" } });
  if (!roleOf(order, user)) return res.status(403).json({ error: { message: "Forbidden" } });
  const items = await sql`select * from order_items where order_id = ${id}`;
  return res.status(200).json({ order: publicOrder(order, items) });
}

async function transition(req, res, sql, user, id) {
  const action = req.body?.action;

  const [order] = await sql`select * from orders where id = ${id}`;
  if (!order) return res.status(404).json({ error: { message: "Not found" } });
  const role = roleOf(order, user);
  if (!role) return res.status(403).json({ error: { message: "Forbidden" } });

  const t = resolveTransition(action, order.status, role);
  if (t.error) return res.status(409).json({ error: { message: t.error } });

  // A refund moves money, so issue the Razorpay refund BEFORE the DB write. If
  // it fails we abort and leave the order untouched.
  if (t.refund) {
    const [payment] = await sql`select * from payments where order_id = ${id}`;
    if (!payment || payment.status !== "captured") {
      return res.status(409).json({ error: { message: "No captured payment to refund" } });
    }
    await refundPayment(payment.provider_payment_id, { amountPaise: Number(payment.amount_paise) });
    await sql.begin(async (tx) => {
      const [moved] = await tx`update orders set status = ${t.to} where id = ${id} and status = ${order.status} returning id`;
      if (!moved) throw new HttpError(409, "Order changed, please retry");
      await tx`update payments set status = 'refunded' where id = ${payment.id}`;
      const items = await tx`select listing_id, quantity from order_items where order_id = ${id}`;
      for (const it of items) {
        await tx`update listings set qty_available = qty_available + ${it.quantity} where id = ${it.listing_id}`;
      }
    });
  } else {
    await sql.begin(async (tx) => {
      // Guarded update: only transitions if the status is still what we checked,
      // so a racing transition can't cause a double stock release.
      const [moved] = await tx`
        update orders set status = ${t.to}
        where id = ${id} and status = ${order.status}
        returning id`;
      if (!moved) throw new HttpError(409, "Order changed, please retry");

      if (t.releaseStock) {
        const items = await tx`select listing_id, quantity from order_items where order_id = ${id}`;
        for (const it of items) {
          await tx`update listings set qty_available = qty_available + ${it.quantity} where id = ${it.listing_id}`;
        }
      }
    });
  }

  const [updated] = await sql`select * from orders where id = ${id}`;
  const items = await sql`select * from order_items where order_id = ${id}`;
  return res.status(200).json({ order: publicOrder(updated, items) });
}
