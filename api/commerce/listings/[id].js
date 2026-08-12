/* /api/commerce/listings/[id]
     GET    — listing detail + media. Active listings are visible to anyone;
              non-active (draft/paused/…) only to their owner.
     PATCH  — edit / publish / pause. Owner only. Partial body.
     DELETE — soft-delete (sets deleted_at). Owner only. */

import { getSql } from "../../_lib/db.js";
import { requireUser } from "../../_lib/requireUser.js";
import { sendError } from "../../_lib/http.js";
import { validateListingInput, publicListing } from "../../_lib/listings.js";

export default async function handler(req, res) {
  try {
    const sql = getSql();
    const user = await requireUser(req, res, sql);
    if (!user) return;

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: { message: "id required" } });

    if (req.method === "GET")    return await getOne(res, sql, user, id);
    if (req.method === "PATCH")  return await update(req, res, sql, user, id);
    if (req.method === "DELETE") return await remove(res, sql, user, id);
    return res.status(405).json({ error: { message: "GET, PATCH or DELETE only" } });
  } catch (err) {
    return sendError(res, err, "commerce/listings/[id]");
  }
}

async function loadMedia(sql, id) {
  return sql`select url, sort from listing_media where listing_id = ${id} order by sort`;
}

async function getOne(res, sql, user, id) {
  const [row] = await sql`
    select l.*, coalesce(u.name, '') as seller_name
    from listings l join users u on u.id = l.seller_id
    where l.id = ${id} and l.deleted_at is null`;
  if (!row) return res.status(404).json({ error: { message: "Not found" } });
  // Non-active listings are private to their owner.
  if (row.status !== "active" && row.seller_id !== user.id) {
    return res.status(404).json({ error: { message: "Not found" } });
  }
  const media = await loadMedia(sql, id);
  return res.status(200).json({ listing: publicListing({ ...row, media }) });
}

async function update(req, res, sql, user, id) {
  const [existing] = await sql`select seller_id from listings where id = ${id} and deleted_at is null`;
  if (!existing) return res.status(404).json({ error: { message: "Not found" } });
  if (existing.seller_id !== user.id) return res.status(403).json({ error: { message: "Forbidden" } });

  const { value, error } = validateListingInput(req.body, { partial: true });
  if (error) return res.status(400).json({ error: { message: error } });

  const { media, ...fields } = value;
  if (Object.keys(fields).length) {
    await sql`update listings set ${sql(fields)} where id = ${id}`;
  }
  // Media, when supplied, replaces the set (an empty array clears it).
  if (req.body && req.body.media !== undefined) {
    await sql`delete from listing_media where listing_id = ${id}`;
    if (media.length) {
      await sql`insert into listing_media ${sql(
        media.map((m) => ({ listing_id: id, url: m.url, sort: m.sort })),
        "listing_id", "url", "sort",
      )}`;
    }
  }

  const [row] = await sql`
    select l.*, coalesce(u.name, '') as seller_name
    from listings l join users u on u.id = l.seller_id
    where l.id = ${id}`;
  const freshMedia = await loadMedia(sql, id);
  return res.status(200).json({ listing: publicListing({ ...row, media: freshMedia }) });
}

async function remove(res, sql, user, id) {
  const [existing] = await sql`select seller_id from listings where id = ${id} and deleted_at is null`;
  if (!existing) return res.status(404).json({ error: { message: "Not found" } });
  if (existing.seller_id !== user.id) return res.status(403).json({ error: { message: "Forbidden" } });

  await sql`update listings set deleted_at = now() where id = ${id}`;
  return res.status(200).json({ ok: true });
}
