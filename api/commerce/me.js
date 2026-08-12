/* GET /api/commerce/me — the B0 foundation loop.

   Verifies the Firebase ID token (reusing the existing keyless verifier),
   mirrors the identity into Postgres, and returns the internal user row. This
   is the acceptance criterion for B0: "an authed request creates/loads its
   users row." Every later commerce endpoint follows this same open: verify →
   ensureUser → do work. */

import { verifyToken } from "../_middleware/verifyAuth.js";
import { getSql } from "../_lib/db.js";
import { ensureUser } from "../_lib/ensureUser.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: { message: "GET only" } });

    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: { message: "Unauthorized" } });

    const sql = getSql();
    const user = await ensureUser(sql, decoded);
    return res.status(200).json({ user });
  } catch (err) {
    console.error("commerce/me error:", err);
    // 503 when the DB simply isn't configured yet, 500 otherwise.
    const message = /DATABASE_URL is not set/.test(err?.message || "")
      ? "Commerce backend is not configured — set DATABASE_URL."
      : "Internal error";
    const code = /DATABASE_URL is not set/.test(err?.message || "") ? 503 : 500;
    return res.status(code).json({ error: { message } });
  }
}
