#!/usr/bin/env node
/* Verify the commerce backend DB is provisioned: connect to DATABASE_URL and
   confirm the core tables exist. Run after `npm run migrate`.

   Usage:  DATABASE_URL=postgres://... npm run check:db */

import postgres from "postgres";

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
