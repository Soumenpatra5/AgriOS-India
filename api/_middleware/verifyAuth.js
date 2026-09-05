/* STAGING-BRANCH-ONLY verifyAuth — this file is the one deliberate
   divergence from main (Tier-3 Design A, approved 2026-09-05). It adds a
   load-test authentication path IN FRONT of the untouched production JWKS
   verification, guarded three ways:

     1. The code exists only on the `staging` branch. Production deploys
        build `main`, where this path does not exist at all. CI's security
        guard fails any main build or PR into main that contains it.
     2. process.env.VERCEL_ENV must be exactly "preview" — Vercel sets
        "production" on production deployments, so even a wrongly-merged
        copy is inert there.
     3. LOAD_TEST_AUTH_SECRET must be set — it is scoped to the Preview
        environment only and exists nowhere else.

   The header contract (shared with load-test.js and seed-preview.mjs):

     x-load-test-auth: <uid>:<hex hmac-sha256(uid, LOAD_TEST_AUTH_SECRET)>

   uid must match TEST-USER-### — even a caller holding the secret can only
   authenticate as a load-test identity, never as a real user. Comparison is
   timing-safe. On any mismatch the request falls through to the real
   verification below, so failure behavior is identical to production. */

import { createRemoteJWKSet, jwtVerify } from "jose";

const TEST_UID = /^TEST-USER-\d{3}$/;

/* node:crypto is imported DYNAMICALLY, inside the guarded branch, and that is
   load-bearing rather than stylistic.

   This file is reachable from the CLIENT bundle: src/pages/farmSpace/
   FarmSpaceTasks.jsx imports allowedTransitions from api/_lib/farm/tasks.js,
   which imports gate.js, which imports this module. On main that costs
   nothing — tree-shaking drops the unused server code. But a STATIC
   `import { createHmac } from "node:crypto"` is a binding Rollup must resolve
   before it can shake anything, and in a browser build node:crypto is
   externalized, so the build fails outright with:

     "createHmac" is not exported by "__vite-browser-external"

   A dynamic import inside a function the client never calls has no such
   binding, so the bundle builds and the code stays server-only. */
async function loadTestClaims(req) {
  if (process.env.VERCEL_ENV !== "preview") return null;
  const secret = process.env.LOAD_TEST_AUTH_SECRET;
  if (!secret) return null;
  const { createHmac, timingSafeEqual } = await import("node:crypto");

  const header = req.headers["x-load-test-auth"];
  if (typeof header !== "string" || header.length > 200) return null;

  const at = header.lastIndexOf(":");
  if (at < 1) return null;
  const uid = header.slice(0, at);
  const mac = header.slice(at + 1);
  if (!TEST_UID.test(uid)) return null;

  const expected = createHmac("sha256", secret).update(uid).digest("hex");
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  /* Same deterministic identity conventions as the Tier-1 harness, so
     ensureUser materializes recognizable TEST-USER rows in the staging DB. */
  const last3 = uid.slice(-3);
  return { sub: uid, name: `Tester ${last3}`, phone_number: `+919${last3.padStart(9, "0")}` };
}

/* ── below this line: byte-for-byte the production implementation ─────── */

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

function projectId() {
  return process.env.FB_PROJECT_ID || process.env.VITE_FB_PROJECT_ID || "";
}

export async function verifyToken(req) {
  const test = await loadTestClaims(req);
  if (test) return test;

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;

  const pid = projectId();
  if (!pid) {
    console.error("verifyToken: no project id (set FB_PROJECT_ID)");
    return null;
  }

  try {
    const { payload } = await jwtVerify(header.slice(7), JWKS, {
      issuer: `https://securetoken.google.com/${pid}`,
      audience: pid,
    });
    // A valid Firebase ID token always carries a non-empty subject (uid).
    if (!payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}
