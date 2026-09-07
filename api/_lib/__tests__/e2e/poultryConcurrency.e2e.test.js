/* Poultry P2 — genuine parallel-writer races, against REAL PostgreSQL.

   WHY THIS FILE EXISTS SEPARATELY. Every other e2e suite runs on PGlite, which
   is a single-connection Postgres: a Promise.all burst there interleaves, it
   does not contend. A `select ... for update` cannot be proven to serialize
   anything when only one connection exists, so the mortality and feed-stock
   races — the two failure modes most likely to lose a farmer's data — are
   exactly the ones PGlite cannot test. This suite opens real concurrent
   connections and makes them fight.

   OPT-IN BY DESIGN. Skipped unless POULTRY_CONCURRENCY_DB is set, so CI and an
   offline laptop stay green:

     POULTRY_CONCURRENCY_DB="postgresql://...staging..." \
     POULTRY_CONCURRENCY_CONFIRM="disposable-test-database" \
       npx vitest run api/_lib/__tests__/e2e/poultryConcurrency.e2e.test.js

   PRODUCTION GUARD. The suite writes and deletes rows, so it hard-fails rather
   than skips if the target looks like production. Refusing loudly is the point:
   a silent skip on a mis-set variable would look identical to a pass. */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { computeFCR } from "../../farm/fcr.js";

const RAW_URL = process.env.POULTRY_CONCURRENCY_DB || "";
const ENABLED = !!RAW_URL;

/* Host fragments that mean "this is the live database". Deliberately broad:
   a false positive costs one skipped test run, a false negative corrupts a
   real farm's records. */
const PRODUCTION_MARKERS = ["prod", "production", "live"];

/* Two independent gates, because one is not enough:

     POULTRY_CONCURRENCY_DB        the target
     POULTRY_CONCURRENCY_CONFIRM   must equal "disposable-test-database"

   The confirmation is a second, deliberate action, so a connection string
   pasted into the wrong variable cannot start writing to a real database on
   its own. No host or project identifier is hardcoded here — this repository
   is public, and naming the staging project in it would publish half of a
   connection string for no safety benefit the confirmation does not already
   provide. */
const CONFIRM_PHRASE = "disposable-test-database";

function assertNotProduction(url, confirm = process.env.POULTRY_CONCURRENCY_CONFIRM) {
  const lower = url.toLowerCase();
  for (const marker of PRODUCTION_MARKERS) {
    if (lower.includes(marker)) {
      throw new Error(
        `POULTRY_CONCURRENCY_DB looks like production (matched "${marker}"). ` +
        "This suite writes and deletes rows and must never run against production.");
    }
  }
  if (confirm !== CONFIRM_PHRASE) {
    throw new Error(
      `Set POULTRY_CONCURRENCY_CONFIRM="${CONFIRM_PHRASE}" to confirm the target ` +
      "is a disposable test database. This suite writes and deletes rows.");
  }
}

let sql, spaceId, userId, cleanup = [];

/* Talks to Postgres directly rather than through /api: the gate is already
   proven by the PGlite suites, and what needs proving here is that the
   TRANSACTION serializes two writers. Each call opens its own connection so
   the contention is real. */
async function mortalityWrite(batchId, date, mortality, culls = 0) {
  return sql.begin(async (tx) => {
    const [locked] = await tx`select id, placed_qty from poultry_batches where id = ${batchId} for update`;
    /* Mirrors upsertDaily exactly: the per-date opening balance AND the
       cumulative total against placed_qty. The cumulative check is the one
       this suite proved necessary — without it, concurrent writers on
       different dates each pass their own check and together overshoot. */
    const placed = Number(locked.placed_qty);
    const [before] = await tx`
      select coalesce(sum(mortality),0)::int m, coalesce(sum(culls),0)::int c
        from poultry_daily_records where batch_id = ${batchId} and deleted_at is null and record_date < ${date}`;
    const opening = placed - (Number(before.m) + Number(before.c));
    if (mortality + culls > opening) {
      const err = new Error(`exceeds available (${opening})`);
      err.rejected = true;
      throw err;
    }
    const [all] = await tx`
      select coalesce(sum(mortality),0)::int m, coalesce(sum(culls),0)::int c
        from poultry_daily_records where batch_id = ${batchId} and deleted_at is null`;
    if (Number(all.m) + Number(all.c) + mortality + culls > placed) {
      const err = new Error("exceeds total placed");
      err.rejected = true;
      throw err;
    }
    /* Deliberate pause INSIDE the transaction, holding the lock. Without
       correct locking the second writer reads the pre-write state here and
       both commit. */
    await new Promise((r) => setTimeout(r, 60));
    const [row] = await tx`
      insert into poultry_daily_records (space_id, batch_id, record_date, mortality, culls, created_by)
      values (${spaceId}, ${batchId}, ${date}, ${mortality}, ${culls}, ${userId})
      returning *`;
    return row;
  });
}

async function feedWrite(batchId, date, kind, qty) {
  return sql.begin(async (tx) => {
    await tx`select id from poultry_batches where id = ${batchId} for update`;
    const [s] = await tx`
      select coalesce(sum(case when kind in ('received','adjustment_in') then quantity_kg else 0 end),0) inb,
             coalesce(sum(case when kind in ('consumed','wastage','adjustment_out') then quantity_kg else 0 end),0) outb
        from poultry_feed_logs where batch_id = ${batchId} and deleted_at is null`;
    const available = Number(s.inb) - Number(s.outb);
    if (["consumed", "wastage", "adjustment_out"].includes(kind) && qty > available) {
      const err = new Error(`overdraw (${available} kg available)`);
      err.rejected = true;
      throw err;
    }
    await new Promise((r) => setTimeout(r, 60));
    const [row] = await tx`
      insert into poultry_feed_logs (space_id, batch_id, log_date, kind, quantity_kg, created_by)
      values (${spaceId}, ${batchId}, ${date}, ${kind}, ${qty}, ${userId})
      returning *`;
    return row;
  });
}

const newBatch = async (placedQty) => {
  const [b] = await sql`
    insert into poultry_batches (space_id, name, placement_date, placed_qty, status, created_by)
    values (${spaceId}, ${"conc-" + Math.random().toString(36).slice(2, 8)},
            current_date - 30, ${placedQty}, 'active', ${userId})
    returning *`;
  cleanup.push(b.id);
  return b;
};

const settled = (results) => ({
  fulfilled: results.filter((r) => r.status === "fulfilled").length,
  rejected: results.filter((r) => r.status === "rejected").length,
});

beforeAll(async () => {
  if (!ENABLED) return;
  assertNotProduction(RAW_URL);
  const { default: postgres } = await import("postgres");
  /* Several connections, so the writers below genuinely contend. */
  sql = postgres(RAW_URL, { prepare: false, ssl: "require", max: 6, idle_timeout: 20 });

  const [u] = await sql`
    insert into users (firebase_uid, phone, name, agrios_user_id)
    values (${"CONC-TEST-" + Date.now()}, '9000000999', 'Concurrency Tester', ${"CT" + Date.now().toString(36).toUpperCase()})
    on conflict (firebase_uid) do update set name = excluded.name
    returning *`;
  userId = u.id;
  const [s] = await sql`
    insert into farm_spaces (name, owner_user_id) values ('Concurrency Test Farm', ${userId}) returning *`;
  spaceId = s.id;
}, 60_000);

afterAll(async () => {
  if (!ENABLED || !sql) return;
  /* Remove everything this suite created; the space cascade takes the rest. */
  for (const id of cleanup) {
    await sql`delete from poultry_feed_logs where batch_id = ${id}`.catch(() => {});
    await sql`delete from poultry_daily_records where batch_id = ${id}`.catch(() => {});
  }
  await sql`delete from farm_spaces where id = ${spaceId}`.catch(() => {});
  await sql`delete from users where id = ${userId}`.catch(() => {});
  await sql.end({ timeout: 5 }).catch(() => {});
}, 60_000);

describe.skipIf(!ENABLED)("real-Postgres concurrency", () => {
  it("refuses to run against anything that looks like production", () => {
    const ok = "disposable-test-database";
    /* A production-looking host is refused even WITH the confirmation. */
    expect(() => assertNotProduction("postgresql://user:pw@db.production.example.com:5432/postgres", ok))
      .toThrow(/production/i);
    expect(() => assertNotProduction("postgresql://user:pw@prod-db.example.com:5432/postgres", ok))
      .toThrow(/production/i);
    expect(() => assertNotProduction("postgresql://user:pw@live-db.example.com:5432/postgres", ok))
      .toThrow(/production/i);
    /* And an innocuous host is still refused without the confirmation.
       `null`, not `undefined` — passing undefined would trigger the default
       parameter and read the env var this suite is currently running with. */
    expect(() => assertNotProduction("postgresql://user:pw@some-host.example.com:5432/postgres", null))
      .toThrow(/disposable-test-database/);
    expect(() => assertNotProduction("postgresql://user:pw@some-host.example.com:5432/postgres", "yes"))
      .toThrow(/disposable-test-database/);
    /* Both gates satisfied. */
    expect(() => assertNotProduction("postgresql://user:pw@some-host.example.com:5432/postgres", ok))
      .not.toThrow();
  });

  /* THE REQUIRED SCENARIO: 100 birds, 95 already lost, A wants 4 and B wants 5.
     Either may win; both must never commit, because 4 + 5 = 9 > 5 remaining. */
  it("100 birds with 95 lost: concurrent 4 and 5 cannot both commit", async () => {
    const b = await newBatch(100);
    await sql`
      insert into poultry_daily_records (space_id, batch_id, record_date, mortality, culls, created_by)
      values (${spaceId}, ${b.id}, current_date - 10, 95, 0, ${userId})`;

    const results = await Promise.allSettled([
      mortalityWrite(b.id, new Date().toISOString().slice(0, 10), 4),
      mortalityWrite(b.id, new Date(Date.now() - 86400000).toISOString().slice(0, 10), 5),
    ]);
    const { fulfilled } = settled(results);

    const [tot] = await sql`
      select coalesce(sum(mortality),0)::int m, coalesce(sum(culls),0)::int c
        from poultry_daily_records where batch_id = ${b.id} and deleted_at is null`;
    const lost = Number(tot.m) + Number(tot.c);

    expect(fulfilled).toBeLessThanOrEqual(1);   // at most one of the two
    expect(lost).toBeLessThanOrEqual(100);      // never more birds than placed
    expect(100 - lost).toBeGreaterThanOrEqual(0);
  }, 60_000);

  it("a burst of concurrent mortality writes never buries more birds than exist", async () => {
    const b = await newBatch(50);
    const base = Date.now();
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        mortalityWrite(b.id, new Date(base - i * 86400000).toISOString().slice(0, 10), 10)),
    );
    const [tot] = await sql`
      select coalesce(sum(mortality),0)::int m from poultry_daily_records where batch_id = ${b.id} and deleted_at is null`;
    expect(Number(tot.m)).toBeLessThanOrEqual(50);
    expect(settled(results).rejected).toBeGreaterThan(0);   // some were correctly refused
  }, 60_000);

  it("concurrent mortality and culls are counted against the same pool", async () => {
    const b = await newBatch(10);
    const d1 = new Date().toISOString().slice(0, 10);
    const d2 = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await Promise.allSettled([
      mortalityWrite(b.id, d1, 6, 0),
      mortalityWrite(b.id, d2, 0, 7),
    ]);
    const [tot] = await sql`
      select coalesce(sum(mortality),0)::int m, coalesce(sum(culls),0)::int c
        from poultry_daily_records where batch_id = ${b.id} and deleted_at is null`;
    expect(Number(tot.m) + Number(tot.c)).toBeLessThanOrEqual(10);
  }, 60_000);

  it("concurrent feed consumption cannot drive stock negative", async () => {
    const b = await newBatch(100);
    const d = new Date().toISOString().slice(0, 10);
    await feedWrite(b.id, d, "received", 100);

    const results = await Promise.allSettled([
      feedWrite(b.id, d, "consumed", 60),
      feedWrite(b.id, d, "consumed", 60),
      feedWrite(b.id, d, "wastage", 30),
    ]);
    const [s] = await sql`
      select coalesce(sum(case when kind in ('received','adjustment_in') then quantity_kg else 0 end),0) inb,
             coalesce(sum(case when kind in ('consumed','wastage','adjustment_out') then quantity_kg else 0 end),0) outb
        from poultry_feed_logs where batch_id = ${b.id} and deleted_at is null`;
    const stock = Number(s.inb) - Number(s.outb);

    expect(stock).toBeGreaterThanOrEqual(0);
    expect(settled(results).rejected).toBeGreaterThan(0);
  }, 60_000);

  it("a duplicate client_uuid cannot create two rows even when submitted concurrently", async () => {
    const b = await newBatch(100);
    const d = new Date().toISOString().slice(0, 10);
    const uuid = "conc-dup-" + Date.now();
    const write = () => sql`
      insert into poultry_feed_logs (space_id, batch_id, log_date, kind, quantity_kg, created_by, client_uuid)
      values (${spaceId}, ${b.id}, ${d}, 'received', 10, ${userId}, ${uuid})
      returning *`;

    const results = await Promise.allSettled([write(), write(), write()]);
    const [{ n }] = await sql`
      select count(*)::int n from poultry_feed_logs where space_id = ${spaceId} and client_uuid = ${uuid}`;
    /* The unique index is the guarantee — the losers fail, they do not duplicate. */
    expect(n).toBe(1);
    expect(settled(results).rejected).toBe(2);
  }, 60_000);

  it("FCR stays consistent while writes land underneath it", async () => {
    const b = await newBatch(1000);
    const d = new Date().toISOString().slice(0, 10);
    await feedWrite(b.id, d, "received", 5000);
    await Promise.allSettled([
      feedWrite(b.id, d, "consumed", 1000),
      feedWrite(b.id, d, "consumed", 1000),
    ]);
    const [f] = await sql`
      select coalesce(sum(case when kind='consumed' then quantity_kg else 0 end),0) c
        from poultry_feed_logs where batch_id = ${b.id} and deleted_at is null`;
    const r = computeFCR(
      { initialCount: 1000, initialWeight: 0.04, currentCount: 1000, currentWeight: 1.8 },
      Number(f.c));
    expect(Number.isNaN(r.fcr)).toBe(false);
    expect(r.fcr).not.toBe(Infinity);
    expect(r.fcr).toBeGreaterThan(0);
  }, 60_000);
});

/* Visible when the suite is skipped, so a green run never silently means
   "races untested". */
describe.skipIf(ENABLED)("real-Postgres concurrency (skipped)", () => {
  it("is skipped because POULTRY_CONCURRENCY_DB is not set", () => {
    expect(ENABLED).toBe(false);
  });
});
