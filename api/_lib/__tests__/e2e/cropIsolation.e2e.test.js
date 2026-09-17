/* Crop / Field module — E2E isolation tests.
 *
 * Same pattern as fishIsolation.e2e.test.js.
 * Gate behaviours (established by bee tests, applied here consistently):
 *   missing spaceId → [400, 404]
 *   non-member      → [403, 404]
 * Idempotency: server returns only {id} on duplicate clientUuid — only check r.data.id.
 *
 * Groups:
 *   G1  Auth gate
 *   G2  Field CRUD + idempotency + terminal block
 *   G3  Sowing records
 *   G4  Activities
 *   G5  Harvests
 *   G6  Finance (sales, costs, summary)
 *   G7  Metrics shape
 *   G8  Field history
 *   G9  Permission matrix (worker/supervisor/manager)
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { freshDb, call, U, buildFarm, dbRef } from "./harness.js";

vi.mock("../../db.js", () => ({ getSql: () => dbRef.sql }));
vi.mock("../../../_middleware/verifyAuth.js", async () => ({
  verifyToken: (await import("./harness.js")).testVerifyToken,
}));
vi.mock("../../blobStore.js", () => ({ deleteAttachment: async () => {} }));

/* ── shared state ─────────────────────────────────────────────────────────── */

let space;

beforeAll(async () => {
  await freshDb();

  const farm = await buildFarm(10, "Crop Test Farm", {
    managers: [11], supervisors: [12], workers: [13],
  });
  space = farm.space;
}, 60_000);

/* ─── G1: Auth gate ─────────────────────────────────────────────────────── */

describe("G1 – Auth gate", () => {
  it("rejects unauthenticated requests", async () => {
    const r = await call(null, "crop.fields.list", { spaceId: "00000000-0000-0000-0000-000000000000" });
    expect(r.status).toBe(401);
  });

  it("rejects requests without a spaceId", async () => {
    const r = await call(U(10), "crop.fields.list");
    expect([400, 404]).toContain(r.status);
  });

  it("rejects a non-member", async () => {
    const r = await call(U(99), "crop.fields.list", { spaceId: space.id });
    expect([403, 404]).toContain(r.status);
  });

  it("rejects unknown actions", async () => {
    const r = await call(U(10), "crop.unknown.action", { spaceId: space.id });
    expect(r.status).toBe(400);
  });
});

/* ─── G2: Field CRUD + idempotency + terminal ───────────────────────────── */

describe("G2 – Fields", () => {
  let fieldId, fieldId2;

  it("manager can create a field", async () => {
    const r = await call(U(11), "crop.fields.create", {
      spaceId: space.id,
      payload: {
        name: "North Field", area: 2.5, areaUnit: "acres", cropType: "wheat",
        currentCrop: "HD-2967 wheat", season: "rabi",
        clientUuid: "field-north-001",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.name).toBe("North Field");
    expect(r.data.area_unit).toBe("acres");
    expect(r.data.current_status).toBe("fallow");
    fieldId = r.data.id;
  });

  it("create is idempotent via clientUuid", async () => {
    const r = await call(U(11), "crop.fields.create", {
      spaceId: space.id,
      payload: { name: "North Field", area: 2.5, areaUnit: "acres", clientUuid: "field-north-001" },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(fieldId);
  });

  it("manager can create a second field", async () => {
    const r = await call(U(11), "crop.fields.create", {
      spaceId: space.id,
      payload: { name: "South Field", cropType: "rice", season: "kharif", clientUuid: "field-south-001" },
    });
    expect(r.status).toBe(200);
    fieldId2 = r.data.id;
  });

  it("worker cannot create a field", async () => {
    const r = await call(U(13), "crop.fields.create", {
      spaceId: space.id,
      payload: { name: "Worker Field", clientUuid: "field-worker-001" },
    });
    expect(r.status).toBe(403);
  });

  it("can list fields (active only by default)", async () => {
    const r = await call(U(10), "crop.fields.list", { spaceId: space.id });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data)).toBe(true);
    expect(r.data.some(f => f.id === fieldId)).toBe(true);
    expect(r.data.every(f => f.current_status !== "inactive")).toBe(true);
  });

  it("can get field detail", async () => {
    const r = await call(U(10), "crop.fields.get", { spaceId: space.id, payload: { fieldId } });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(fieldId);
    expect(r.data.name).toBe("North Field");
  });

  it("manager can update a field", async () => {
    const r = await call(U(11), "crop.fields.update", {
      spaceId: space.id,
      payload: { fieldId, currentCrop: "Wheat variety A", soilType: "loam" },
    });
    expect(r.status).toBe(200);
    expect(r.data.current_crop).toBe("Wheat variety A");
    expect(r.data.soil_type).toBe("loam");
  });

  it("worker cannot update a field", async () => {
    const r = await call(U(13), "crop.fields.update", {
      spaceId: space.id,
      payload: { fieldId, notes: "worker update" },
    });
    expect(r.status).toBe(403);
  });

  it("manager can set field status to growing", async () => {
    const r = await call(U(11), "crop.fields.setStatus", {
      spaceId: space.id,
      payload: { fieldId, status: "growing" },
    });
    expect(r.status).toBe(200);
    expect(r.data.current_status).toBe("growing");
  });

  it("manager can set field status to inactive (terminal)", async () => {
    const r = await call(U(11), "crop.fields.setStatus", {
      spaceId: space.id,
      payload: { fieldId: fieldId2, status: "inactive" },
    });
    expect(r.status).toBe(200);
    expect(r.data.current_status).toBe("inactive");
  });

  it("inactive field is excluded from active list", async () => {
    const r = await call(U(10), "crop.fields.list", { spaceId: space.id });
    expect(r.status).toBe(200);
    expect(r.data.some(f => f.id === fieldId2)).toBe(false);
    expect(r.data.some(f => f.id === fieldId)).toBe(true);
  });

  it("inactive field appears when includeInactive=true", async () => {
    const r = await call(U(10), "crop.fields.list", {
      spaceId: space.id, payload: { includeInactive: true },
    });
    expect(r.status).toBe(200);
    expect(r.data.some(f => f.id === fieldId2)).toBe(true);
  });

  it("writes to inactive field return 409", async () => {
    const r = await call(U(11), "crop.fields.update", {
      spaceId: space.id,
      payload: { fieldId: fieldId2, notes: "test" },
    });
    expect(r.status).toBe(409);
  });
});

/* ─── G3: Sowing records ────────────────────────────────────────────────── */

describe("G3 – Sowing", () => {
  let fieldId, sowingId;

  beforeAll(async () => {
    const r = await call(U(11), "crop.fields.create", {
      spaceId: space.id,
      payload: { name: "Sowing Test Field", clientUuid: "field-sow-001" },
    });
    fieldId = r.data.id;
  });

  it("supervisor can add sowing", async () => {
    const r = await call(U(12), "crop.sowing.add", {
      spaceId: space.id,
      payload: {
        fieldId, sowingDate: "2026-06-15", crop: "Paddy",
        variety: "IR-64", seedKg: 25, method: "transplant",
        clientUuid: "sow-001",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.crop).toBe("Paddy");
    sowingId = r.data.id;
  });

  it("add sowing is idempotent via clientUuid", async () => {
    const r = await call(U(12), "crop.sowing.add", {
      spaceId: space.id,
      payload: { fieldId, sowingDate: "2026-06-15", crop: "Paddy", clientUuid: "sow-001" },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(sowingId);
  });

  it("worker can add sowing", async () => {
    const r = await call(U(13), "crop.sowing.add", {
      spaceId: space.id,
      payload: { fieldId, sowingDate: "2026-06-20", crop: "Paddy row 2", clientUuid: "sow-worker-001" },
    });
    expect(r.status).toBe(200);
  });

  it("can list sowing records", async () => {
    const r = await call(U(10), "crop.sowing.list", { spaceId: space.id, payload: { fieldId } });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data)).toBe(true);
    expect(r.data.some(s => s.id === sowingId)).toBe(true);
  });

  it("manager can delete sowing", async () => {
    const r = await call(U(11), "crop.sowing.delete", { spaceId: space.id, payload: { sowingId } });
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
  });

  it("worker cannot delete sowing", async () => {
    const list = await call(U(13), "crop.sowing.list", { spaceId: space.id, payload: { fieldId } });
    const workerSow = list.data.find(s => s.crop === "Paddy row 2");
    expect(workerSow).toBeTruthy();
    const r = await call(U(13), "crop.sowing.delete", {
      spaceId: space.id,
      payload: { sowingId: workerSow.id },
    });
    expect(r.status).toBe(403);
  });
});

/* ─── G4: Activities ─────────────────────────────────────────────────────── */

describe("G4 – Activities", () => {
  let fieldId, activityId;

  beforeAll(async () => {
    const r = await call(U(11), "crop.fields.create", {
      spaceId: space.id,
      payload: { name: "Activity Test Field", clientUuid: "field-act-001" },
    });
    fieldId = r.data.id;
  });

  it("supervisor can add irrigation activity", async () => {
    const r = await call(U(12), "crop.activities.add", {
      spaceId: space.id,
      payload: {
        fieldId, activityDate: "2026-07-01",
        activityType: "irrigation", description: "Flood irrigation",
        quantity: 4, unit: "hours", cost: 200,
        clientUuid: "act-001",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.activity_type).toBe("irrigation");
    expect(r.data.cost).toBeCloseTo(200);
    activityId = r.data.id;
  });

  it("add activity is idempotent via clientUuid", async () => {
    const r = await call(U(12), "crop.activities.add", {
      spaceId: space.id,
      payload: { fieldId, activityDate: "2026-07-01", activityType: "irrigation", clientUuid: "act-001" },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(activityId);
  });

  it("worker can add weeding activity", async () => {
    const r = await call(U(13), "crop.activities.add", {
      spaceId: space.id,
      payload: {
        fieldId, activityDate: "2026-07-05",
        activityType: "weeding", description: "Manual weeding",
        clientUuid: "act-worker-001",
      },
    });
    expect(r.status).toBe(200);
  });

  it("can list activities", async () => {
    const r = await call(U(10), "crop.activities.list", { spaceId: space.id, payload: { fieldId } });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data)).toBe(true);
    expect(r.data.some(a => a.id === activityId)).toBe(true);
  });

  it("manager can delete activity", async () => {
    const r = await call(U(11), "crop.activities.delete", { spaceId: space.id, payload: { activityId } });
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
  });

  it("worker cannot delete activity", async () => {
    const list = await call(U(13), "crop.activities.list", { spaceId: space.id, payload: { fieldId } });
    const workerAct = list.data.find(a => a.activity_type === "weeding");
    const r = await call(U(13), "crop.activities.delete", {
      spaceId: space.id,
      payload: { activityId: workerAct.id },
    });
    expect(r.status).toBe(403);
  });
});

/* ─── G5: Harvests ───────────────────────────────────────────────────────── */

describe("G5 – Harvests", () => {
  let fieldId, harvestId;

  beforeAll(async () => {
    const r = await call(U(11), "crop.fields.create", {
      spaceId: space.id,
      payload: { name: "Harvest Test Field", clientUuid: "field-harv-001" },
    });
    fieldId = r.data.id;
  });

  it("supervisor can add harvest", async () => {
    const r = await call(U(12), "crop.harvests.add", {
      spaceId: space.id,
      payload: {
        fieldId, harvestDate: "2026-10-15", crop: "Wheat",
        quantity: 800, unit: "kg", qualityGrade: "A",
        clientUuid: "harv-001",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.crop).toBe("Wheat");
    expect(Number(r.data.quantity)).toBeCloseTo(800);
    harvestId = r.data.id;
  });

  it("add harvest is idempotent via clientUuid", async () => {
    const r = await call(U(12), "crop.harvests.add", {
      spaceId: space.id,
      payload: { fieldId, harvestDate: "2026-10-15", crop: "Wheat", quantity: 800, clientUuid: "harv-001" },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(harvestId);
  });

  it("rejects quantity <= 0", async () => {
    const r = await call(U(12), "crop.harvests.add", {
      spaceId: space.id,
      payload: { fieldId, harvestDate: "2026-10-16", crop: "Rice", quantity: 0, clientUuid: "harv-zero-001" },
    });
    expect(r.status).toBe(400);
  });

  it("can list harvests", async () => {
    const r = await call(U(10), "crop.harvests.list", { spaceId: space.id, payload: { fieldId } });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data)).toBe(true);
    expect(r.data.some(h => h.id === harvestId)).toBe(true);
  });

  it("metrics reflect year harvest qty", async () => {
    const r = await call(U(10), "crop.metrics", { spaceId: space.id });
    expect(r.status).toBe(200);
    expect(Number(r.data.year_harvest_qty)).toBeGreaterThan(0);
  });

  it("manager can delete harvest", async () => {
    const r = await call(U(11), "crop.harvests.delete", { spaceId: space.id, payload: { harvestId } });
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
  });

  it("worker cannot delete harvest", async () => {
    const h = await call(U(12), "crop.harvests.add", {
      spaceId: space.id,
      payload: { fieldId, harvestDate: "2026-10-17", crop: "Rice", quantity: 100, clientUuid: "harv-worker-001" },
    });
    const r = await call(U(13), "crop.harvests.delete", {
      spaceId: space.id,
      payload: { harvestId: h.data.id },
    });
    expect(r.status).toBe(403);
  });
});

/* ─── G6: Finance (sales, costs, summary) ───────────────────────────────── */

describe("G6 – Finance", () => {
  let saleId, costId;

  it("worker is blocked from finance", async () => {
    const r = await call(U(13), "crop.sales.list", { spaceId: space.id });
    expect(r.status).toBe(403);
  });

  it("manager can add sale", async () => {
    const r = await call(U(11), "crop.sales.add", {
      spaceId: space.id,
      payload: {
        saleDate: "2026-10-20", crop: "Wheat",
        amount: 24000, quantity: 800, unit: "kg",
        buyer: "Govind Traders",
        clientUuid: "sale-001",
      },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.amount)).toBeCloseTo(24000);
    saleId = r.data.id;
  });

  it("add sale is idempotent via clientUuid", async () => {
    const r = await call(U(11), "crop.sales.add", {
      spaceId: space.id,
      payload: { saleDate: "2026-10-20", crop: "Wheat", amount: 24000, clientUuid: "sale-001" },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(saleId);
  });

  it("rejects sale amount <= 0", async () => {
    const r = await call(U(11), "crop.sales.add", {
      spaceId: space.id,
      payload: { saleDate: "2026-10-21", crop: "Rice", amount: 0, clientUuid: "sale-zero-001" },
    });
    expect(r.status).toBe(400);
  });

  it("can list sales", async () => {
    const r = await call(U(11), "crop.sales.list", { spaceId: space.id });
    expect(r.status).toBe(200);
    expect(r.data.some(s => s.id === saleId)).toBe(true);
  });

  it("manager can add cost", async () => {
    const r = await call(U(11), "crop.costs.add", {
      spaceId: space.id,
      payload: {
        costDate: "2026-06-10", category: "seeds",
        description: "Wheat seeds HD-2967", amount: 3500,
        clientUuid: "cost-001",
      },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.amount)).toBeCloseTo(3500);
    costId = r.data.id;
  });

  it("add cost is idempotent via clientUuid", async () => {
    const r = await call(U(11), "crop.costs.add", {
      spaceId: space.id,
      payload: {
        costDate: "2026-06-10", category: "seeds",
        description: "Wheat seeds HD-2967", amount: 3500,
        clientUuid: "cost-001",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(costId);
  });

  it("rejects invalid cost category", async () => {
    const r = await call(U(11), "crop.costs.add", {
      spaceId: space.id,
      payload: { costDate: "2026-06-12", category: "invalid_cat", description: "Bad", amount: 100, clientUuid: "cost-bad-001" },
    });
    expect(r.status).toBe(400);
  });

  it("can list costs", async () => {
    const r = await call(U(11), "crop.costs.list", { spaceId: space.id });
    expect(r.status).toBe(200);
    expect(r.data.some(c => c.id === costId)).toBe(true);
  });

  it("finance summary returns correct totals", async () => {
    const r = await call(U(11), "crop.finance.summary", {
      spaceId: space.id,
      payload: { fromDate: "2026-01-01", toDate: "2026-12-31" },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.total_revenue)).toBeCloseTo(24000);
    expect(Number(r.data.total_costs)).toBeCloseTo(3500);
    expect(Number(r.data.net_profit)).toBeCloseTo(20500);
    expect(r.data.sales_by_crop).toHaveProperty("Wheat");
    expect(r.data.cost_breakdown).toHaveProperty("seeds");
  });

  it("finance summary without dates returns 400", async () => {
    const r = await call(U(11), "crop.finance.summary", { spaceId: space.id });
    expect(r.status).toBe(400);
  });

  it("manager can delete sale", async () => {
    const r = await call(U(11), "crop.sales.delete", { spaceId: space.id, payload: { saleId } });
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
  });

  it("manager can delete cost", async () => {
    const r = await call(U(11), "crop.costs.delete", { spaceId: space.id, payload: { costId } });
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
  });

  it("finance summary zeroes after deletion", async () => {
    const r = await call(U(11), "crop.finance.summary", {
      spaceId: space.id,
      payload: { fromDate: "2026-01-01", toDate: "2026-12-31" },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.total_revenue)).toBeCloseTo(0);
    expect(Number(r.data.total_costs)).toBeCloseTo(0);
  });
});

/* ─── G7: Metrics shape ─────────────────────────────────────────────────── */

describe("G7 – Metrics", () => {
  it("metrics has expected shape", async () => {
    const r = await call(U(10), "crop.metrics", { spaceId: space.id });
    expect(r.status).toBe(200);
    expect(typeof r.data.active_fields).toBe("number");
    expect(typeof r.data.growing_count).toBe("number");
    expect(typeof r.data.ready_count).toBe("number");
    expect(typeof r.data.fallow_count).toBe("number");
    expect("year_harvest_qty" in r.data).toBe(true);
  });

  it("worker can read metrics", async () => {
    const r = await call(U(13), "crop.metrics", { spaceId: space.id });
    expect(r.status).toBe(200);
  });
});

/* ─── G8: Field history ─────────────────────────────────────────────────── */

describe("G8 – Field history", () => {
  let fieldId;

  beforeAll(async () => {
    const r = await call(U(11), "crop.fields.create", {
      spaceId: space.id,
      payload: { name: "History Test Field", clientUuid: "field-hist-001" },
    });
    fieldId = r.data.id;
    await call(U(12), "crop.sowing.add", {
      spaceId: space.id,
      payload: { fieldId, sowingDate: "2026-06-01", crop: "Maize", clientUuid: "sow-hist-001" },
    });
    await call(U(12), "crop.activities.add", {
      spaceId: space.id,
      payload: { fieldId, activityDate: "2026-06-20", activityType: "irrigation", clientUuid: "act-hist-001" },
    });
    await call(U(12), "crop.harvests.add", {
      spaceId: space.id,
      payload: { fieldId, harvestDate: "2026-09-01", crop: "Maize", quantity: 600, clientUuid: "harv-hist-001" },
    });
  });

  it("field history includes sowing, activities and harvests", async () => {
    const r = await call(U(10), "crop.field.history", { spaceId: space.id, payload: { fieldId } });
    expect(r.status).toBe(200);
    const kinds = r.data.history.map(e => e.event_kind);
    expect(kinds).toContain("sowing");
    expect(kinds).toContain("activity");
    expect(kinds).toContain("harvest");
  });

  it("history is ordered newest first", async () => {
    const r = await call(U(10), "crop.field.history", { spaceId: space.id, payload: { fieldId } });
    const dates = r.data.history.map(e => e.event_date);
    for (let i = 1; i < dates.length; i++) {
      expect(new Date(dates[i - 1]) >= new Date(dates[i])).toBe(true);
    }
  });
});

/* ─── G9: Permission matrix ─────────────────────────────────────────────── */

describe("G9 – Permission matrix", () => {
  it("worker can view fields", async () => {
    const r = await call(U(13), "crop.fields.list", { spaceId: space.id });
    expect(r.status).toBe(200);
  });

  it("supervisor can view fields", async () => {
    const r = await call(U(12), "crop.fields.list", { spaceId: space.id });
    expect(r.status).toBe(200);
  });

  it("supervisor cannot create fields", async () => {
    const r = await call(U(12), "crop.fields.create", {
      spaceId: space.id,
      payload: { name: "Supervisor Field", clientUuid: "field-sup-create-001" },
    });
    expect(r.status).toBe(403);
  });

  it("worker cannot finance", async () => {
    const r = await call(U(13), "crop.finance.summary", {
      spaceId: space.id,
      payload: { fromDate: "2026-01-01", toDate: "2026-12-31" },
    });
    expect(r.status).toBe(403);
  });

  it("supervisor cannot finance", async () => {
    const r = await call(U(12), "crop.finance.summary", {
      spaceId: space.id,
      payload: { fromDate: "2026-01-01", toDate: "2026-12-31" },
    });
    expect(r.status).toBe(403);
  });

  it("manager has full crop access", async () => {
    const r = await call(U(11), "crop.finance.summary", {
      spaceId: space.id,
      payload: { fromDate: "2026-01-01", toDate: "2026-12-31" },
    });
    expect(r.status).toBe(200);
  });
});
