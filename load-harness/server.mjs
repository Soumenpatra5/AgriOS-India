/* Tier-3 Phase 3A load-test server.

   Hosts the REAL /api/farm handler — routing table, six-step gate, ensureUser,
   action handlers, all unmodified production modules — over actual HTTP, with
   the same two seams the Tier-1 suite replaces:

     database  -> in-process PGlite Postgres, real Supabase migrations
     auth      -> x-test-uid headers (see verifyAuth.test.mjs)

   Nothing in this process can reach production: DATABASE_URL is scrubbed
   before any app module loads, db.js is redirected to the PGlite client, and
   verifyAuth never contacts Google. k6 talks to localhost only.

   Run:  node load-harness/server.mjs        (port 4174, override with PORT)

   Honest limit (same as Tier-1): PGlite is a single-connection Postgres, so
   concurrent requests interleave on one connection rather than exercising
   parallel-writer lock contention. Phase 3A measures the handler + SQL path
   under concurrent HTTP load; real Postgres concurrency is Phase 3B. */

import http from "node:http";
import { register } from "node:module";

/* Scrub before ANY app module loads — belt and braces on top of db.test.mjs
   never reading it. */
delete process.env.DATABASE_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;

register("./hooks.mjs", import.meta.url);

const harness = await import("../api/_lib/__tests__/e2e/harness.js");
const { seed, FARMS } = await import("./seed.mjs");

console.log("booting in-process Postgres (PGlite) + migrations...");
await harness.freshDb();

console.log("seeding through the real API...");
const t0 = Date.now();
const seeded = await seed(harness);
console.log(`seeded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

for (const [k, v] of Object.entries(seeded)) {
  const [{ n: users }] = await harness.dbRef.sql`select count(*)::int as n from users`;
  console.log(`  ${k}: spaceId=${v.spaceId} tasks=${v.taskIds.length} (users total: ${users})`);
}

const { default: farmHandler } = await import("../api/farm.js");

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 262_144) { reject(new Error("body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    }
    /* k6's setup() reads the seeded ids from here instead of hardcoding them. */
    if (req.method === "GET" && req.url === "/seed-info") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ farms: FARMS, seeded }));
    }
    if (req.method === "POST" && req.url === "/api/farm") {
      let body = {};
      try { body = JSON.parse((await readBody(req)) || "{}"); }
      catch { res.writeHead(400, { "content-type": "application/json" }); return res.end('{"error":{"message":"bad json"}}'); }

      const shim = {
        code: 200,
        status(c) { this.code = c; return this; },
        json(b) {
          res.writeHead(this.code, { "content-type": "application/json" });
          res.end(JSON.stringify(b));
          return this;
        },
      };
      /* The real handler, exactly as Vercel would invoke it. */
      return void (await farmHandler({ method: "POST", headers: req.headers, body }, shim));
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end('{"error":{"message":"not found"}}');
  } catch (err) {
    console.error("server error:", err);
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end('{"error":{"message":"harness error"}}');
  }
});

const PORT = Number(process.env.PORT || 4174);
server.listen(PORT, "127.0.0.1", () => {
  console.log(`load-harness ready on http://127.0.0.1:${PORT}  (POST /api/farm, GET /seed-info)`);
});
