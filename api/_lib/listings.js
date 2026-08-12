/* Pure helpers for the marketplace listing endpoints — no DB, no I/O, so they
   are unit-testable in isolation. Money crosses the API in rupees (what the UI
   shows) and is stored as integer paise (what Postgres holds). */

export const LISTING_CATEGORIES = [
  "crop", "seed", "feed", "livestock", "equipment", "fertilizer", "pesticide", "other",
];
export const LISTING_UNITS = ["kg", "quintal", "piece", "litre", "dozen", "bag"];
export const LISTING_STATUSES = ["draft", "active", "paused", "sold_out", "archived"];
const MAX_MEDIA = 8;

export function rupeesToPaise(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
export function paiseToRupees(p) {
  return (Number(p) || 0) / 100;
}

const present = (v) => v !== undefined && v !== null && v !== "";

/* Validate/normalize a create (full) or update (partial) listing body.
   Returns { value } on success or { error } with a human-readable message.
   `value.media` is always an array (possibly empty). Scalar fields are only
   present when supplied (partial-friendly for PATCH). */
export function validateListingInput(body, { partial = false } = {}) {
  const b = body || {};
  const out = {};
  const errors = [];

  const check = (key, ok, normalize) => {
    if (!partial || present(b[key])) {
      if (!ok()) errors.push(`${key} is required or invalid`);
      else out[key] = normalize();
    }
  };

  check("title", () => present(b.title), () => String(b.title).trim().slice(0, 200));
  check("category", () => LISTING_CATEGORIES.includes(b.category), () => b.category);
  check("unit", () => LISTING_UNITS.includes(b.unit), () => b.unit);
  check("price", () => rupeesToPaise(b.price) != null, () => rupeesToPaise(b.price));
  // `price` maps to the stored column name
  if ("price" in out) { out.price_paise = out.price; delete out.price; }
  check("qty_available", () => Number.isFinite(Number(b.qty_available)) && Number(b.qty_available) >= 0,
        () => Number(b.qty_available));

  // Optional fields (only when supplied).
  if (present(b.description)) out.description = String(b.description).slice(0, 4000);
  if (present(b.min_order)) {
    const m = Number(b.min_order);
    if (Number.isFinite(m) && m > 0) out.min_order = m; else errors.push("min_order is invalid");
  }
  if (present(b.state)) out.state = String(b.state).slice(0, 80);
  if (present(b.district)) out.district = String(b.district).slice(0, 80);
  if (present(b.status)) {
    if (LISTING_STATUSES.includes(b.status)) out.status = b.status;
    else errors.push("status is invalid");
  }

  out.media = Array.isArray(b.media)
    ? b.media
        .filter((m) => m && typeof m.url === "string" && m.url)
        .slice(0, MAX_MEDIA)
        .map((m, i) => ({ url: m.url, sort: Number.isFinite(Number(m.sort)) ? Number(m.sort) : i }))
    : [];

  if (errors.length) return { error: errors.join("; ") };
  return { value: out };
}

/* DB row -> API shape (camelCase, rupees exposed alongside paise). */
export function publicListing(row) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: row.seller_name ?? undefined,
    title: row.title,
    description: row.description ?? "",
    category: row.category,
    unit: row.unit,
    price: paiseToRupees(row.price_paise),
    pricePaise: Number(row.price_paise),
    currency: row.currency || "INR",
    qtyAvailable: Number(row.qty_available),
    minOrder: Number(row.min_order),
    state: row.state ?? null,
    district: row.district ?? null,
    status: row.status,
    media: (row.media || []).map((m) => ({ url: m.url, sort: m.sort })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* Opaque keyset cursor over (created_at, id) for stable pagination. */
export function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ c: row.created_at, i: row.id })).toString("base64url");
}
export function decodeCursor(cursor) {
  try {
    const o = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
    if (o && o.c && o.i) return { createdAt: o.c, id: o.i };
  } catch { /* malformed cursor -> ignore */ }
  return null;
}

export const LISTING_PAGE_SIZE = 20;
export const LISTING_PAGE_MAX = 40;
export function clampLimit(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return LISTING_PAGE_SIZE;
  return Math.min(Math.floor(n), LISTING_PAGE_MAX);
}
