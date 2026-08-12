/* Shared rate limiter for commerce write endpoints.

   Uses Upstash Redis (REST) when configured, so the limit is enforced across the
   whole Vercel serverless fleet — fixing the audit's M3 (the old in-memory map
   reset per instance / cold start). Falls back to a best-effort in-memory
   window when Upstash isn't configured, so the app still works pre-provisioning.

   Fixed-window counter: INCR the key, set its TTL on first hit, limit when the
   count exceeds `max` within the window. */

const mem = new Map();

export function rateLimitConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function memLimited(key, max, windowMs, now = Date.now()) {
  const hits = (mem.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) { mem.set(key, hits); return true; }
  hits.push(now);
  mem.set(key, hits);
  if (mem.size > 5000) mem.clear();
  return false;
}

async function upstashLimited(key, max, windowMs) {
  const url = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
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

/* Returns true when the caller is OVER the limit and should be rejected (429). */
export async function rateLimit({ key, max, windowMs }) {
  if (rateLimitConfigured()) {
    try { return await upstashLimited(key, max, windowMs); }
    catch { return memLimited(key, max, windowMs); }   // degrade, don't fail the request
  }
  return memLimited(key, max, windowMs);
}
