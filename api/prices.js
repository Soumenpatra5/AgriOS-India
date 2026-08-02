/* AgriOS live mandi prices — data.gov.in (Agmarknet) proxy.

   Wires the Government of India "Current Daily Price of Various Commodities
   from Various Markets (Mandi)" open-data resource. The API key lives ONLY
   here (server-side), never in the browser.

   Setup (Vercel → Project → Settings → Environment Variables):
     DATAGOV_API_KEY   = <your data.gov.in API key>   (register free at data.gov.in)
     DATAGOV_RESOURCE_ID (optional) = override the Agmarknet resource id

   Until DATAGOV_API_KEY is set this returns 503 { unavailable:true } and the
   client falls back to the curated MSP / seasonal bands — no breakage. */

const DEFAULT_RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070";
const RATE = { windowMs: 60_000, max: 30 };
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  if (arr.length >= RATE.max) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

function apiKey() {
  return (process.env.DATAGOV_API_KEY || process.env.PRICE_FEED_KEY || "").trim();
}

function resourceUrl() {
  const id = (process.env.DATAGOV_RESOURCE_ID || DEFAULT_RESOURCE).trim();
  return `https://api.data.gov.in/resource/${id}`;
}

// Agmarknet arrival_date is "DD/MM/YYYY" — parse to a timestamp for sorting.
function parseDate(d) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((d || "").trim());
  if (!m) return 0;
  return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
}

async function query({ key, commodity, state, market, limit = 100 }) {
  const params = new URLSearchParams({ "api-key": key, format: "json", limit: String(limit) });
  if (commodity) params.set("filters[commodity]", commodity);
  if (state)     params.set("filters[state]", state);
  if (market)    params.set("filters[market]", market);
  const res = await fetch(`${resourceUrl()}?${params.toString()}`);
  if (!res.ok) return null;
  const json = await res.json();
  return Array.isArray(json.records) ? json.records : [];
}

function pickLatest(records, commodity) {
  let list = records;
  // Tolerate messy commodity naming (e.g. "Paddy(Dhan)(Common)") with a
  // case-insensitive substring match on the base word.
  if (commodity) {
    const needle = commodity.toLowerCase().split(/[\s(]/)[0];
    const matched = records.filter((r) => (r.commodity || "").toLowerCase().includes(needle));
    if (matched.length) list = matched;
  }
  if (!list.length) return null;
  return list.sort((a, b) => parseDate(b.arrival_date) - parseDate(a.arrival_date))[0];
}

function normalize(r) {
  const num = (v) => { const n = Number(String(v).replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : null; };
  return {
    ok: true,
    live: true,
    commodity: r.commodity || "",
    variety:   r.variety || "",
    market:    r.market || "",
    district:  r.district || "",
    state:     r.state || "",
    modal:     num(r.modal_price),
    min:       num(r.min_price),
    max:       num(r.max_price),
    unit:      "qtl",
    date:      r.arrival_date || "",
    source:    "Agmarknet · data.gov.in",
  };
}

export default async function handler(req, res) {
  const { verifyToken } = await import("./_middleware/verifyAuth.js");
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: { message: "Unauthorized" } });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ error: "Too many requests" });

  const key = apiKey();
  if (!key) return res.status(503).json({ unavailable: true, message: "Live price feed is not configured on the server." });

  const { commodity, state, market } = req.body || {};
  if (!commodity) return res.status(400).json({ error: "commodity required" });

  try {
    // 1) commodity (+ state/market) exact filter
    let records = await query({ key, commodity, state, market });
    // 2) fall back to state-only, then commodity-only, using substring matching
    if ((!records || !records.length) && state) records = await query({ key, state, limit: 500 });
    if ((!records || !records.length))         records = await query({ key, commodity, limit: 200 });

    if (!records) return res.status(502).json({ unavailable: true, message: "Price feed request failed." });

    const latest = pickLatest(records, commodity);
    if (!latest) return res.status(200).json({ unavailable: true, reason: "no_data" });

    return res.status(200).json(normalize(latest));
  } catch {
    return res.status(502).json({ unavailable: true, message: "Price feed request failed." });
  }
}
