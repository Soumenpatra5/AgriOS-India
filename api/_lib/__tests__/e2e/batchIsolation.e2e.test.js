/* Batch History Isolation — three test suites verifying that:
   (a) Batch A records never appear in Batch B (cross-batch contamination),
   (b) A new batch starts with a clean, empty history,
   (c) A closed batch's history remains readable (soft-delete semantics).

   Uses the same PGlite harness as all other E2E tests — real SQL, no mocks
   on the poultry layer. */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { freshDb, dbRef, call, U, buildFarm } from "./harness.js";

vi.mock("../../db.js", () => ({ getSql: () => dbRef.sql }));
vi.mock("../../../_middleware/verifyAuth.js", async () => ({
  verifyToken: (await import("./harness.js")).testVerifyToken,
}));
vi.mock("../../blobStore.js", () => ({ deleteAttachment: async () => {} }));

const DAY = 86400000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

const mkBatch = async (uid, spaceId, over = {}) => (await call(uid, "poultry.batches.create", {
  spaceId,
  payload: {
    name: `ISO-${Math.random().toString(36).slice(2, 6)}`,
    placement_date: daysAgo(14), placed_qty: 1000,
    placement_avg_weight_g: 42, ...over,
  },
})).data;

/* ── shared state ─────────────────────────────────────────────────────────── */

let A, B;
let batchA, batchB;

beforeAll(async () => {
  await freshDb();
  A = await buildFarm(10, "Isolation Farm A", { managers: [11], workers: [12] });
  B = await buildFarm(20, "Isolation Farm B", { managers: [21] });

  batchA = await mkBatch(U(10), A.space.id);
  batchB = await mkBatch(U(20), B.space.id);

  /* Populate batch A with one of each record type */
  await call(U(10), "poultry.daily.upsert", {
    spaceId: A.space.id,
    payload: { batchId: batchA.id, record_date: daysAgo(10), mortality: 5, culls: 2, temp_c: 34.5 },
  });
  await call(U(10), "poultry.weights.add", {
    spaceId: A.space.id,
    payload: { batchId: batchA.id, weigh_date: daysAgo(7), sample_count: 20, total_sample_weight_g: 9800 },
  });
  await call(U(10), "poultry.feed.add", {
    spaceId: A.space.id,
    payload: { batchId: batchA.id, log_date: daysAgo(10), kind: "received", quantity_kg: 200 },
  });
  await call(U(10), "poultry.health.add", {
    spaceId: A.space.id,
    payload: { batchId: batchA.id, event_date: daysAgo(5), type: "observation", title: "Unusual sneezing" },
  });
  await call(U(10), "poultry.vaccinations.add", {
    spaceId: A.space.id,
    payload: { batchId: batchA.id, given_at: daysAgo(12), vaccine_name: "Newcastle", route: "drinking_water" },
  });
}, 60_000);

/* ── (a) cross-batch contamination ───────────────────────────────────────── */

describe("cross-batch isolation — Batch A records never appear in Batch B", () => {
  it("daily records are batch-scoped: Batch B has no daily records from Batch A", async () => {
    const { data } = await call(U(20), "poultry.daily.list", {
      spaceId: B.space.id,
      payload: { batchId: batchB.id },
    });
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  it("weight records are batch-scoped: Batch B has no weights from Batch A", async () => {
    const { data } = await call(U(20), "poultry.weights.list", {
      spaceId: B.space.id,
      payload: { batchId: batchB.id },
    });
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  it("feed logs are batch-scoped: Batch B has no feed entries from Batch A", async () => {
    const { data } = await call(U(20), "poultry.feed.list", {
      spaceId: B.space.id,
      payload: { batchId: batchB.id },
    });
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  it("health events are batch-scoped: Batch B has no health events from Batch A", async () => {
    const { data } = await call(U(20), "poultry.health.list", {
      spaceId: B.space.id,
      payload: { batchId: batchB.id },
    });
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  it("vaccinations are batch-scoped: Batch B has no vaccinations from Batch A", async () => {
    const { data } = await call(U(20), "poultry.vaccinations.list", {
      spaceId: B.space.id,
      payload: { batchId: batchB.id },
    });
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  it("timeline is batch-scoped: Batch B timeline contains no events from Batch A", async () => {
    const { data } = await call(U(20), "poultry.workflow.timeline", {
      spaceId: B.space.id,
      payload: { batchId: batchB.id },
    });
    expect(data.batch.id).toBe(batchB.id);
    expect(data.timeline).toHaveLength(0);
    // Confirm Batch A's records are not present
    const ids = data.timeline.map((e) => e.id);
    expect(ids).not.toContain(batchA.id);
  });
});

/* ── (b) new batch starts clean ─────────────────────────────────────────── */

describe("new batch clean-state — history never inherited from sibling batches", () => {
  let batchC;

  beforeAll(async () => {
    // Create a third batch on Farm A, which already has batchA with records
    batchC = await mkBatch(U(10), A.space.id, { name: "Batch-C-clean" });
  }, 30_000);

  it("new batch timeline is empty even when a sibling batch has extensive history", async () => {
    const { data } = await call(U(10), "poultry.workflow.timeline", {
      spaceId: A.space.id,
      payload: { batchId: batchC.id },
    });
    expect(data.batch.id).toBe(batchC.id);
    expect(data.timeline).toHaveLength(0);
  });

  it("new batch daily records list is empty", async () => {
    const { data } = await call(U(10), "poultry.daily.list", {
      spaceId: A.space.id,
      payload: { batchId: batchC.id },
    });
    expect(data).toHaveLength(0);
  });

  it("new batch feed list is empty", async () => {
    const { data } = await call(U(10), "poultry.feed.list", {
      spaceId: A.space.id,
      payload: { batchId: batchC.id },
    });
    expect(data).toHaveLength(0);
  });

  it("new batch metrics show zero historical totals", async () => {
    const { data } = await call(U(10), "poultry.metrics", {
      spaceId: A.space.id,
      payload: { batchId: batchC.id },
    });
    expect(data.mortality).toBe(0);
    expect(data.feed_consumed_kg).toBe(0);
    expect(data.culls).toBe(0);
  });
});

/* ── (c) closed batch history remains readable ───────────────────────────── */

describe("closed batch history — read-only, permanently accessible", () => {
  let closedBatch;

  beforeAll(async () => {
    // Create batch (starts "draft"), record data, then close (requires draft→active→harvesting→completed→closed)
    closedBatch = await mkBatch(U(10), A.space.id, { name: "Batch-to-close" });
    // draft → active (status value, not transition label)
    await call(U(10), "poultry.batches.setStatus", {
      spaceId: A.space.id, payload: { batchId: closedBatch.id, status: "active" },
    });
    // Record data while active
    await call(U(10), "poultry.daily.upsert", {
      spaceId: A.space.id,
      payload: { batchId: closedBatch.id, record_date: daysAgo(13), mortality: 3, culls: 1 },
    });
    await call(U(10), "poultry.vaccinations.add", {
      spaceId: A.space.id,
      payload: { batchId: closedBatch.id, given_at: daysAgo(13), vaccine_name: "Gumboro", route: "drinking_water" },
    });
    // active → harvesting → completed → closed
    await call(U(10), "poultry.batches.setStatus", {
      spaceId: A.space.id, payload: { batchId: closedBatch.id, status: "harvesting" },
    });
    await call(U(10), "poultry.batches.setStatus", {
      spaceId: A.space.id, payload: { batchId: closedBatch.id, status: "completed" },
    });
    await call(U(10), "poultry.batches.setStatus", {
      spaceId: A.space.id, payload: { batchId: closedBatch.id, status: "closed", note: "Test closure" },
    });
  }, 30_000);

  it("closed batch timeline is still readable", async () => {
    const { data } = await call(U(10), "poultry.workflow.timeline", {
      spaceId: A.space.id,
      payload: { batchId: closedBatch.id },
    });
    expect(data.batch.status).toBe("closed");
    expect(data.timeline.length).toBeGreaterThan(0);
  });

  it("closed batch has the correct historical events permanently linked by batch_id", async () => {
    const { data } = await call(U(10), "poultry.workflow.timeline", {
      spaceId: A.space.id,
      payload: { batchId: closedBatch.id },
    });
    const kinds = data.timeline.map((e) => e.event_kind);
    expect(kinds).toContain("daily_record");
    expect(kinds).toContain("vaccination");
  });

  it("writing a new daily record to a closed batch is rejected (assertWritable)", async () => {
    // harness call() returns { status, data, error } without throwing
    const result = await call(U(10), "poultry.daily.upsert", {
      spaceId: A.space.id,
      payload: { batchId: closedBatch.id, record_date: daysAgo(1), mortality: 0, culls: 0 },
    });
    // assertWritable() must reject writes to closed batches with 4xx
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.error).toBeTruthy();
  });

  it("closed batch daily records remain fully readable", async () => {
    const { data } = await call(U(10), "poultry.daily.list", {
      spaceId: A.space.id,
      payload: { batchId: closedBatch.id },
    });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.batch_id === closedBatch.id)).toBe(true);
  });
});
