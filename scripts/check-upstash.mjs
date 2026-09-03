#!/usr/bin/env node
/* Verify the fleet-wide rate limiter is really provisioned.

   The limiter is deliberately forgiving at runtime: if Upstash cannot be
   reached it falls back to an in-memory window rather than blocking a farmer
   from signing in. That is right for availability and terrible for confidence
   — a typo in the token behaves exactly like a working setup, and the OTP
   limits quietly go back to resetting per serverless instance.

   So this proves the thing end to end instead of trusting the dashboard: it
   talks to the real database, runs a real counter to its limit, and checks the
   window expires. Run it after adding the variables.

   Usage:  npm run check:upstash */

import { readFileSync } from "node:fs";

/* node does not read .env — only Vite does — so variables put there, as
   PROVISIONING.md instructs, would be invisible to this check and it would
   report "not configured" for a setup that is fine. A real environment
   variable still wins, which is what CI and Vercel pass. */
const LF = String.fromCharCode(10);
function loadDotEnv(keys) {
  let lines;
  try { lines = readFileSync(".env", "utf8").split(LF); } catch { return; }
  for (const key of keys) {
    if (process.env[key]) continue;
    const prefix = key + "=";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith(prefix)) continue;
      let v = line.slice(prefix.length).trim();
      const q = v.charCodeAt(0);
      if ((q === 34 || q === 39) && v.charCodeAt(v.length - 1) === q) v = v.slice(1, -1);
      if (v) process.env[key] = v;
      break;
    }
  }
}

const NAMES = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
               "KV_REST_API_URL", "KV_REST_API_TOKEN"];
loadDotEnv(NAMES);

/* Both namings are accepted, because which pair exists depends on whether the
   store was created on upstash.com or through Vercel's marketplace. */
const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").replace(/\/$/, "");
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

if (!url || !token) {
  console.error("✗ Upstash is not configured.");
  console.error("  Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env");
  console.error("  (or the KV_REST_API_* pair, if the store came from Vercel).");
  console.error("  Without them the OTP rate limits reset per serverless instance.");
  process.exit(1);
}

async function redis(commands) {
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    /* 401 is the common one and means the token does not match the URL —
       usually two different databases, or a read-only token. */
    throw new Error(res.status === 401
      ? "401 — the token does not match that database (check you copied both from the same store)"
      : `${res.status} ${(await res.text()).slice(0, 120)}`);
  }
  return (await res.json()).map((r) => r.result);
}

const key = `agrios:check:${Date.now()}`;
try {
  const [pong] = await redis([["PING"]]);
  console.log(`✓ Reached ${url.replace(/^https:\/\//, "")} (${pong})`);

  /* The limiter's own logic, against the real database: three hits on a
     two-per-window key, and the third must be the one that trips. */
  const counts = await redis([
    ["INCR", key], ["PEXPIRE", key, "2000", "NX"],
    ["INCR", key], ["INCR", key],
  ]);
  const hits = [counts[0], counts[2], counts[3]];
  const max = 2;
  const tripped = hits.map((n) => n > max);

  if (hits.join(",") !== "1,2,3" || tripped.join(",") !== "false,false,true") {
    console.error(`✗ Counter behaved unexpectedly: hits=${hits.join(",")}`);
    process.exitCode = 1;
  } else {
    console.log("✓ Counter works — 2 allowed, 3rd blocked, shared across every instance");
  }

  const [ttl] = await redis([["PTTL", key]]);
  if (!(ttl > 0 && ttl <= 2000)) {
    console.error(`✗ The window has no expiry (PTTL ${ttl}) — keys would never reset.`);
    process.exitCode = 1;
  } else {
    console.log(`✓ Window expires (${ttl}ms left of 2000ms)`);
  }

  if (!process.exitCode) {
    console.log("\nRate limiting is live. OTP: 5 per number per hour, 20 per IP per hour.");
  }
} catch (err) {
  console.error(`✗ Could not use the database: ${err.message}`);
  process.exitCode = 1;
} finally {
  try { await redis([["DEL", key]]); } catch { /* best effort cleanup */ }
}
