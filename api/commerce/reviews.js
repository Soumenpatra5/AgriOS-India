/* /api/commerce/reviews
     GET  — reviews + average rating for a subject (?subjectType&subjectId).
     POST — write a review. Allowed only to the BUYER of a DELIVERED order, about
            a listing in that order or its seller. One review per
            (order, reviewer, subjectType). */

import { getSql } from "../_lib/db.js";
import { requireUser } from "../_lib/requireUser.js";
import { sendError } from "../_lib/http.js";
import { validateReviewInput, publicReview, REVIEW_SUBJECT_TYPES } from "../_lib/reviews.js";

export default async function handler(req, res) {
  try {
    const sql = getSql();
    const user = await requireUser(req, res, sql);
    if (!user) return;

    if (req.method === "GET") return await list(req, res, sql);
    if (req.method === "POST") return await create(req, res, sql, user);
    return res.status(405).json({ error: { message: "GET or POST only" } });
  } catch (err) {
    return sendError(res, err, "commerce/reviews");
  }
}

async function list(req, res, sql) {
  const { subjectType, subjectId } = req.query;
  if (!REVIEW_SUBJECT_TYPES.includes(subjectType) || !subjectId) {
    return res.status(400).json({ error: { message: "subjectType and subjectId are required" } });
  }
  const rows = await sql`
    select r.*, coalesce(u.name, '') as reviewer_name
    from reviews r join users u on u.id = r.reviewer_id
    where r.subject_type = ${subjectType} and r.subject_id = ${subjectId}
    order by r.created_at desc limit 100`;
  const [agg] = await sql`
    select count(*)::int as n, coalesce(avg(rating), 0)::float as avg
    from reviews where subject_type = ${subjectType} and subject_id = ${subjectId}`;
  return res.status(200).json({
    reviews: rows.map(publicReview),
    count: agg.n,
    average: Math.round(Number(agg.avg) * 10) / 10,
  });
}

async function create(req, res, sql, user) {
  const { value, error } = validateReviewInput(req.body);
  if (error) return res.status(400).json({ error: { message: error } });

  const [order] = await sql`select * from orders where id = ${value.orderId}`;
  if (!order) return res.status(404).json({ error: { message: "Order not found" } });
  if (order.buyer_id !== user.id) return res.status(403).json({ error: { message: "Only the buyer can review this order" } });
  if (order.status !== "delivered") return res.status(409).json({ error: { message: "You can review only a delivered order" } });

  // The subject must belong to this order.
  if (value.subjectType === "seller") {
    if (value.subjectId !== order.seller_id) return res.status(400).json({ error: { message: "Seller does not match this order" } });
  } else {
    const items = await sql`select listing_id from order_items where order_id = ${order.id}`;
    if (!items.some((i) => i.listing_id === value.subjectId)) {
      return res.status(400).json({ error: { message: "That listing is not part of this order" } });
    }
  }

  try {
    const [row] = await sql`
      insert into reviews (order_id, reviewer_id, subject_type, subject_id, rating, comment)
      values (${order.id}, ${user.id}, ${value.subjectType}, ${value.subjectId}, ${value.rating}, ${value.comment})
      returning *`;
    return res.status(201).json({ review: publicReview({ ...row, reviewer_name: user.name || "" }) });
  } catch (err) {
    if (err?.code === "23505") { // unique_violation
      return res.status(409).json({ error: { message: "You have already reviewed this" } });
    }
    throw err;
  }
}
