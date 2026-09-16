/* Poultry P2 — daily records, weighings, feed ledger, metrics.

   Drives the real /api/farm handler through the six-step gate, same as the P1
   suite. The maths assertions matter as much as the security ones here: an FCR
   that is quietly 1000x wrong because grams met kilograms would look perfectly
   plausible on a dashboard. */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { freshDb, dbRef, call, U, buildFarm, materialize } from "./harness.js";
import { computeFCR, gramsToKg, computePoultryFCR, safeNum, round2 } from "../../farm/fcr.js";
import { computeADG } from "../../farm/poultryOps.js";
import { safeNum as srcSafeNum, round2 as srcRound2 } from "../../../../src/utils/num.js";

vi.mock("../../db.js", () => ({ getSql: () => dbRef.sql }));
vi.mock("../../../_middleware/verifyAuth.js", async () => ({
  verifyToken: (await import("./harness.js")).testVerifyToken,
}));
vi.mock("../../blobStore.js", () => ({ deleteAttachment: async () => {} }));

const DAY = 86400000;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

let A, B;
const mkBatch = async (uid, spaceId, over = {}) => (await call(uid, "poultry.batches.create", {
  spaceId,
  payload: {
    name: `B${Math.random().toString(36).slice(2, 7)}`,
    placement_date: daysAgo(30), placed_qty: 1000, status: "active",
    placement_avg_weight_g: 40, ...over,
  },
})).data;

beforeAll(async () => {
  await freshDb();
  A = await buildFarm(1, "Ops Farm A", { managers: [2], supervisors: [3], workers: [4, 5] });
  B = await buildFarm(20, "Ops Farm B", { managers: [21], workers: [22] });
});

/* ── FCR: the authoritative engine and the unit boundary ──────────────────── */

describe("FCR — one canonical implementation", () => {
  it("the extracted helpers match src/utils/num.js exactly (no drift)", () => {
    for (const v of [1.5, 0, -1, "2.25", "", null, undefined, NaN, Infinity, "abc", 1e9]) {
      expect(safeNum(v), `safeNum(${String(v)})`).toBe(srcSafeNum(v));
      expect(round2(v), `round2(${String(v)})`).toBe(srcRound2(v));
    }
  });

  it("grams → kilograms at the named boundary: 1800 g is 1.8 kg", () => {
    expect(gramsToKg(1800)).toBe(1.8);
    expect(gramsToKg(40)).toBe(0.04);
    expect(gramsToKg(0)).toBe(0);
    /* Absent stays absent — a missing weight must not become a confident 0. */
    expect(gramsToKg(null)).toBeNull();
    expect(gramsToKg(undefined)).toBeNull();
    expect(gramsToKg("")).toBeNull();
    expect(gramsToKg("abc")).toBeNull();
  });

  it("known fixture: 1000 birds 40 g → 1800 g on 2900 kg feed gives FCR 1.65", () => {
    /* gain = (1.8 × 1000) − (0.04 × 1000) = 1760 kg; 2900 / 1760 = 1.6477 → 1.65 */
    const r = computePoultryFCR({
      placedQty: 1000, placementAvgWeightG: 40, liveBirds: 1000,
      latestAvgWeightG: 1800, targetFcr: 1.6,
    }, 2900);
    expect(r.weightGain).toBe(1760);
    expect(r.fcr).toBe(1.65);
    expect(r.fcrDiff).toBe(0.05);
    expect(r.performanceStatus).toBe("worse_than_target");
  });

  it("feeding GRAMS straight in would be ~1000x wrong — the boundary is what prevents it", () => {
    const correct = computePoultryFCR({
      placedQty: 1000, placementAvgWeightG: 40, liveBirds: 1000, latestAvgWeightG: 1800,
    }, 2900).fcr;
    /* The same numbers with no conversion — what a scattered /1000 would miss.
       Biomass comes out in gram-units (1.76 million), so the ratio is ~0.0016
       and rounds to a flat 0.00: not merely wrong by 1000x, but rendered as a
       number a dashboard would happily print as a perfect feed conversion. */
    const unconverted = computeFCR({
      initialCount: 1000, initialWeight: 40, currentCount: 1000, currentWeight: 1800,
    }, 2900);
    expect(correct).toBe(1.65);
    expect(unconverted.weightGain).toBe(1760000);   // grams, not kg
    expect(unconverted.fcr).toBe(0);                // meaningless
    expect(unconverted.fcr).not.toBe(correct);
  });

  it("returns null — never 0, NaN or Infinity — when it cannot be known", () => {
    const noWeight = computePoultryFCR({ placedQty: 1000, placementAvgWeightG: 40, liveBirds: 1000, latestAvgWeightG: null }, 500);
    expect(noWeight.fcr).toBeNull();

    const noGain = computePoultryFCR({ placedQty: 1000, placementAvgWeightG: 1800, liveBirds: 1000, latestAvgWeightG: 1800 }, 500);
    expect(noGain.fcr).toBeNull();

    const lost = computePoultryFCR({ placedQty: 1000, placementAvgWeightG: 1800, liveBirds: 1000, latestAvgWeightG: 900 }, 500);
    expect(lost.fcr).toBeNull();          // negative gain
    expect(lost.weightGain).toBeLessThan(0);

    const noFeed = computePoultryFCR({ placedQty: 1000, placementAvgWeightG: 40, liveBirds: 1000, latestAvgWeightG: 1800 }, 0);
    expect(noFeed.fcr).toBe(0);           // real answer: fed nothing, gained weight
    for (const r of [noWeight, noGain, lost, noFeed]) {
      expect(Number.isNaN(r.fcr)).toBe(false);
      expect(r.fcr).not.toBe(Infinity);
    }
  });

  it("no target means no variance, rather than a comparison against a guess", () => {
    const r = computePoultryFCR({ placedQty: 100, placementAvgWeightG: 40, liveBirds: 100, latestAvgWeightG: 1800 }, 200);
    expect(r.targetFCR).toBeNull();
    expect(r.fcrDiff).toBeNull();
    expect(r.performanceStatus).toBe("no_target");
  });
});

/* ── ADG ──────────────────────────────────────────────────────────────────── */

describe("ADG", () => {
  it("is null with fewer than two weighings", () => {
    expect(computeADG([])).toBeNull();
    expect(computeADG([{ weigh_date: "2026-09-01", average_weight_g: 500 }])).toBeNull();
  });

  it("is null when both weighings are the same day (zero interval)", () => {
    expect(computeADG([
      { weigh_date: "2026-09-01", average_weight_g: 500 },
      { weigh_date: "2026-09-01", average_weight_g: 520 },
    ])).toBeNull();
  });

  it("computes gain per day and is order-independent", () => {
    const rows = [
      { weigh_date: "2026-09-01", average_weight_g: 500 },
      { weigh_date: "2026-09-08", average_weight_g: 850 },
    ];
    expect(computeADG(rows)).toBe(50);                 // 350 g over 7 days
    expect(computeADG([...rows].reverse())).toBe(50);
  });

  it("preserves a NEGATIVE ADG rather than clamping it — weight loss is the signal", () => {
    expect(computeADG([
      { weigh_date: "2026-09-01", average_weight_g: 900 },
      { weigh_date: "2026-09-03", average_weight_g: 800 },
    ])).toBe(-50);
  });

  it("compares against the latest EARLIER day when several weighings share a date", () => {
    expect(computeADG([
      { weigh_date: "2026-09-01", average_weight_g: 500 },
      { weigh_date: "2026-09-05", average_weight_g: 700 },
      { weigh_date: "2026-09-05", average_weight_g: 900 },
    ])).toBe(100); // latest (900, taken first after sort-stability) vs 500 over 4 days
  });
});

/* ── daily records ────────────────────────────────────────────────────────── */

describe("daily records", () => {
  it("a worker records the day; the record is scoped to the farm", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const r = await call(U(4), "poultry.daily.upsert", {
      spaceId: A.space.id,
      payload: { batchId: b.id, record_date: daysAgo(1), mortality: 5, culls: 2, feed_consumed_kg: 120.5, water_litres: 300 },
    });
    expect(r.status).toBe(200);
    expect(r.data.mortality).toBe(5);
    expect(r.data.culls).toBe(2);
    expect(r.data.space_id).toBe(A.space.id);
  });

  it("one batch + one date = one record — a second save updates, never duplicates", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const d = daysAgo(2);
    await call(U(4), "poultry.daily.upsert", { spaceId: A.space.id, payload: { batchId: b.id, record_date: d, mortality: 3 } });
    const second = await call(U(4), "poultry.daily.upsert", { spaceId: A.space.id, payload: { batchId: b.id, record_date: d, mortality: 7 } });
    expect(second.status).toBe(200);
    expect(second.data.mortality).toBe(7);

    const rows = await dbRef.sql`
      select count(*)::int as n from poultry_daily_records where batch_id = ${b.id} and deleted_at is null`;
    expect(rows[0].n).toBe(1);
  });

  it("rejects mortality + culls beyond the birds alive that day, with structured detail", async () => {
    const b = await mkBatch(U(2), A.space.id, { placed_qty: 100 });
    await call(U(4), "poultry.daily.upsert", { spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(5), mortality: 90 } });

    const over = await call(U(4), "poultry.daily.upsert", {
      spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(4), mortality: 8, culls: 5 },
    });
    expect(over.status).toBe(400);
    expect(over.error).toMatch(/exceed/i);

    /* Nothing was written. */
    const [{ n }] = await dbRef.sql`
      select count(*)::int as n from poultry_daily_records where batch_id = ${b.id} and record_date = ${daysAgo(4)} and deleted_at is null`;
    expect(n).toBe(0);
  });

  /* REGRESSION. The real-Postgres concurrency suite caught this: the per-date
     opening check counts only EARLIER days, so back-dated or out-of-order
     entries each passed on their own while the running total quietly exceeded
     the birds ever placed (80 buried out of 50). The cumulative check against
     placed_qty is what closes it. */
  it("cannot bury more birds in total than were placed, even across back-dated days", async () => {
    const b = await mkBatch(U(2), A.space.id, { placed_qty: 50, placement_date: daysAgo(20) });
    /* Each of these is fine against its OWN opening balance, because each
       counts only the days before it. */
    const first = await call(U(4), "poultry.daily.upsert", {
      spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(1), mortality: 30 } });
    expect(first.status).toBe(200);

    const backdated = await call(U(4), "poultry.daily.upsert", {
      spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(10), mortality: 30 } });
    expect(backdated.status).toBe(400);
    expect(backdated.error).toMatch(/only 50 were placed/i);

    const [tot] = await dbRef.sql`
      select coalesce(sum(mortality),0)::int m, coalesce(sum(culls),0)::int c
        from poultry_daily_records where batch_id = ${b.id} and deleted_at is null`;
    expect(Number(tot.m) + Number(tot.c)).toBeLessThanOrEqual(50);
  });

  it("opening birds is derived from earlier days, not taken from the client", async () => {
    const b = await mkBatch(U(2), A.space.id, { placed_qty: 100 });
    await call(U(4), "poultry.daily.upsert", { spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(6), mortality: 40 } });
    /* Client insists 1000 birds are open; the server knows 60 remain. */
    const r = await call(U(4), "poultry.daily.upsert", {
      spaceId: A.space.id,
      payload: { batchId: b.id, record_date: daysAgo(5), mortality: 70, opening_birds: 1000, live_birds: 1000 },
    });
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/60 birds/);
  });

  it("refuses negative and non-integer quantities", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const bad = [
      { mortality: -1 }, { culls: -3 }, { mortality: 1.5 },
      { feed_consumed_kg: -10 }, { feed_wastage_kg: -1 }, { water_litres: -5 },
      { labour_count: -2 }, { humidity_pct: 140 }, { lighting_hours: 30 },
    ];
    for (const patch of bad) {
      const r = await call(U(4), "poultry.daily.upsert", {
        spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(3), ...patch },
      });
      expect(r.status, JSON.stringify(patch)).toBe(400);
    }
  });

  it("enforces the date policy: not before placement, not beyond tomorrow", async () => {
    const b = await mkBatch(U(2), A.space.id, { placement_date: daysAgo(10) });
    const before = await call(U(4), "poultry.daily.upsert", {
      spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(20), mortality: 1 } });
    expect(before.status).toBe(400);

    const far = await call(U(4), "poultry.daily.upsert", {
      spaceId: A.space.id, payload: { batchId: b.id, record_date: "2999-01-01", mortality: 1 } });
    expect(far.status).toBe(400);

    /* Today is fine (one day of clock-skew slack is allowed by policy). */
    const ok = await call(U(4), "poultry.daily.upsert", {
      spaceId: A.space.id, payload: { batchId: b.id, record_date: today(), mortality: 1 } });
    expect(ok.status).toBe(200);
  });

  it("a closed batch refuses a normal record and accepts an audited correction from a manager", async () => {
    const b = await mkBatch(U(2), A.space.id);
    for (const s of ["harvesting", "completed"]) {
      await call(U(2), "poultry.batches.setStatus", { spaceId: A.space.id, payload: { batchId: b.id, status: s } });
    }
    await call(U(1), "poultry.batches.setStatus", { spaceId: A.space.id, payload: { batchId: b.id, status: "closed" } });

    const blocked = await call(U(4), "poultry.daily.upsert", {
      spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(1), mortality: 1 } });
    expect(blocked.status).toBe(409);

    /* A worker cannot promote their own write to a correction. */
    const workerCorrection = await call(U(4), "poultry.daily.upsert", {
      spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(1), mortality: 1, is_correction: true } });
    expect(workerCorrection.status).toBe(409);

    const managerCorrection = await call(U(2), "poultry.daily.upsert", {
      spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(1), mortality: 1, is_correction: true } });
    expect(managerCorrection.status).toBe(200);
    expect(managerCorrection.data.is_correction).toBe(true);

    const audits = await dbRef.sql`
      select * from farm_audit_logs where target_id = ${managerCorrection.data.id}`;
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0].meta.correction).toBe(true);
  });

  it("a worker cannot delete a record (that is history, not an entry)", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const rec = (await call(U(4), "poultry.daily.upsert", {
      spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(1), mortality: 1 } })).data;
    expect((await call(U(4), "poultry.daily.delete", { spaceId: A.space.id, payload: { recordId: rec.id } })).status).toBe(403);
    expect((await call(U(2), "poultry.daily.delete", { spaceId: A.space.id, payload: { recordId: rec.id } })).status).toBe(200);
  });
});

/* ── weights ──────────────────────────────────────────────────────────────── */

describe("weights", () => {
  it("derives the average server-side and IGNORES a client-supplied one", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const r = await call(U(4), "poultry.weights.add", {
      spaceId: A.space.id,
      payload: { batchId: b.id, weigh_date: daysAgo(1), sample_count: 10,
                 total_sample_weight_g: 18000, average_weight_g: 99999 },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.average_weight_g)).toBe(1800);   // 18000/10, not 99999
  });

  it("refuses a zero or negative sample, and a zero total", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const bad = [
      { sample_count: 0, total_sample_weight_g: 100 },
      { sample_count: -5, total_sample_weight_g: 100 },
      { sample_count: 2.5, total_sample_weight_g: 100 },
      { sample_count: 10, total_sample_weight_g: 0 },
      { sample_count: 10, total_sample_weight_g: -50 },
      { sample_count: 10 },
    ];
    for (const payload of bad) {
      const r = await call(U(4), "poultry.weights.add", {
        spaceId: A.space.id, payload: { batchId: b.id, weigh_date: daysAgo(1), ...payload } });
      expect(r.status, JSON.stringify(payload)).toBe(400);
    }
  });

  /* Regression: client payload field mapping fix (2026-09-16).
     The Add Weight form displayed dates in locale format (e.g. 16-09-2026 in India)
     but the HTML date input always submits YYYY-MM-DD. The payload previously used
     wrong keys (weighed_at, total_weight_g) that the server ignores, causing a 400
     "Enter a valid weighing date" on every submission. */
  it("accepts YYYY-MM-DD weigh_date (canonical client format via type=date input)", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const r = await call(U(4), "poultry.weights.add", {
      spaceId: A.space.id,
      payload: { batchId: b.id, weigh_date: "2026-09-16", sample_count: 5, total_sample_weight_g: 4999 },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.average_weight_g)).toBeCloseTo(4999 / 5, 1);
  });

  it("rejects DD-MM-YYYY date format (locale display format must not reach the server)", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const r = await call(U(4), "poultry.weights.add", {
      spaceId: A.space.id,
      payload: { batchId: b.id, weigh_date: "16-09-2026", sample_count: 5, total_sample_weight_g: 4999 },
    });
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/valid/i);
  });

  it("rejects missing weigh_date (undefined maps to null in dateOnly)", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const r = await call(U(4), "poultry.weights.add", {
      spaceId: A.space.id,
      payload: { batchId: b.id, sample_count: 5, total_sample_weight_g: 4999 },
    });
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/valid/i);
  });

  it("rejects empty string weigh_date", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const r = await call(U(4), "poultry.weights.add", {
      spaceId: A.space.id,
      payload: { batchId: b.id, weigh_date: "", sample_count: 5, total_sample_weight_g: 4999 },
    });
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/valid/i);
  });

  it("rejects wrong payload keys (weighed_at / total_weight_g) — old client bug", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const r = await call(U(4), "poultry.weights.add", {
      spaceId: A.space.id,
      // these are the pre-fix client keys that must never reach the server
      payload: { batchId: b.id, weighed_at: daysAgo(1), total_weight_g: 4999, sample_count: 5 },
    });
    expect(r.status).toBe(400); // weigh_date is undefined → "Enter a valid weighing date"
  });
});

/* ── feed ledger ──────────────────────────────────────────────────────────── */

describe("feed ledger", () => {
  it("tracks stock as received minus consumed, wastage and adjustments out", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const add = (kind, quantity_kg) => call(U(4), "poultry.feed.add", {
      spaceId: A.space.id, payload: { batchId: b.id, log_date: daysAgo(1), kind, quantity_kg } });

    expect((await add("received", 1000)).status).toBe(200);
    expect((await add("consumed", 200)).status).toBe(200);
    expect((await add("wastage", 50)).status).toBe(200);
    expect((await add("adjustment_in", 25)).status).toBe(200);
    expect((await add("adjustment_out", 75)).status).toBe(200);

    const m = await call(U(1), "poultry.metrics", { spaceId: A.space.id, payload: { batchId: b.id } });
    expect(m.data.feed_stock_kg).toBe(700);        // 1000 + 25 − 200 − 50 − 75
    expect(m.data.feed_consumed_kg).toBe(200);
    expect(m.data.feed_wastage_kg).toBe(50);
  });

  it("REJECTS an overdraw rather than clamping, and says how much is on hand", async () => {
    const b = await mkBatch(U(2), A.space.id);
    await call(U(4), "poultry.feed.add", {
      spaceId: A.space.id, payload: { batchId: b.id, log_date: daysAgo(1), kind: "received", quantity_kg: 100 } });

    const over = await call(U(4), "poultry.feed.add", {
      spaceId: A.space.id, payload: { batchId: b.id, log_date: daysAgo(1), kind: "consumed", quantity_kg: 150 } });
    expect(over.status).toBe(400);
    expect(over.error).toMatch(/100 kg/);

    /* Stock is untouched — no partial write, no clamp. */
    const m = await call(U(1), "poultry.metrics", { spaceId: A.space.id, payload: { batchId: b.id } });
    expect(m.data.feed_stock_kg).toBe(100);
  });

  it("refuses unknown kinds, zero and negative quantities, and signed values", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const bad = [
      { kind: "eaten", quantity_kg: 10 },
      { kind: "consumed", quantity_kg: 0 },
      { kind: "consumed", quantity_kg: -10 },
      { kind: "received", quantity_kg: -5 },
      { kind: "received" },
      { kind: "received", quantity_kg: 10, rate_per_kg: -2 },
    ];
    for (const payload of bad) {
      const r = await call(U(4), "poultry.feed.add", {
        spaceId: A.space.id, payload: { batchId: b.id, log_date: daysAgo(1), ...payload } });
      expect(r.status, JSON.stringify(payload)).toBe(400);
    }
  });

  it("refuses to delete an inbound entry that would leave stock negative", async () => {
    const b = await mkBatch(U(2), A.space.id);
    const received = (await call(U(4), "poultry.feed.add", {
      spaceId: A.space.id, payload: { batchId: b.id, log_date: daysAgo(2), kind: "received", quantity_kg: 100 } })).data;
    await call(U(4), "poultry.feed.add", {
      spaceId: A.space.id, payload: { batchId: b.id, log_date: daysAgo(1), kind: "consumed", quantity_kg: 80 } });

    const r = await call(U(2), "poultry.feed.delete", { spaceId: A.space.id, payload: { feedLogId: received.id } });
    expect(r.status).toBe(409);
  });
});

/* ── metrics ──────────────────────────────────────────────────────────────── */

describe("metrics", () => {
  it("gives one consistent snapshot: live birds and the FCR bird count agree", async () => {
    const b = await mkBatch(U(2), A.space.id, { placed_qty: 1000, placement_avg_weight_g: 40, target_fcr: 1.6 });
    await call(U(4), "poultry.daily.upsert", { spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(3), mortality: 30, culls: 10 } });
    await call(U(4), "poultry.feed.add", { spaceId: A.space.id, payload: { batchId: b.id, log_date: daysAgo(3), kind: "received", quantity_kg: 5000 } });
    await call(U(4), "poultry.feed.add", { spaceId: A.space.id, payload: { batchId: b.id, log_date: daysAgo(2), kind: "consumed", quantity_kg: 2900 } });
    await call(U(4), "poultry.weights.add", { spaceId: A.space.id, payload: { batchId: b.id, weigh_date: daysAgo(8), sample_count: 10, total_sample_weight_g: 8000 } });
    await call(U(4), "poultry.weights.add", { spaceId: A.space.id, payload: { batchId: b.id, weigh_date: daysAgo(1), sample_count: 10, total_sample_weight_g: 18000 } });

    const m = (await call(U(1), "poultry.metrics", { spaceId: A.space.id, payload: { batchId: b.id } })).data;

    expect(m.placed_qty).toBe(1000);
    expect(m.mortality).toBe(30);
    expect(m.culls).toBe(10);
    expect(m.live_birds).toBe(960);
    expect(m.cumulative_mortality_pct).toBe(4);      // 40/1000
    expect(m.survival_pct).toBe(96);
    expect(m.latest_avg_weight_g).toBe(1800);
    expect(m.adg_g_per_day).toBe(142.86);            // 800 g → 1800 g over 7 days
    expect(m.feed_consumed_kg).toBe(2900);
    expect(m.feed_stock_kg).toBe(2100);

    /* FCR must have used live_birds (960), not placed_qty — the consistency
       requirement. gain = 1.8×960 − 0.04×1000 = 1688 kg; 2900/1688 = 1.72 */
    expect(m.weightGain).toBe(1688);
    expect(m.fcr).toBe(1.72);
    expect(m.targetFCR).toBe(1.6);
    expect(m.performanceStatus).toBe("worse_than_target");
  });

  it("returns nulls, not zeros, for a batch with no records yet", async () => {
    const b = await mkBatch(U(2), A.space.id, { placed_qty: 500 });
    const m = (await call(U(1), "poultry.metrics", { spaceId: A.space.id, payload: { batchId: b.id } })).data;
    expect(m.live_birds).toBe(500);
    expect(m.cumulative_mortality_pct).toBe(0);
    expect(m.latest_avg_weight_g).toBeNull();
    expect(m.adg_g_per_day).toBeNull();
    expect(m.fcr).toBeNull();
    expect(m.feed_stock_kg).toBe(0);
  });

  it("exposes alert signals for the existing alert service without inventing thresholds", async () => {
    const b = await mkBatch(U(2), A.space.id, { placed_qty: 100, target_mortality_pct: 3, target_weight_g: 2000 });
    await call(U(4), "poultry.daily.upsert", { spaceId: A.space.id, payload: { batchId: b.id, record_date: daysAgo(1), mortality: 10 } });
    await call(U(4), "poultry.weights.add", { spaceId: A.space.id, payload: { batchId: b.id, weigh_date: daysAgo(1), sample_count: 5, total_sample_weight_g: 5000 } });

    const s = (await call(U(1), "poultry.alerts.signals", { spaceId: A.space.id, payload: { batchId: b.id } })).data;
    expect(s.mortality_pct).toBe(10);
    expect(s.mortality_over_target).toBe(true);     // 10% vs 3% target
    expect(s.weight_below_target).toBe(true);       // 1000 g vs 2000 g target
    expect(s.days_since_last_record).toBe(1);
  });
});

/* ── idempotency ──────────────────────────────────────────────────────────── */

describe("idempotency", () => {
  it("a replayed client_uuid yields one record, not two — for all three write types", async () => {
    const b = await mkBatch(U(2), A.space.id);

    const daily = { batchId: b.id, record_date: daysAgo(1), mortality: 3, client_uuid: "cu-daily-1" };
    const d1 = await call(U(4), "poultry.daily.upsert", { spaceId: A.space.id, payload: daily });
    const d2 = await call(U(4), "poultry.daily.upsert", { spaceId: A.space.id, payload: daily });
    expect(d1.data.id).toBe(d2.data.id);

    const w = { batchId: b.id, weigh_date: daysAgo(1), sample_count: 5, total_sample_weight_g: 5000, client_uuid: "cu-w-1" };
    const w1 = await call(U(4), "poultry.weights.add", { spaceId: A.space.id, payload: w });
    const w2 = await call(U(4), "poultry.weights.add", { spaceId: A.space.id, payload: w });
    expect(w1.data.id).toBe(w2.data.id);

    const f = { batchId: b.id, log_date: daysAgo(1), kind: "received", quantity_kg: 10, client_uuid: "cu-f-1" };
    const f1 = await call(U(4), "poultry.feed.add", { spaceId: A.space.id, payload: f });
    const f2 = await call(U(4), "poultry.feed.add", { spaceId: A.space.id, payload: f });
    expect(f1.data.id).toBe(f2.data.id);

    const [{ n }] = await dbRef.sql`
      select count(*)::int as n from poultry_feed_logs where batch_id = ${b.id} and client_uuid = 'cu-f-1'`;
    expect(n).toBe(1);
  });

  it("a retried feed entry does not double-consume stock", async () => {
    const b = await mkBatch(U(2), A.space.id);
    await call(U(4), "poultry.feed.add", { spaceId: A.space.id, payload: { batchId: b.id, log_date: daysAgo(1), kind: "received", quantity_kg: 100 } });
    const consume = { batchId: b.id, log_date: daysAgo(1), kind: "consumed", quantity_kg: 60, client_uuid: "cu-retry" };
    await call(U(4), "poultry.feed.add", { spaceId: A.space.id, payload: consume });
    await call(U(4), "poultry.feed.add", { spaceId: A.space.id, payload: consume });   // timeout retry

    const m = (await call(U(1), "poultry.metrics", { spaceId: A.space.id, payload: { batchId: b.id } })).data;
    expect(m.feed_stock_kg).toBe(40);   // not −20
  });
});

/* ── isolation ────────────────────────────────────────────────────────────── */

describe("cross-farm isolation", () => {
  let aBatch, bBatch, bDaily, bWeight, bFeed;

  beforeAll(async () => {
    aBatch = await mkBatch(U(2), A.space.id);
    bBatch = await mkBatch(U(21), B.space.id, { placed_qty: 777 });
    bDaily = (await call(U(21), "poultry.daily.upsert", {
      spaceId: B.space.id, payload: { batchId: bBatch.id, record_date: daysAgo(1), mortality: 2 } })).data;
    bWeight = (await call(U(21), "poultry.weights.add", {
      spaceId: B.space.id, payload: { batchId: bBatch.id, weigh_date: daysAgo(1), sample_count: 4, total_sample_weight_g: 4000 } })).data;
    bFeed = (await call(U(21), "poultry.feed.add", {
      spaceId: B.space.id, payload: { batchId: bBatch.id, log_date: daysAgo(1), kind: "received", quantity_kg: 50 } })).data;
  });

  it("every P2 action addressing another farm's rows returns 404, never 403", async () => {
    const attacks = [
      ["poultry.daily.list",     { batchId: bBatch.id }],
      ["poultry.daily.upsert",   { batchId: bBatch.id, record_date: daysAgo(1), mortality: 999 }],
      ["poultry.daily.delete",   { recordId: bDaily.id }],
      ["poultry.weights.list",   { batchId: bBatch.id }],
      ["poultry.weights.add",    { batchId: bBatch.id, weigh_date: daysAgo(1), sample_count: 1, total_sample_weight_g: 1 }],
      ["poultry.weights.delete", { weightId: bWeight.id }],
      ["poultry.feed.list",      { batchId: bBatch.id }],
      ["poultry.feed.add",       { batchId: bBatch.id, log_date: daysAgo(1), kind: "received", quantity_kg: 1 }],
      ["poultry.feed.delete",    { feedLogId: bFeed.id }],
      ["poultry.metrics",        { batchId: bBatch.id }],
      ["poultry.alerts.signals", { batchId: bBatch.id }],
    ];
    for (const [action, payload] of attacks) {
      const r = await call(U(1), action, { spaceId: A.space.id, payload });
      expect(r.status, action).toBe(404);
    }
  });

  it("Farm B's data is completely unchanged after the attacks", async () => {
    const [daily] = await dbRef.sql`select * from poultry_daily_records where id = ${bDaily.id}`;
    expect(daily.mortality).toBe(2);
    expect(daily.deleted_at).toBeNull();
    const [weight] = await dbRef.sql`select * from poultry_weights where id = ${bWeight.id}`;
    expect(weight.deleted_at).toBeNull();
    const [feed] = await dbRef.sql`select * from poultry_feed_logs where id = ${bFeed.id}`;
    expect(feed.deleted_at).toBeNull();
    const [{ n }] = await dbRef.sql`select count(*)::int as n from poultry_daily_records where batch_id = ${bBatch.id} and deleted_at is null`;
    expect(n).toBe(1);
  });

  it("a forged space_id in the payload is ignored — the row lands in the authorized farm", async () => {
    const r = await call(U(2), "poultry.daily.upsert", {
      spaceId: A.space.id,
      payload: { batchId: aBatch.id, record_date: daysAgo(1), mortality: 1, space_id: B.space.id },
    });
    expect(r.status).toBe(200);
    expect(r.data.space_id).toBe(A.space.id);
  });

  it("unauthenticated, stranger and removed member all get the non-enumerating response", async () => {
    expect((await call(null, "poultry.metrics", { spaceId: A.space.id, payload: { batchId: aBatch.id } })).status).toBe(401);

    await materialize(U(91));
    expect((await call(U(91), "poultry.metrics", { spaceId: A.space.id, payload: { batchId: aBatch.id } })).status).toBe(404);

    const removedId = (await dbRef.sql`select id from users where firebase_uid = ${U(5)}`)[0].id;
    await call(U(1), "members.remove", { spaceId: A.space.id, payload: { userId: removedId } });
    expect((await call(U(5), "poultry.metrics", { spaceId: A.space.id, payload: { batchId: aBatch.id } })).status).toBe(404);
  });

  it("a forged batch_id that does not exist is indistinguishable from another farm's", async () => {
    const r = await call(U(1), "poultry.metrics", {
      spaceId: A.space.id, payload: { batchId: "00000000-0000-0000-0000-0000000000ff" } });
    expect(r.status).toBe(404);
  });
});
