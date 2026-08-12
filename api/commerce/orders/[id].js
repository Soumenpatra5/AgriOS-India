/* /api/commerce/orders/[id]
     GET — order detail + items. Visible only to the order's buyer or seller. */

import { getSql } from "../../_lib/db.js";
import { requireUser } from "../../_lib/requireUser.js";
import { sendError } from "../../_lib/http.js";
import { publicOrder } from "../../_lib/orders.js";

export default async function handler(req, res) {
  try {
    const sql = getSql();
    const user = await requireUser(req, res, sql);
    if (!user) return;

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: { message: "id required" } });
    if (req.method !== "GET") return res.status(405).json({ error: { message: "GET only" } });

    const [order] = await sql`select * from orders where id = ${id}`;
    if (!order) return res.status(404).json({ error: { message: "Not found" } });
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }
    const items = await sql`select * from order_items where order_id = ${id}`;
    return res.status(200).json({ order: publicOrder(order, items) });
  } catch (err) {
    return sendError(res, err, "commerce/orders/[id]");
  }
}
