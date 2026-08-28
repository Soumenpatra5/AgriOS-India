#!/usr/bin/env node
/* Releases stock held by abandoned (unpaid) checkouts.

   Runs from the scheduled GitHub Actions job rather than a Vercel Cron: Hobby
   plans allow only daily crons, and the every-15-minutes entry in vercel.json
   made Vercel reject every deployment at validation. Talking to Postgres
   directly also keeps this off the Serverless Function budget (12 on Hobby)
   and means there is no public endpoint to secure.

   Usage:  DATABASE_URL=postgres://... npm run release-stale
   If DATABASE_URL is unset it exits 0 with a message, matching migrate.mjs, so
   CI stays green until the Supabase project is wired up. */

import postgres from "postgres";
import { releaseStaleOrders } from "../api/_lib/releaseStale.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL not set — skipping reservation sweep.");
  process.exit(0);
}

const ttlMinutes = Number(process.env.ORDER_RESERVATION_TTL_MIN || 30);
const sql = postgres(url, { prepare: false, ssl: "require", max: 1 });

try {
  const released = await releaseStaleOrders(sql, ttlMinutes);
  console.log(released
    ? `Released ${released} order(s) held longer than ${ttlMinutes} minutes.`
    : `Nothing to release — no unpaid order older than ${ttlMinutes} minutes.`);
} catch (err) {
  console.error("Reservation sweep failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
