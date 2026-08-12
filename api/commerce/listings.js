/* /api/commerce/listings
     GET  — browse/search ACTIVE listings (paginated keyset cursor). Public to
            any authenticated user. Filters: q, category, state, price_max.
     POST — create a listing (the caller becomes its seller).

   Authorization and all pricing/stock come from the server; the client is never
   trusted. Money crosses the wire in rupees and is stored as integer paise. */

import { getSql } from "../_lib/db.js";
import { requireUser } from "../_lib/requireUser.js";
import { sendError } from "../_lib/http.js";
import {
  validateListingInput, publicListing, encodeCursor, decodeCursor, clampLimit,
} from "../_lib/listings.js";

export default async function handler(req, res) {
  try {
    const sql = getSql();
    const user = await requireUser(req, res, sql);
    if (!user) return;

    if (req.method === "GET") return list(req, res, sql, user);
    if (req.method === "POST") return create(req, res, sql, user);
    return res.status(405).json({ error: { message: "GET or POST only" } });
  } catch (err) {
    return sendError(res, err, "commerce/listings");
  }
}

async function list(req, res, sql, user) {
  const { q, category, state, price_max, cursor, mine } = req.query;
  const limit = clampLimit(req.query.limit);

  // `mine=1` -> the caller's own listings across ALL statuses (seller dashboard);
  // otherwise the public feed of active listings.
  const conds = mine
    ? [sql`l.seller_id = ${user.id}`, sql`l.deleted_at is null`]
    : [sql`l.status = 'active'`, sql`l.deleted_at is null`];
  if (category)  conds.push(sql`l.category = ${category}`);
  if (state)     conds.push(sql`l.state = ${state}`);
  if (price_max && Number.isFinite(Number(price_max)))
    conds.push(sql`l.price_paise <= ${Math.round(Number(price_max) * 100)}`);
  if (q)
    conds.push(sql`to_tsvector('simple', coalesce(l.title,'') || ' ' || coalesce(l.description,''))
                   @@ plainto_tsquery('simple', ${q})`);
  if (cursor) {
    const dec = decodeCursor(cursor);
    if (dec) conds.push(sql`(l.created_at, l.id) < (${dec.createdAt}, ${dec.id})`);
  }
  const where = conds.reduce((acc, c) => sql`${acc} and ${c}`);

  const rows = await sql`
    select l.*, coalesce(u.name, '') as seller_name
    from listings l
    join users u on u.id = l.seller_id
    where ${where}
    order by l.created_at desc, l.id desc
    limit ${limit}`;

  const nextCursor = rows.length === limit ? encodeCursor(rows[rows.length - 1]) : null;
  return res.status(200).json({ items: rows.map(publicListing), nextCursor });
}

async function create(req, res, sql, user) {
  const { value, error } = validateListingInput(req.body, { partial: false });
  if (error) return res.status(400).json({ error: { message: error } });

  const { media, ...fields } = value;

  const [listing] = await sql`
    insert into listings ${sql({ ...fields, seller_id: user.id })}
    returning *`;

  if (media.length) {
    await sql`insert into listing_media ${sql(
      media.map((m) => ({ listing_id: listing.id, url: m.url, sort: m.sort })),
      "listing_id", "url", "sort",
    )}`;
  }
  if (!user.is_seller) {
    await sql`update users set is_seller = true where id = ${user.id}`;
  }

  return res.status(201).json({
    listing: publicListing({ ...listing, seller_name: user.name || "", media }),
  });
}
