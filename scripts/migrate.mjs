#!/usr/bin/env node
/* Minimal, infra-agnostic SQL migration runner for the commerce backend.

   Applies every *.sql under supabase/migrations in filename order, exactly once,
   tracking applied files in a schema_migrations table. Each file runs inside a
   transaction together with its tracking insert, so a failed file rolls back and
   is retried next run.

   Usage:  DATABASE_URL=postgres://... npm run migrate
   If DATABASE_URL is unset it exits 0 with a message, so CI stays green until the
   Supabase project is wired up. */

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL not set — skipping migrations.");
  process.exit(0);
}

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../supabase/migrations");
const sql = postgres(url, { prepare: false, ssl: "require", max: 1 });

try {
  await sql`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;

  const applied = new Set(
    (await sql`select name from schema_migrations`).map((r) => r.name),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const ddl = await readFile(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);                       // parameterless -> simple protocol (multi-statement OK)
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log("applied", file);
    count++;
  }
  console.log(count ? `Done — ${count} migration(s) applied.` : "Up to date.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
