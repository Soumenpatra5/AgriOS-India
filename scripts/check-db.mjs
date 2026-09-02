#!/usr/bin/env node
/* Verify the commerce backend DB is provisioned: connect to DATABASE_URL and
   confirm the core tables exist. Run after `npm run migrate`.

   Usage:  DATABASE_URL=postgres://... npm run check:db */

import postgres from "postgres";
import { readFileSync } from "node:fs";

/* .env is not read by node itself — only Vite loads it — so a DATABASE_URL put
   there, as PROVISIONING.md instructs, was invisible here and the run no-opped
   while reporting success. A migration runner that silently does nothing is the
   worst way to fail. A real environment variable still wins, which is what CI
   passes. */
const LF = String.fromCharCode(10);
function loadDotEnv() {
  if (process.env.DATABASE_URL) return;
  const KEY = "DATABASE_URL=";
  try {
    for (const raw of readFileSync(".env", "utf8").split(LF)) {
      const line = raw.trim();
      if (!line.startsWith(KEY)) continue;
      let v = line.slice(KEY.length).trim();
      const q = v.charCodeAt(0);
      if ((q === 34 || q === 39) && v.charCodeAt(v.length - 1) === q) v = v.slice(1, -1);
      if (v) process.env.DATABASE_URL = v;
      break;
    }
  } catch { /* no .env — CI passes the real environment variable */ }
}
loadDotEnv();


const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — set it to your Supabase connection string first.");
  process.exit(1);
}

const CORE = ["users", "listings", "listing_media", "orders", "order_items", "payments", "webhook_events", "reviews"];
const sql = postgres(url, { prepare: false, ssl: "require", max: 1 });

try {
  const rows = await sql`select table_name from information_schema.tables where table_schema = 'public'`;
  const have = new Set(rows.map((r) => r.table_name));
  const missing = CORE.filter((t) => !have.has(t));
  if (missing.length) {
    console.error(`✗ Missing table(s): ${missing.join(", ")}\n  Run:  npm run migrate`);
    process.exitCode = 1;
  } else {
    console.log(`✓ Commerce schema is present (${CORE.length} tables). Backend DB is provisioned.`);
  }
} catch (err) {
  console.error(`✗ Could not connect/query the database: ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
