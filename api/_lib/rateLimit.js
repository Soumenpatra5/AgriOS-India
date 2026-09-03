/* Shared rate limiter for the endpoints that must not be hammered.

   Uses Upstash Redis (REST) when configured, so the limit is enforced across
   the whole Vercel serverless fleet — fixing the audit's M3 (the old in-memory
   map reset per instance / cold start). Falls back to a best-effort in-memory
   window when Upstash isn't configured, so the app still works before it is
   provisioned.

   Fixed-window counter: INCR the key, set its TTL on first hit, limit when the
   count exceeds `max` within the window. */

const mem = new Map();

/* Vercel's Upstash marketplace integration injects the KV_REST_API_* names
   alongside the UPSTASH_* ones, and which pair you get depends on how the
   store was created. Accepting both means the limiter works whether the
   database was made through Vercel or on upstash.com directly — the difference
   is not something a deploy should turn on silently. */
function creds() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function rateLimitConfigured() {
  return creds() !== null;
}

export function memLimited(key, max, windowMs, now = Date.now()) {
  const hits = (mem.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) { mem.set(key, hits); return true; }
  hits.push(now);
  mem.set(key, hits);
  if (mem.size > 5000) mem.clear();
  return false;
}

async function upstashLimited({ url, token }, key, max, windowMs) {
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    // INCR then set TTL only if the key has none (NX) — i.e. on the first hit.
    body: JSON.stringify([["INCR", key], ["PEXPIRE", key, String(windowMs), "NX"]]),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = await res.json();
  const count = Number(data?.[0]?.result || 0);
  return count > max;
}

/* Falling back is the right behaviour — a Redis outage must not stop farmers
   signing in — but doing it SILENTLY is not. A wrong token would leave the OTP
   limits resetting per instance while the dashboard says Upstash is connected,
   and nobody would ever find out. So the degradation is logged, throttled to
   once a minute so a sustained outage cannot flood the log. */
let lastComplaint = 0;
function complain(err) {
  const now = Date.now();
  if (now - lastComplaint < 60_000) return;
  lastComplaint = now;
  console.error(`rate_limit_degraded backend=upstash reason=${err?.message || "unknown"} `
    + "effect=limits-are-per-instance-until-fixed");
}

/* Returns true when the caller is OVER the limit and should be rejected (429). */
export async function rateLimit({ key, max, windowMs }) {
  const c = creds();
  if (c) {
    try { return await upstashLimited(c, key, max, windowMs); }
    catch (err) { complain(err); return memLimited(key, max, windowMs); }
  }
  return memLimited(key, max, windowMs);
}
