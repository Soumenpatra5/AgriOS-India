/* /api/commerce/orders
     GET  — my orders (?role=buyer|seller, default buyer).
     POST — place an order: validate items, atomically reserve stock, create the
            order + items + a Razorpay order, all in one transaction so any
            failure (insufficient stock, Razorpay error) rolls the whole thing
            back and releases the reservation. Returns the order plus the
            Razorpay handle the client hands to Checkout.

   Prices and stock are resolved server-side; the client is never trusted. */

import { getSql } from "../_lib/db.js";
import { requireUser } from "../_lib/requireUser.js";
import { sendError, HttpError } from "../_lib/http.js";
import { validateOrderInput, computeOrderTotals, publicOrder } from "../_lib/orders.js";
import { createRazorpayOrder, razorpayConfigured } from "../_lib/razorpay.js";

export default async function handler(req, res) {
  try {
    const sql = getSql();
    const user = await requireUser(req, res, sql);
    if (!user) return;

    if (req.method === "GET") return list(req, res, sql, user);
    if (req.method === "POST") return create(req, res, sql, user);
    return res.status(405).json({ error: { message: "GET or POST only" } });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: { message: err.message } });
    return sendError(res, err, "commerce/orders");
  }
}

async function list(req, res, sql, user) {
  const role = req.query.role === "seller" ? "seller" : "buyer";
  const rows = role === "seller"
    ? await sql`select * from orders where seller_id = ${user.id} order by created_at desc limit 100`
    : await sql`select * from orders where buyer_id  = ${user.id} order by created_at desc limit 100`;
  return res.status(200).json({ orders: rows.map((o) => publicOrder(o)) });
}

async function create(req, res, sql, user) {
  const { value, error } = validateOrderInput(req.body);
  if (error) return res.status(400).json({ error: { message: error } });
  if (!razorpayConfigured()) {
    return res.status(503).json({ error: { message: "Payments are not configured — set RAZORPAY_KEY_ID/SECRET." } });
  }

  const listingIds = value.items.map((i) => i.listingId);

  const result = await sql.begin(async (tx) => {
    // Lock the listing rows for the duration of the transaction.
    const rows = await tx`select * from listings where id in ${tx(listingIds)} and deleted_at is null for update`;
    const byId = new Map(rows.map((r) => [r.id, r]));

    const lines = [];
    let sellerId = null;
    for (const it of value.items) {
      const listing = byId.get(it.listingId);
      if (!listing) throw new HttpError(400, `Listing ${it.listingId} not found`);
      if (listing.status !== "active") throw new HttpError(409, `"${listing.title}" is not available`);
      if (sellerId && listing.seller_id !== sellerId) throw new HttpError(400, "All items must be from the same seller");
      sellerId = listing.seller_id;
      if (sellerId === user.id) throw new HttpError(400, "You cannot buy your own listing");

      // Atomic reserve: the WHERE guard makes overselling impossible under
      // concurrency — a losing racer gets 0 rows and we abort.
      const [dec] = await tx`
        update listings set qty_available = qty_available - ${it.quantity}
        where id = ${listing.id} and qty_available >= ${it.quantity}
        returning qty_available`;
      if (!dec) throw new HttpError(409, `Not enough stock for "${listing.title}"`);

      lines.push({ listing, quantity: it.quantity });
    }

    const totals = computeOrderTotals(lines);

    const [order] = await tx`
      insert into orders (buyer_id, seller_id, status, subtotal_paise, shipping_paise, total_paise, delivery_addr)
      values (${user.id}, ${sellerId}, 'pending_payment',
              ${totals.subtotal_paise}, ${totals.shipping_paise}, ${totals.total_paise},
              ${tx.json(value.deliveryAddr)})
      returning *`;

    await tx`insert into order_items ${tx(
      totals.items.map((i) => ({ order_id: order.id, ...i })),
      "order_id", "listing_id", "title_snapshot", "unit_price_paise", "quantity", "line_total_paise",
    )}`;

    // External call inside the txn: if Razorpay fails, the whole order + stock
    // reservation rolls back. Fine at this scale; B4 can switch to a
    // reserve→commit→pay→confirm flow with the timeout sweep if volume grows.
    const rzp = await createRazorpayOrder({ amountPaise: totals.total_paise, receipt: order.id });

    await tx`
      insert into payments (order_id, provider, provider_order_id, amount_paise, status)
      values (${order.id}, 'razorpay', ${rzp.id}, ${totals.total_paise}, 'created')`;

    return { order, items: totals.items, rzp };
  });

  return res.status(201).json({
    order: publicOrder(result.order, result.items),
    payment: {
      provider: "razorpay",
      razorpayOrderId: result.rzp.id,
      amountPaise: Number(result.order.total_paise),
      currency: result.order.currency || "INR",
      keyId: process.env.RAZORPAY_KEY_ID, // publishable
    },
  });
}
