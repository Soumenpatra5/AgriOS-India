import { describe, it, expect, beforeAll } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

/* RLS Coverage Contract Test.
   Enforces that every public-schema application table has Row Level Security
   enabled, closing direct Supabase Data API access for untrusted roles.

   Actual repository state of schema_migrations:
   Migration 0017 (0017_enable_rls.sql, line 59) explicitly enables RLS on
   schema_migrations. It is therefore included in EXPECTED_PROTECTED_TABLES,
   not as an unprotected exception. */

export const EXPECTED_PROTECTED_TABLES = [
  "bee_apiaries",
  "bee_costs",
  "bee_harvests",
  "bee_hives",
  "bee_inspections",
  "bee_sales",
  "bee_treatments",
  "dairy_animals",
  "dairy_costs",
  "dairy_feed_records",
  "dairy_health_events",
  "dairy_lactations",
  "dairy_milk_records",
  "dairy_milk_sales",
  "dairy_reproductive_events",
  "farm_announcements",
  "farm_attendance",
  "farm_audit_logs",
  "farm_chat_message_hides",
  "farm_chat_messages",
  "farm_chat_reactions",
  "farm_dm_conversations",
  "farm_dm_message_hides",
  "farm_dm_messages",
  "farm_fields",
  "farm_notifications",
  "farm_space_invitations",
  "farm_space_memberships",
  "farm_space_modules",
  "farm_spaces",
  "farm_task_events",
  "farm_tasks",
  "field_activities",
  "field_costs",
  "field_harvests",
  "field_sales",
  "field_sowing",
  "fish_costs",
  "fish_feed_records",
  "fish_harvest_records",
  "fish_health_events",
  "fish_mortality_records",
  "fish_ponds",
  "fish_sales",
  "fish_water_quality",
  "goat_animals",
  "goat_costs",
  "goat_feed_records",
  "goat_health_events",
  "goat_milk_records",
  "goat_reproductive_events",
  "goat_sales",
  "goat_weight_records",
  "listing_media",
  "listings",
  "order_items",
  "orders",
  "otp_challenges",
  "payments",
  "pig_animals",
  "pig_costs",
  "pig_feed_records",
  "pig_health_events",
  "pig_reproductive_events",
  "pig_sales",
  "pig_weight_records",
  "poultry_batch_costs",
  "poultry_batch_sales",
  "poultry_batch_tasks",
  "poultry_batches",
  "poultry_daily_records",
  "poultry_feed_logs",
  "poultry_followup_chains",
  "poultry_followup_outcomes",
  "poultry_health_events",
  "poultry_incidents",
  "poultry_sheds",
  "poultry_task_templates",
  "poultry_vaccinations",
  "poultry_weights",
  "reviews",
  "schema_migrations",
  "users",
  "webhook_events",
];

/* Explicit intentional exceptions for unprotected public tables.
   Currently empty because all 83 tables including schema_migrations have RLS enabled.
   Any future addition of an unprotected table must be explicitly justified here. */
export const ALLOWED_UNPROTECTED_TABLES = new Set([]);

describe("Database RLS coverage contract", () => {
  let pg;
  let publicTables = [];

  beforeAll(async () => {
    pg = new PGlite();

    // Bootstrap schema_migrations as migrate.mjs does at runtime
    await pg.exec(`
      create schema if not exists auth;
      create or replace function auth.uid() returns uuid as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$ language sql;

      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    // Replay all migrations from 0001 through 0027 in lexicographical order
    const migrationsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../supabase/migrations"
    );
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const f of files) {
      const sql = await readFile(path.join(migrationsDir, f), "utf8");
      await pg.exec(sql);
    }

    const res = await pg.query(`
      select tablename, rowsecurity
      from pg_tables
      where schemaname = 'public'
      order by tablename;
    `);
    publicTables = res.rows;
  });

  it("replays all 28 migrations successfully", () => {
    expect(publicTables.length).toBe(EXPECTED_PROTECTED_TABLES.length);
  });

  it("enforces RLS on every table in the expected protected contract", () => {
    const tableMap = new Map(publicTables.map((r) => [r.tablename, r.rowsecurity]));

    for (const table of EXPECTED_PROTECTED_TABLES) {
      expect(tableMap.has(table), `Table ${table} must exist in public schema`).toBe(true);
      expect(tableMap.get(table), `Table ${table} must have rowsecurity = true`).toBe(true);
    }
  });

  it("confirms schema_migrations specifically has RLS enabled per migration 0017", () => {
    const sm = publicTables.find((r) => r.tablename === "schema_migrations");
    expect(sm).toBeDefined();
    expect(sm.rowsecurity).toBe(true);
  });

  it("ensures no unexpected public tables exist without RLS", () => {
    const tablesWithoutRls = publicTables
      .filter((r) => !r.rowsecurity)
      .map((r) => r.tablename);

    const unexpectedUnprotected = tablesWithoutRls.filter(
      (t) => !ALLOWED_UNPROTECTED_TABLES.has(t)
    );

    expect(
      unexpectedUnprotected,
      `Found public tables without RLS that are not in ALLOWED_UNPROTECTED_TABLES: ${unexpectedUnprotected.join(", ")}`
    ).toEqual([]);
  });

  it("ensures the expected table contract covers all tables present in the public schema", () => {
    const currentTableNames = publicTables.map((r) => r.tablename).sort();
    const expectedSorted = [...EXPECTED_PROTECTED_TABLES].sort();
    expect(currentTableNames).toEqual(expectedSorted);
  });
});
