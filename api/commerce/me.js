/* GET/PATCH /api/commerce/me — the B0 foundation loop, plus the one
   profile field a farmer edits themselves: their name.

   GET verifies the Firebase ID token, mirrors the identity into Postgres,
   and returns the internal user row. PATCH updates it. Every other commerce
   endpoint follows the same open: verify → ensureUser → do work.

   WHY A SERVER ROUND TRIP FOR A NAME. FarmDetails.jsx used to call the
   store's updateUser(), which is device-local only (localStorage) — a name
   typed there was visible on that one phone and nowhere else. Every OTHER
   member of a Farm Space reads a name from Postgres (Team roster, task
   assignee, chat sender), so a name that never reaches the server is
   invisible to everyone but the person who typed it. That mismatch — "I set
   my name and it shows on MY screen" — is exactly the kind of bug that looks
   fixed to the one person testing it. */

import { verifyToken } from "../_middleware/verifyAuth.js";
import { getSql } from "../_lib/db.js";
import { ensureUser } from "../_lib/ensureUser.js";

const MAX_NAME = 80;

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "PATCH") {
      return res.status(405).json({ error: { message: "GET or PATCH only" } });
    }

    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: { message: "Unauthorized" } });

    const sql = getSql();
    const current = await ensureUser(sql, decoded);

    if (req.method === "GET") {
      return res.status(200).json({ user: current });
    }

    /* PATCH — today, only `name`. Never trusted blindly: this only ever
       updates the CALLER's own row (current.id, from their verified token),
       never an id the client could supply. */
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const name = String(body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: { message: "Enter a name" } });
    if (name.length > MAX_NAME) {
      return res.status(400).json({ error: { message: `Name must be ${MAX_NAME} characters or fewer` } });
    }

    const [updated] = await sql`
      update users set name = ${name} where id = ${current.id} returning *`;
    return res.status(200).json({ user: updated });
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
