/* Bee / Apiculture — E2E isolation suite.
 *
 * Drives the real /api/farm handler in-process via harness.js.
 * Tests: apiaries, hives, inspections, harvests, treatments,
 *        finance (sales/costs/summary), and permission checks.
 *
 * Numeric values from the DB come back as strings (PGlite/Postgres wire
 * protocol). Cast with Number() before comparing. */

import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import {
  freshDb, dbRef, call, buildFarm, U, testVerifyToken,
} from "./harness.js";

vi.mock("../../../_lib/db.js", () => ({
  getSql: () => dbRef.sql,
}));
vi.mock("../../../_middleware/verifyAuth.js", () => ({
  verifyToken: testVerifyToken,
}));

/* ── shared state ─────────────────────────────────────────────────────────── */

let space, owner, manager, supervisor, worker;

beforeAll(async () => {
  await freshDb();
  const f = await buildFarm(1, "Honey Farm", {
    managers: [2], supervisors: [3], workers: [4],
  });
  space = f.space; owner = f.owner;
  manager = U(2); supervisor = U(3); worker = U(4);
});

beforeEach(async () => {
  /* Roll back data between groups — not needed because each describe
     creates its own named resources and soft-deletes them.
     PGlite runs single-connection so setup is sequential anyway. */
});

/* ═══════════════════════════════════════════════════════════════════════════
   G1 — Auth & membership gate
   ═══════════════════════════════════════════════════════════════════════════ */

describe("G1 — Auth & membership", () => {
  it("rejects unauthenticated requests", async () => {
    const r = await call(null, "bee.hives.list", { spaceId: space.id });
    expect(r.status).toBe(401);
  });

  it("rejects requests without a spaceId", async () => {
    const r = await call(owner, "bee.hives.list");
    expect(r.status).toBe(400);
  });

  it("rejects a non-member", async () => {
    const nonMember = U(99);
    const r = await call(nonMember, "bee.hives.list", { spaceId: space.id });
    expect(r.status).toBe(403);
  });

  it("rejects unknown action", async () => {
    const r = await call(owner, "bee.oops.list", { spaceId: space.id });
    expect(r.status).toBe(400);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   G2 — Apiaries
   ═══════════════════════════════════════════════════════════════════════════ */

describe("G2 — Apiaries", () => {
  let apiary;

  it("owner can list apiaries (empty)", async () => {
    const r = await call(owner, "bee.apiaries.list", { spaceId: space.id });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data)).toBe(true);
  });

  it("manager can create an apiary", async () => {
    const r = await call(manager, "bee.apiaries.create", {
      spaceId: space.id,
      payload: { name: "East Apiary", location: "East field", clientUuid: "apy-e2e-001" },
    });
    expect(r.status).toBe(200);
    expect(r.data.name).toBe("East Apiary");
    apiary = r.data;
  });

  it("create is idempotent via clientUuid", async () => {
    const r = await call(manager, "bee.apiaries.create", {
      spaceId: space.id,
      payload: { name: "East Apiary DUPLICATE", clientUuid: "apy-e2e-001" },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(apiary.id);
    expect(r.data.name).toBe("East Apiary");
  });

  it("worker cannot create an apiary", async () => {
    const r = await call(worker, "bee.apiaries.create", {
      spaceId: space.id,
      payload: { name: "Unauthorized", clientUuid: "apy-e2e-bad" },
    });
    expect(r.status).toBe(403);
  });

  it("list shows new apiary with hive_count = 0", async () => {
    const r = await call(owner, "bee.apiaries.list", { spaceId: space.id });
    expect(r.status).toBe(200);
    const found = r.data.find((a) => a.id === apiary.id);
    expect(found).toBeTruthy();
    expect(Number(found.hive_count)).toBe(0);
  });

  it("manager can delete the apiary", async () => {
    const r = await call(manager, "bee.apiaries.delete", {
      spaceId: space.id,
      payload: { apiaryId: apiary.id },
    });
    expect(r.status).toBe(200);
  });

  it("deleted apiary no longer in list", async () => {
    const r = await call(owner, "bee.apiaries.list", { spaceId: space.id });
    expect(r.status).toBe(200);
    const found = r.data.find((a) => a.id === apiary.id);
    expect(found).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   G3 — Hives (CRUD + status transitions)
   ═══════════════════════════════════════════════════════════════════════════ */

describe("G3 — Hives", () => {
  let hive1, hive2;

  it("manager creates hive 1 (Langstroth)", async () => {
    const r = await call(manager, "bee.hives.create", {
      spaceId: space.id,
      payload: { name: "H1 Langstroth", hiveType: "langstroth", installationDate: "2026-01-15", clientUuid: "hive-e2e-001" },
    });
    expect(r.status).toBe(200);
    expect(r.data.name).toBe("H1 Langstroth");
    expect(r.data.current_status).toBe("active");
    hive1 = r.data;
  });

  it("manager creates hive 2 (Top Bar)", async () => {
    const r = await call(manager, "bee.hives.create", {
      spaceId: space.id,
      payload: { name: "H2 Top Bar", hiveType: "top_bar", clientUuid: "hive-e2e-002" },
    });
    expect(r.status).toBe(200);
    hive2 = r.data;
  });

  it("create is idempotent via clientUuid", async () => {
    const r = await call(manager, "bee.hives.create", {
      spaceId: space.id,
      payload: { name: "H1 Duplicate", clientUuid: "hive-e2e-001" },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(hive1.id);
  });

  it("listHives returns both hives", async () => {
    const r = await call(owner, "bee.hives.list", { spaceId: space.id });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(2);
    const ids = r.data.map((h) => h.id);
    expect(ids).toContain(hive1.id);
    expect(ids).toContain(hive2.id);
  });

  it("getHive includes last_inspection, last_harvest, last_treatment", async () => {
    const r = await call(owner, "bee.hives.get", {
      spaceId: space.id,
      payload: { hiveId: hive1.id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("last_inspection");
    expect(r.data).toHaveProperty("last_harvest");
    expect(r.data).toHaveProperty("last_treatment");
  });

  it("manager updates hive name and notes", async () => {
    const r = await call(manager, "bee.hives.update", {
      spaceId: space.id,
      payload: { hiveId: hive1.id, name: "H1 Updated", notes: "Relocated" },
    });
    expect(r.status).toBe(200);
    expect(r.data.name).toBe("H1 Updated");
  });

  it("manager sets hive status to queenless", async () => {
    const r = await call(manager, "bee.hives.setStatus", {
      spaceId: space.id,
      payload: { hiveId: hive1.id, status: "queenless" },
    });
    expect(r.status).toBe(200);
    expect(r.data.current_status).toBe("queenless");
  });

  it("manager sets hive status back to active", async () => {
    const r = await call(manager, "bee.hives.setStatus", {
      spaceId: space.id,
      payload: { hiveId: hive1.id, status: "active" },
    });
    expect(r.status).toBe(200);
    expect(r.data.current_status).toBe("active");
  });

  it("manager can mark hive dead (terminal)", async () => {
    const r = await call(manager, "bee.hives.setStatus", {
      spaceId: space.id,
      payload: { hiveId: hive2.id, status: "dead" },
    });
    expect(r.status).toBe(200);
    expect(r.data.current_status).toBe("dead");
  });

  it("terminal hive is excluded from active-only list", async () => {
    const r = await call(owner, "bee.hives.list", { spaceId: space.id });
    expect(r.status).toBe(200);
    const ids = r.data.map((h) => h.id);
    expect(ids).not.toContain(hive2.id);
  });

  it("terminal hive appears in includeTerminal list", async () => {
    const r = await call(owner, "bee.hives.list", {
      spaceId: space.id,
      payload: { includeTerminal: true },
    });
    expect(r.status).toBe(200);
    const ids = r.data.map((h) => h.id);
    expect(ids).toContain(hive2.id);
  });

  it("rejects invalid hiveType on create", async () => {
    const r = await call(manager, "bee.hives.create", {
      spaceId: space.id,
      payload: { name: "Bad", hiveType: "submarine", clientUuid: "hive-e2e-bad" },
    });
    expect(r.status).toBe(400);
  });

  it("worker cannot create a hive", async () => {
    const r = await call(worker, "bee.hives.create", {
      spaceId: space.id,
      payload: { name: "Illegal", clientUuid: "hive-e2e-w1" },
    });
    expect(r.status).toBe(403);
  });

  it("worker cannot update a hive", async () => {
    const r = await call(worker, "bee.hives.update", {
      spaceId: space.id,
      payload: { hiveId: hive1.id, name: "Hacked" },
    });
    expect(r.status).toBe(403);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   G4 — Inspections
   ═══════════════════════════════════════════════════════════════════════════ */

describe("G4 — Inspections", () => {
  let hive, insp1, insp2;

  beforeAll(async () => {
    const r = await call(manager, "bee.hives.create", {
      spaceId: space.id,
      payload: { name: "Inspection Hive", hiveType: "langstroth", clientUuid: "hive-insp-001" },
    });
    hive = r.data;
  });

  it("supervisor can add inspection (full fields)", async () => {
    const r = await call(supervisor, "bee.inspections.add", {
      spaceId: space.id,
      payload: {
        hiveId: hive.id,
        inspectionDate: "2026-09-01",
        colonyStrength: 4,
        queenStatus: "present",
        honeyFrames: 6, broodFrames: 5,
        varroaLevel: "low",
        sawQueen: true, eggsPresent: true,
        notes: "Good colony",
        clientUuid: "insp-e2e-001",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.colony_strength).toBe(4);
    expect(r.data.saw_queen).toBe(true);
    insp1 = r.data;
  });

  it("add inspection is idempotent via clientUuid", async () => {
    const r = await call(supervisor, "bee.inspections.add", {
      spaceId: space.id,
      payload: { hiveId: hive.id, inspectionDate: "2026-09-01", colonyStrength: 3, clientUuid: "insp-e2e-001" },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(insp1.id);
    expect(r.data.colony_strength).toBe(4);
  });

  it("worker can also add inspection (record permission)", async () => {
    const r = await call(worker, "bee.inspections.add", {
      spaceId: space.id,
      payload: {
        hiveId: hive.id,
        inspectionDate: "2026-09-10",
        colonyStrength: 3,
        queenStatus: "unknown",
        varroaLevel: "moderate",
        notes: "Some issues",
        clientUuid: "insp-e2e-002",
      },
    });
    expect(r.status).toBe(200);
    insp2 = r.data;
  });

  it("listInspections returns both, newest first", async () => {
    const r = await call(owner, "bee.inspections.list", {
      spaceId: space.id,
      payload: { hiveId: hive.id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(2);
    expect(r.data[0].id).toBe(insp2.id);
  });

  it("rejects colonyStrength out of range", async () => {
    const r = await call(supervisor, "bee.inspections.add", {
      spaceId: space.id,
      payload: { hiveId: hive.id, inspectionDate: "2026-09-15", colonyStrength: 9, clientUuid: "insp-bad-cs" },
    });
    expect(r.status).toBe(500);
  });

  it("hive history includes inspections", async () => {
    const r = await call(owner, "bee.hive.history", {
      spaceId: space.id,
      payload: { hiveId: hive.id },
    });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data.inspections)).toBe(true);
    expect(r.data.inspections.length).toBeGreaterThanOrEqual(2);
  });

  it("manager can delete inspection", async () => {
    const r = await call(manager, "bee.inspections.delete", {
      spaceId: space.id,
      payload: { inspectionId: insp2.id },
    });
    expect(r.status).toBe(200);
  });

  it("worker cannot delete inspection", async () => {
    const r = await call(worker, "bee.inspections.delete", {
      spaceId: space.id,
      payload: { inspectionId: insp1.id },
    });
    expect(r.status).toBe(403);
  });

  it("rejects inspection on terminal hive", async () => {
    const termR = await call(manager, "bee.hives.create", {
      spaceId: space.id,
      payload: { name: "Terminal Insp Hive", clientUuid: "hive-term-insp" },
    });
    const th = termR.data;
    await call(manager, "bee.hives.setStatus", {
      spaceId: space.id,
      payload: { hiveId: th.id, status: "dead" },
    });
    const r = await call(supervisor, "bee.inspections.add", {
      spaceId: space.id,
      payload: { hiveId: th.id, inspectionDate: "2026-09-12", clientUuid: "insp-term-bad" },
    });
    expect(r.status).toBe(409);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   G5 — Harvests
   ═══════════════════════════════════════════════════════════════════════════ */

describe("G5 — Harvests", () => {
  let hive, harv1, harv2;

  beforeAll(async () => {
    const r = await call(manager, "bee.hives.create", {
      spaceId: space.id,
      payload: { name: "Harvest Hive", clientUuid: "hive-harv-001" },
    });
    hive = r.data;
  });

  it("supervisor can add honey harvest", async () => {
    const r = await call(supervisor, "bee.harvests.add", {
      spaceId: space.id,
      payload: {
        hiveId: hive.id,
        harvestDate: "2026-09-05",
        productType: "honey",
        quantityKg: 3.5,
        qualityGrade: "A",
        clientUuid: "harv-e2e-001",
      },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.quantity_kg)).toBeCloseTo(3.5);
    harv1 = r.data;
  });

  it("worker can add beeswax harvest", async () => {
    const r = await call(worker, "bee.harvests.add", {
      spaceId: space.id,
      payload: {
        hiveId: hive.id,
        harvestDate: "2026-09-06",
        productType: "beeswax",
        quantityKg: 0.3,
        clientUuid: "harv-e2e-002",
      },
    });
    expect(r.status).toBe(200);
    harv2 = r.data;
  });

  it("listHarvests returns both", async () => {
    const r = await call(owner, "bee.harvests.list", {
      spaceId: space.id,
      payload: { hiveId: hive.id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects quantityKg = 0", async () => {
    const r = await call(supervisor, "bee.harvests.add", {
      spaceId: space.id,
      payload: {
        hiveId: hive.id,
        harvestDate: "2026-09-07",
        productType: "honey",
        quantityKg: 0,
        clientUuid: "harv-bad-qty",
      },
    });
    expect(r.status).toBe(400);
  });

  it("rejects invalid productType", async () => {
    const r = await call(supervisor, "bee.harvests.add", {
      spaceId: space.id,
      payload: {
        hiveId: hive.id,
        harvestDate: "2026-09-08",
        productType: "gold",
        quantityKg: 1,
        clientUuid: "harv-bad-type",
      },
    });
    expect(r.status).toBe(500);
  });

  it("manager can delete harvest", async () => {
    const r = await call(manager, "bee.harvests.delete", {
      spaceId: space.id,
      payload: { harvestId: harv2.id },
    });
    expect(r.status).toBe(200);
  });

  it("worker cannot delete harvest", async () => {
    const r = await call(worker, "bee.harvests.delete", {
      spaceId: space.id,
      payload: { harvestId: harv1.id },
    });
    expect(r.status).toBe(403);
  });

  it("hive metrics counts month honey kg", async () => {
    const r = await call(owner, "bee.metrics", { spaceId: space.id });
    expect(r.status).toBe(200);
    expect(Number(r.data.month_honey_kg)).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   G6 — Treatments
   ═══════════════════════════════════════════════════════════════════════════ */

describe("G6 — Treatments", () => {
  let hive, tx1;

  beforeAll(async () => {
    const r = await call(manager, "bee.hives.create", {
      spaceId: space.id,
      payload: { name: "Treatment Hive", clientUuid: "hive-tx-001" },
    });
    hive = r.data;
  });

  it("supervisor can add oxalic acid treatment", async () => {
    const r = await call(supervisor, "bee.treatments.add", {
      spaceId: space.id,
      payload: {
        hiveId: hive.id,
        treatmentDate: "2026-09-03",
        treatmentType: "oxalic_acid",
        productName: "Api-Bioxal",
        dose: "2.1g in 5% solution",
        target: "varroa",
        clientUuid: "tx-e2e-001",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.treatment_type).toBe("oxalic_acid");
    tx1 = r.data;
  });

  it("add treatment is idempotent via clientUuid", async () => {
    const r = await call(supervisor, "bee.treatments.add", {
      spaceId: space.id,
      payload: {
        hiveId: hive.id,
        treatmentDate: "2026-09-03",
        treatmentType: "amitraz",
        clientUuid: "tx-e2e-001",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(tx1.id);
    expect(r.data.treatment_type).toBe("oxalic_acid");
  });

  it("worker can add sugar feed treatment", async () => {
    const r = await call(worker, "bee.treatments.add", {
      spaceId: space.id,
      payload: {
        hiveId: hive.id,
        treatmentDate: "2026-09-04",
        treatmentType: "sugar_feed",
        dose: "1kg sugar : 1L water",
        clientUuid: "tx-e2e-002",
      },
    });
    expect(r.status).toBe(200);
  });

  it("listTreatments returns results", async () => {
    const r = await call(owner, "bee.treatments.list", {
      spaceId: space.id,
      payload: { hiveId: hive.id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(2);
  });

  it("hive history includes treatments", async () => {
    const r = await call(owner, "bee.hive.history", {
      spaceId: space.id,
      payload: { hiveId: hive.id },
    });
    expect(r.status).toBe(200);
    expect(r.data.treatments.length).toBeGreaterThanOrEqual(2);
  });

  it("manager can delete treatment", async () => {
    const r = await call(manager, "bee.treatments.delete", {
      spaceId: space.id,
      payload: { treatmentId: tx1.id },
    });
    expect(r.status).toBe(200);
  });

  it("worker cannot delete treatment", async () => {
    const r = await call(worker, "bee.treatments.delete", {
      spaceId: space.id,
      payload: { treatmentId: tx1.id },
    });
    expect(r.status).toBe(403);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   G7 — Finance (sales, costs, summary)
   ═══════════════════════════════════════════════════════════════════════════ */

describe("G7 — Finance", () => {
  let sale1, cost1;

  it("worker cannot access finance", async () => {
    const r = await call(worker, "bee.sales.list", { spaceId: space.id });
    expect(r.status).toBe(403);
  });

  it("owner can add a honey sale", async () => {
    const r = await call(owner, "bee.sales.add", {
      spaceId: space.id,
      payload: {
        saleDate: "2026-09-10",
        productType: "honey",
        quantityKg: 5,
        unitPrice: 600,
        amount: 3000,
        buyer: "Local market",
        clientUuid: "sale-e2e-001",
      },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.amount)).toBeCloseTo(3000);
    sale1 = r.data;
  });

  it("add sale is idempotent via clientUuid", async () => {
    const r = await call(owner, "bee.sales.add", {
      spaceId: space.id,
      payload: { saleDate: "2026-09-10", productType: "beeswax", amount: 9999, clientUuid: "sale-e2e-001" },
    });
    expect(r.status).toBe(200);
    expect(r.data.id).toBe(sale1.id);
    expect(Number(r.data.amount)).toBeCloseTo(3000);
  });

  it("rejects invalid productType on sale", async () => {
    const r = await call(owner, "bee.sales.add", {
      spaceId: space.id,
      payload: { saleDate: "2026-09-10", productType: "milk", amount: 100, clientUuid: "sale-bad-pt" },
    });
    expect(r.status).toBe(400);
  });

  it("rejects amount = 0 on sale", async () => {
    const r = await call(owner, "bee.sales.add", {
      spaceId: space.id,
      payload: { saleDate: "2026-09-10", productType: "honey", amount: 0, clientUuid: "sale-bad-amt" },
    });
    expect(r.status).toBe(400);
  });

  it("listSales returns the honey sale", async () => {
    const r = await call(owner, "bee.sales.list", {
      spaceId: space.id,
      payload: { fromDate: "2026-09-01", toDate: "2026-09-30" },
    });
    expect(r.status).toBe(200);
    expect(r.data.some((s) => s.id === sale1.id)).toBe(true);
  });

  it("owner can add a cost", async () => {
    const r = await call(owner, "bee.costs.add", {
      spaceId: space.id,
      payload: {
        costDate: "2026-09-08",
        category: "equipment",
        description: "New frames",
        amount: 800,
        clientUuid: "cost-e2e-001",
      },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.amount)).toBeCloseTo(800);
    cost1 = r.data;
  });

  it("rejects invalid category on cost", async () => {
    const r = await call(owner, "bee.costs.add", {
      spaceId: space.id,
      payload: { costDate: "2026-09-08", category: "petrol", description: "Fuel", amount: 100, clientUuid: "cost-bad-cat" },
    });
    expect(r.status).toBe(400);
  });

  it("listCosts returns the equipment cost", async () => {
    const r = await call(owner, "bee.costs.list", {
      spaceId: space.id,
      payload: { fromDate: "2026-09-01", toDate: "2026-09-30" },
    });
    expect(r.status).toBe(200);
    expect(r.data.some((c) => c.id === cost1.id)).toBe(true);
  });

  it("financeSummary returns correct totals", async () => {
    const r = await call(owner, "bee.finance.summary", {
      spaceId: space.id,
      payload: { fromDate: "2026-09-01", toDate: "2026-09-30" },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.total_revenue)).toBeCloseTo(3000);
    expect(Number(r.data.total_costs)).toBeCloseTo(800);
    expect(Number(r.data.net_profit)).toBeCloseTo(2200);
    expect(r.data.sales_breakdown).toHaveProperty("honey");
    expect(r.data.cost_breakdown).toHaveProperty("equipment");
  });

  it("financeSummary requires fromDate and toDate", async () => {
    const r = await call(owner, "bee.finance.summary", { spaceId: space.id });
    expect(r.status).toBe(400);
  });

  it("manager can delete a sale", async () => {
    const r = await call(manager, "bee.sales.delete", {
      spaceId: space.id,
      payload: { saleId: sale1.id },
    });
    expect(r.status).toBe(200);
  });

  it("manager can delete a cost", async () => {
    const r = await call(manager, "bee.costs.delete", {
      spaceId: space.id,
      payload: { costId: cost1.id },
    });
    expect(r.status).toBe(200);
  });

  it("summary zeroes after deletes", async () => {
    const r = await call(owner, "bee.finance.summary", {
      spaceId: space.id,
      payload: { fromDate: "2026-09-01", toDate: "2026-09-30" },
    });
    expect(r.status).toBe(200);
    expect(Number(r.data.total_revenue)).toBeCloseTo(0);
    expect(Number(r.data.total_costs)).toBeCloseTo(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   G8 — Metrics
   ═══════════════════════════════════════════════════════════════════════════ */

describe("G8 — Metrics", () => {
  it("hiveMetrics returns expected shape", async () => {
    const r = await call(owner, "bee.metrics", { spaceId: space.id });
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("active_hives");
    expect(r.data).toHaveProperty("queenless_count");
    expect(r.data).toHaveProperty("weak_count");
    expect(r.data).toHaveProperty("month_honey_kg");
    expect(r.data).toHaveProperty("inspected_last_14d");
    expect(Number(r.data.active_hives)).toBeGreaterThan(0);
  });

  it("worker can read metrics", async () => {
    const r = await call(worker, "bee.metrics", { spaceId: space.id });
    expect(r.status).toBe(200);
  });

  it("listHives includes last_colony_strength from most-recent inspection", async () => {
    const r = await call(owner, "bee.hives.list", {
      spaceId: space.id,
      payload: { includeTerminal: false },
    });
    expect(r.status).toBe(200);
    const hiveWithInsp = r.data.find((h) => h.last_inspection_date !== null);
    if (hiveWithInsp) {
      expect(hiveWithInsp.last_colony_strength).toBeDefined();
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   G9 — Permission matrix spot-checks
   ═══════════════════════════════════════════════════════════════════════════ */

describe("G9 — Permission matrix", () => {
  it("worker can list hives (view permission)", async () => {
    const r = await call(worker, "bee.hives.list", { spaceId: space.id });
    expect(r.status).toBe(200);
  });

  it("supervisor can list hives", async () => {
    const r = await call(supervisor, "bee.hives.list", { spaceId: space.id });
    expect(r.status).toBe(200);
  });

  it("supervisor cannot create a hive (manage permission)", async () => {
    const r = await call(supervisor, "bee.hives.create", {
      spaceId: space.id,
      payload: { name: "Sup Hive", clientUuid: "hive-sup-denied" },
    });
    expect(r.status).toBe(403);
  });

  it("supervisor cannot delete an apiary (manage permission)", async () => {
    const r = await call(supervisor, "bee.apiaries.delete", {
      spaceId: space.id,
      payload: { apiaryId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(r.status).toBe(403);
  });

  it("supervisor cannot access sales (finance permission)", async () => {
    const r = await call(supervisor, "bee.sales.list", { spaceId: space.id });
    expect(r.status).toBe(403);
  });

  it("worker cannot access finance summary", async () => {
    const r = await call(worker, "bee.finance.summary", {
      spaceId: space.id,
      payload: { fromDate: "2026-09-01", toDate: "2026-09-30" },
    });
    expect(r.status).toBe(403);
  });

  it("manager has full bee access", async () => {
    const metrics = await call(manager, "bee.metrics", { spaceId: space.id });
    expect(metrics.status).toBe(200);
    const hives = await call(manager, "bee.hives.list", { spaceId: space.id });
    expect(hives.status).toBe(200);
    const costs = await call(manager, "bee.costs.list", { spaceId: space.id });
    expect(costs.status).toBe(200);
  });
});
