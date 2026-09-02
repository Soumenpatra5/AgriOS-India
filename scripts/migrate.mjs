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
