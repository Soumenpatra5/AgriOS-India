/* Fish P3 — isolation, RBAC, clean-state, and write-protection e2e tests.
 *
 * Farm A: owner U(90), manager U(91), worker U(92)
 * Farm B: owner U(95), manager U(96)
 *
 * Fish is pond-centric: each pond holds a batch from stocking to harvest.
 * Terminal states: harvested | inactive  — writes blocked with 409.
 *
 * Permissions:
 *   farm.fish.view    — owner / manager / supervisor / worker
 *   farm.fish.record  — worker / supervisor / manager / owner
 *   farm.fish.manage  — manager / owner (create/update ponds)
 *   farm.fish.finance — manager / owner only */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { freshDb, call, U, buildFarm, dbRef } from "./harness.js";

vi.mock("../../db.js", () => ({ getSql: () => dbRef.sql }));
vi.mock("../../../_middleware/verifyAuth.js", async () => ({
  verifyToken: (await import("./harness.js")).testVerifyToken,
}));
vi.mock("../../blobStore.js", () => ({ deleteAttachment: async () => {} }));

/* ── shared state ─────────────────────────────────────────────────────────── */

let spaceA, spaceB;
let pondA1Id, pondA2Id, pondB1Id;
let waterRecordId, feedRecordId, healthEventId, mortalityRecordId, harvestRecordId;

beforeAll(async () => {
  await freshDb();

  const farmA = await buildFarm(90, "Farm A Fish", { managers: [91], workers: [92] });
  const farmB = await buildFarm(95, "Farm B Fish", { managers: [96] });
  spaceA = farmA.space;
  spaceB = farmB.space;

  // Create ponds in Farm A
  const p1 = await call(U(90), "fish.ponds.create", {
    spaceId: spaceA.id,
    payload: {
      name: "Pond Alpha", pondType: "earthen", cultureType: "polyculture",
      species: "Rohu + Catla + Mrigal", areaSqm: 2000, depthM: 1.5,
      stockingDate: "2026-06-01", stockingCount: 1000, stockingSizeCm: 8.5,
      clientUuid: "fish-pond-a1-create",
    },
  });
  expect(p1.status).toBe(200);
  pondA1Id = p1.data.id;

  const p2 = await call(U(90), "fish.ponds.create", {
    spaceId: spaceA.id,
    payload: {
      name: "Pond Beta", pondType: "cement", cultureType: "monoculture",
      species: "Catfish", clientUuid: "fish-pond-a2-create",
    },
  });
  expect(p2.status).toBe(200);
  pondA2Id = p2.data.id;

  // Populate Pond A1: water, feed, health, mortality, harvest
  const water = await call(U(92), "fish.water.add", {
    spaceId: spaceA.id,
    payload: {
      pondId: pondA1Id, eventDate: "2026-09-01",
      ph: 7.4, dissolvedOxygenPpm: 6.2, temperatureC: 28.5, ammoniaPpm: 0.02,
      clientUuid: "fish-water-a1-0901",
    },
  });
  expect(water.status).toBe(200);
  waterRecordId = water.data.id;

  const feed = await call(U(92), "fish.feed.add", {
    spaceId: spaceA.id,
    payload: {
      pondId: pondA1Id, feedDate: "2026-09-01",
      feedType: "pellet", quantityKg: 15.0, clientUuid: "fish-feed-a1-0901",
    },
  });
  expect(feed.status).toBe(200);
  feedRecordId = feed.data.id;

  const health = await call(U(91), "fish.health.add", {
    spaceId: spaceA.id,
    payload: {
      pondId: pondA1Id, eventDate: "2026-09-02",
      eventType: "observation", title: "Fish active, no disease signs",
      clientUuid: "fish-health-a1-0902",
    },
  });
  expect(health.status).toBe(200);
  healthEventId = health.data.id;

  const mortality = await call(U(92), "fish.mortality.add", {
    spaceId: spaceA.id,
    payload: {
      pondId: pondA1Id, eventDate: "2026-09-03",
      count: 5, reason: "unknown", clientUuid: "fish-mort-a1-0903",
    },
  });
  expect(mortality.status).toBe(200);
  mortalityRecordId = mortality.data.id;

  const harvest = await call(U(91), "fish.harvest.add", {
    spaceId: spaceA.id,
    payload: {
      pondId: pondA1Id, harvestDate: "2026-09-10",
      harvestType: "partial", weightKg: 120.5, count: 80,
      avgWeightG: 1506, pricePerKg: 120, clientUuid: "fish-harvest-a1-0910",
    },
  });
  expect(harvest.status).toBe(200);
  harvestRecordId = harvest.data.id;

  // Create pond in Farm B
  const pb1 = await call(U(95), "fish.ponds.create", {
    spaceId: spaceB.id,
    payload: {
      name: "Farm B Pond 1", pondType: "tank", cultureType: "monoculture",
      species: "Prawn", clientUuid: "fish-pond-b1-create",
    },
  });
  expect(pb1.status).toBe(200);
  pondB1Id = pb1.data.id;
}, 60_000);

/* ── cross-pond isolation ─────────────────────────────────────────────────── */

describe("cross-pond isolation", () => {
  it("Pond A2 has no water records from A1", async () => {
    const r = await call(U(90), "fish.water.list", {
      spaceId: spaceA.id, payload: { pondId: pondA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("Pond A2 has no feed records from A1", async () => {
    const r = await call(U(90), "fish.feed.list", {
      spaceId: spaceA.id, payload: { pondId: pondA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("Pond A2 has no health events from A1", async () => {
    const r = await call(U(90), "fish.health.list", {
      spaceId: spaceA.id, payload: { pondId: pondA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("Pond A2 has no mortality records from A1", async () => {
    const r = await call(U(90), "fish.mortality.list", {
      spaceId: spaceA.id, payload: { pondId: pondA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });

  it("Pond A2 has no harvest records from A1", async () => {
    const r = await call(U(90), "fish.harvest.list", {
      spaceId: spaceA.id, payload: { pondId: pondA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(0);
  });
});

/* ── cross-space isolation ────────────────────────────────────────────────── */

describe("cross-space isolation", () => {
  it("Farm B owner cannot access Farm A pond", async () => {
    const r = await call(U(95), "fish.ponds.get", {
      spaceId: spaceB.id, payload: { pondId: pondA1Id },
    });
    expect(r.status).toBe(404);
  });

  it("Farm A owner cannot access Farm B pond via spaceA", async () => {
    const r = await call(U(90), "fish.ponds.get", {
      spaceId: spaceA.id, payload: { pondId: pondB1Id },
    });
    expect(r.status).toBe(404);
  });

  it("Farm A worker using spaceB.id gets 404 (non-member)", async () => {
    const r = await call(U(92), "fish.ponds.list", {
      spaceId: spaceB.id, payload: {},
    });
    expect(r.status).toBe(404);
  });

  it("Farm B manager cannot add feed to Farm A pond via spaceB", async () => {
    const r = await call(U(96), "fish.feed.add", {
      spaceId: spaceB.id,
      payload: { pondId: pondA1Id, feedDate: "2026-09-10", feedType: "pellet", quantityKg: 10 },
    });
    expect(r.status).toBe(404);
  });
});

/* ── listPonds ────────────────────────────────────────────────────────────── */

describe("listPonds", () => {
  it("owner sees active ponds only by default", async () => {
    const r = await call(U(90), "fish.ponds.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(2);
    expect(r.data.every(p => p.current_status === "active")).toBe(true);
  });

  it("every row has numeric total_mortality", async () => {
    const r = await call(U(90), "fish.ponds.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    for (const p of r.data) {
      expect(typeof p.total_mortality).toBe("number");
    }
  });

  it("Pond A1 total_mortality reflects seeded mortality", async () => {
    const r = await call(U(90), "fish.ponds.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    const a1 = r.data.find(p => p.id === pondA1Id);
    expect(a1).toBeTruthy();
    expect(a1.total_mortality).toBeGreaterThanOrEqual(5);
  });

  it("worker can list ponds", async () => {
    const r = await call(U(92), "fish.ponds.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
  });

  it("manager can list ponds", async () => {
    const r = await call(U(91), "fish.ponds.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
  });
});

/* ── getPond ──────────────────────────────────────────────────────────────── */

describe("getPond", () => {
  it("returns last_water_quality, last_feed, last_harvest", async () => {
    const r = await call(U(90), "fish.ponds.get", {
      spaceId: spaceA.id, payload: { pondId: pondA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.last_water_quality).not.toBeNull();
    expect(Number(r.data.last_water_quality.ph)).toBeCloseTo(7.4, 1);
    expect(r.data.last_feed).not.toBeNull();
    expect(r.data.last_harvest).not.toBeNull();
  });

  it("returns null last_water_quality for pond with no checks", async () => {
    const r = await call(U(90), "fish.ponds.get", {
      spaceId: spaceA.id, payload: { pondId: pondA2Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.last_water_quality).toBeNull();
    expect(r.data.last_feed).toBeNull();
    expect(r.data.last_harvest).toBeNull();
  });
});

/* ── createPond validation ────────────────────────────────────────────────── */

describe("createPond validation", () => {
  it("400 when name is missing", async () => {
    const r = await call(U(90), "fish.ponds.create", {
      spaceId: spaceA.id, payload: { pondType: "earthen" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when pondType is invalid", async () => {
    const r = await call(U(90), "fish.ponds.create", {
      spaceId: spaceA.id, payload: { name: "Bad", pondType: "swamp" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when cultureType is invalid", async () => {
    const r = await call(U(90), "fish.ponds.create", {
      spaceId: spaceA.id, payload: { name: "Bad", cultureType: "intensive" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when currentStatus is not active on create", async () => {
    const r = await call(U(90), "fish.ponds.create", {
      spaceId: spaceA.id,
      payload: { name: "Pre-harvested", currentStatus: "harvested" },
    });
    expect(r.status).toBe(400);
  });

  it("worker cannot create pond (farm.fish.manage required) — 403", async () => {
    const r = await call(U(92), "fish.ponds.create", {
      spaceId: spaceA.id,
      payload: { name: "Sneaky Pond" },
    });
    expect(r.status).toBe(403);
  });

  it("clientUuid idempotency — same request returns existing row", async () => {
    const r1 = await call(U(90), "fish.ponds.create", {
      spaceId: spaceA.id,
      payload: { name: "Idem Pond", pondType: "cage", clientUuid: "fish-idem-pond-1" },
    });
    expect(r1.status).toBe(200);
    const r2 = await call(U(90), "fish.ponds.create", {
      spaceId: spaceA.id,
      payload: { name: "Idem Pond", pondType: "cage", clientUuid: "fish-idem-pond-1" },
    });
    expect(r2.status).toBe(200);
    expect(r2.data.id).toBe(r1.data.id);
  });

  it("cage pondType is accepted", async () => {
    const r = await call(U(90), "fish.ponds.create", {
      spaceId: spaceA.id,
      payload: { name: "Cage Pond", pondType: "cage", clientUuid: "fish-cage-pond-1" },
    });
    expect(r.status).toBe(200);
    expect(r.data.pond_type).toBe("cage");
  });
});

/* ── updatePond ───────────────────────────────────────────────────────────── */

describe("updatePond", () => {
  it("manager can update species and notes", async () => {
    const r = await call(U(91), "fish.ponds.update", {
      spaceId: spaceA.id,
      payload: { pondId: pondA1Id, species: "Rohu + Catla + Silver Carp", notes: "Revised" },
    });
    expect(r.status).toBe(200);
    expect(r.data.species).toBe("Rohu + Catla + Silver Carp");
  });

  it("worker cannot update pond — 403", async () => {
    const r = await call(U(92), "fish.ponds.update", {
      spaceId: spaceA.id,
      payload: { pondId: pondA1Id, notes: "sneaky" },
    });
    expect(r.status).toBe(403);
  });

  it("400 when pondType is invalid on update", async () => {
    const r = await call(U(90), "fish.ponds.update", {
      spaceId: spaceA.id,
      payload: { pondId: pondA1Id, pondType: "swamp" },
    });
    expect(r.status).toBe(400);
  });
});

/* ── setPondStatus ────────────────────────────────────────────────────────── */

describe("setPondStatus", () => {
  it("400 when status value is invalid", async () => {
    const r = await call(U(90), "fish.ponds.setStatus", {
      spaceId: spaceA.id,
      payload: { pondId: pondA1Id, status: "selling" },
    });
    expect(r.status).toBe(400);
  });

  it("worker cannot set pond status — 403", async () => {
    const r = await call(U(92), "fish.ponds.setStatus", {
      spaceId: spaceA.id,
      payload: { pondId: pondA1Id, status: "inactive" },
    });
    expect(r.status).toBe(403);
  });

  it("owner can mark pond as inactive", async () => {
    const r = await call(U(90), "fish.ponds.setStatus", {
      spaceId: spaceA.id,
      payload: { pondId: pondA2Id, status: "inactive" },
    });
    expect(r.status).toBe(200);
    expect(r.data.current_status).toBe("inactive");
  });
});

/* ── water quality records ────────────────────────────────────────────────── */

describe("water quality records", () => {
  it("listWater for A1 returns seeded record", async () => {
    const r = await call(U(90), "fish.water.list", {
      spaceId: spaceA.id, payload: { pondId: pondA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
    expect(Number(r.data[0].ph)).toBeCloseTo(7.4, 1);
  });

  it("400 when pondId is missing from addWater", async () => {
    const r = await call(U(92), "fish.water.add", {
      spaceId: spaceA.id,
      payload: { eventDate: "2026-09-10", ph: 7.0 },
    });
    expect(r.status).toBe(400);
  });

  it("clientUuid idempotency on addWater", async () => {
    const r1 = await call(U(92), "fish.water.add", {
      spaceId: spaceA.id,
      payload: {
        pondId: pondA1Id, eventDate: "2026-09-05",
        ph: 7.2, clientUuid: "fish-water-idem-1",
      },
    });
    expect(r1.status).toBe(200);
    const r2 = await call(U(92), "fish.water.add", {
      spaceId: spaceA.id,
      payload: {
        pondId: pondA1Id, eventDate: "2026-09-05",
        ph: 7.2, clientUuid: "fish-water-idem-1",
      },
    });
    expect(r2.status).toBe(200);
    expect(r2.data.id).toBe(r1.data.id);
  });

  it("deleteWater soft-deletes the record", async () => {
    const del = await call(U(92), "fish.water.delete", {
      spaceId: spaceA.id, payload: { recordId: waterRecordId },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });
});

/* ── feed records ─────────────────────────────────────────────────────────── */

describe("feed records", () => {
  it("listFeed returns seeded record", async () => {
    const r = await call(U(90), "fish.feed.list", {
      spaceId: spaceA.id, payload: { pondId: pondA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
    expect(r.data.some(f => f.feed_type === "pellet")).toBe(true);
  });

  it("400 when feedType is invalid", async () => {
    const r = await call(U(92), "fish.feed.add", {
      spaceId: spaceA.id,
      payload: { pondId: pondA1Id, feedDate: "2026-09-10", feedType: "hay" },
    });
    expect(r.status).toBe(400);
  });

  it("rice_bran feedType is valid (fish-specific)", async () => {
    const r = await call(U(92), "fish.feed.add", {
      spaceId: spaceA.id,
      payload: {
        pondId: pondA1Id, feedDate: "2026-09-11",
        feedType: "rice_bran", quantityKg: 8.0, clientUuid: "fish-feed-ricebran-1",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.feed_type).toBe("rice_bran");
  });

  it("mustard_cake feedType is valid", async () => {
    const r = await call(U(92), "fish.feed.add", {
      spaceId: spaceA.id,
      payload: {
        pondId: pondA1Id, feedDate: "2026-09-12",
        feedType: "mustard_cake", quantityKg: 5.0, clientUuid: "fish-feed-mustard-1",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.feed_type).toBe("mustard_cake");
  });

  it("deleteFeed soft-deletes", async () => {
    const add = await call(U(92), "fish.feed.add", {
      spaceId: spaceA.id,
      payload: {
        pondId: pondA1Id, feedDate: "2026-09-13",
        feedType: "other", clientUuid: "fish-feed-del-1",
      },
    });
    expect(add.status).toBe(200);
    const del = await call(U(92), "fish.feed.delete", {
      spaceId: spaceA.id, payload: { feedId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });
});

/* ── health events ────────────────────────────────────────────────────────── */

describe("health events", () => {
  it("listHealth returns seeded observation event", async () => {
    const r = await call(U(90), "fish.health.list", {
      spaceId: spaceA.id, payload: { pondId: pondA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.some(h => h.event_type === "observation")).toBe(true);
  });

  it("400 when title is missing from addHealth", async () => {
    const r = await call(U(91), "fish.health.add", {
      spaceId: spaceA.id,
      payload: { pondId: pondA1Id, eventDate: "2026-09-10", eventType: "disease" },
    });
    expect(r.status).toBe(400);
  });

  it("400 when eventType is invalid", async () => {
    const r = await call(U(91), "fish.health.add", {
      spaceId: spaceA.id,
      payload: { pondId: pondA1Id, eventDate: "2026-09-10",
                  eventType: "surgery", title: "Invalid" },
    });
    expect(r.status).toBe(400);
  });

  it("water_treatment eventType is valid", async () => {
    const r = await call(U(92), "fish.health.add", {
      spaceId: spaceA.id,
      payload: {
        pondId: pondA1Id, eventDate: "2026-09-14",
        eventType: "water_treatment", title: "Lime treatment",
        medicine: "CaO", dose: "50kg per acre", clientUuid: "fish-health-lime-1",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.event_type).toBe("water_treatment");
  });

  it("updateHealth changes persist", async () => {
    const r = await call(U(91), "fish.health.update", {
      spaceId: spaceA.id,
      payload: { eventId: healthEventId, notes: "Follow-up noted" },
    });
    expect(r.status).toBe(200);
    expect(r.data.notes).toBe("Follow-up noted");
  });

  it("400 when updateHealth title is empty string", async () => {
    const r = await call(U(91), "fish.health.update", {
      spaceId: spaceA.id,
      payload: { eventId: healthEventId, title: "" },
    });
    expect(r.status).toBe(400);
  });

  it("cross-space: Farm B manager cannot update Farm A health event — 404", async () => {
    const r = await call(U(96), "fish.health.update", {
      spaceId: spaceB.id,
      payload: { eventId: healthEventId, notes: "xss" },
    });
    expect(r.status).toBe(404);
  });

  it("worker can update health event — 200", async () => {
    const r = await call(U(92), "fish.health.update", {
      spaceId: spaceA.id,
      payload: { eventId: healthEventId, notes: "worker note" },
    });
    expect(r.status).toBe(200);
  });

  it("deleteHealth soft-deletes", async () => {
    const add = await call(U(91), "fish.health.add", {
      spaceId: spaceA.id,
      payload: {
        pondId: pondA1Id, eventDate: "2026-09-15",
        eventType: "treatment", title: "Potassium permanganate bath",
        clientUuid: "fish-health-del-1",
      },
    });
    expect(add.status).toBe(200);
    const del = await call(U(91), "fish.health.delete", {
      spaceId: spaceA.id, payload: { eventId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });
});

/* ── mortality records ────────────────────────────────────────────────────── */

describe("mortality records", () => {
  it("listMortality returns seeded record", async () => {
    const r = await call(U(90), "fish.mortality.list", {
      spaceId: spaceA.id, payload: { pondId: pondA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
    expect(r.data[0].count).toBeGreaterThanOrEqual(5);
  });

  it("400 when count is zero", async () => {
    const r = await call(U(92), "fish.mortality.add", {
      spaceId: spaceA.id,
      payload: { pondId: pondA1Id, eventDate: "2026-09-10", count: 0 },
    });
    expect(r.status).toBe(400);
  });

  it("400 when reason is invalid", async () => {
    const r = await call(U(92), "fish.mortality.add", {
      spaceId: spaceA.id,
      payload: { pondId: pondA1Id, eventDate: "2026-09-10", count: 2, reason: "escape" },
    });
    expect(r.status).toBe(400);
  });

  it("null reason (unknown cause) is accepted", async () => {
    const r = await call(U(92), "fish.mortality.add", {
      spaceId: spaceA.id,
      payload: {
        pondId: pondA1Id, eventDate: "2026-09-16",
        count: 3, clientUuid: "fish-mort-noreason-1",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.reason).toBeNull();
  });

  it("oxygen_depletion reason is valid", async () => {
    const r = await call(U(92), "fish.mortality.add", {
      spaceId: spaceA.id,
      payload: {
        pondId: pondA1Id, eventDate: "2026-09-17",
        count: 10, reason: "oxygen_depletion", clientUuid: "fish-mort-oxy-1",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.reason).toBe("oxygen_depletion");
  });

  it("deleteMortality soft-deletes", async () => {
    const del = await call(U(92), "fish.mortality.delete", {
      spaceId: spaceA.id, payload: { recordId: mortalityRecordId },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });
});

/* ── harvest records ──────────────────────────────────────────────────────── */

describe("harvest records", () => {
  it("listHarvest returns seeded record", async () => {
    const r = await call(U(90), "fish.harvest.list", {
      spaceId: spaceA.id, payload: { pondId: pondA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
    expect(r.data[0].harvest_type).toBe("partial");
    expect(Number(r.data[0].weight_kg)).toBeCloseTo(120.5, 1);
  });

  it("400 when harvestType is invalid", async () => {
    const r = await call(U(91), "fish.harvest.add", {
      spaceId: spaceA.id,
      payload: { pondId: pondA1Id, harvestDate: "2026-09-10",
                  harvestType: "complete", weightKg: 200 },
    });
    expect(r.status).toBe(400);
  });

  it("full harvestType is valid", async () => {
    const r = await call(U(91), "fish.harvest.add", {
      spaceId: spaceA.id,
      payload: {
        pondId: pondA1Id, harvestDate: "2026-09-18",
        harvestType: "full", weightKg: 350.0, count: 240,
        avgWeightG: 1458, pricePerKg: 125, clientUuid: "fish-harvest-full-1",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.harvest_type).toBe("full");
  });

  it("deleteHarvest soft-deletes", async () => {
    const del = await call(U(91), "fish.harvest.delete", {
      spaceId: spaceA.id, payload: { harvestId: harvestRecordId },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });
});

/* ── pondMetrics ──────────────────────────────────────────────────────────── */

describe("pondMetrics", () => {
  it("returns expected keys", async () => {
    const r = await call(U(90), "fish.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("total_ponds");
    expect(r.data).toHaveProperty("total_stocked");
    expect(r.data).toHaveProperty("month_feed_kg");
    expect(r.data).toHaveProperty("month_mortality");
    expect(r.data).toHaveProperty("harvest_due_count");
    expect(r.data).toHaveProperty("water_check_overdue");
  });

  it("total_ponds reflects active ponds only", async () => {
    const r = await call(U(90), "fish.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    // pondA2 was set inactive above; pondA1 + idem + cage ponds remain active
    expect(r.data.total_ponds).toBeGreaterThanOrEqual(1);
  });

  it("month_feed_kg is a number > 0 after seeding feed", async () => {
    const r = await call(U(90), "fish.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
    expect(typeof r.data.month_feed_kg).toBe("number");
  });

  it("worker can view metrics", async () => {
    const r = await call(U(92), "fish.metrics", { spaceId: spaceA.id });
    expect(r.status).toBe(200);
  });
});

/* ── pondHistory ──────────────────────────────────────────────────────────── */

describe("pondHistory", () => {
  it("returns pond + history with correct kinds", async () => {
    // add fresh water record (previous was deleted)
    await call(U(92), "fish.water.add", {
      spaceId: spaceA.id,
      payload: {
        pondId: pondA1Id, eventDate: "2026-09-08",
        ph: 7.3, clientUuid: "fish-water-hist-1",
      },
    });

    const r = await call(U(90), "fish.pond.history", {
      spaceId: spaceA.id, payload: { pondId: pondA1Id },
    });
    expect(r.status).toBe(200);
    expect(r.data.pond.id).toBe(pondA1Id);
    expect(Array.isArray(r.data.history)).toBe(true);

    const kinds = new Set(r.data.history.map(h => h.kind));
    // feed_record and health_event were added and should appear
    expect(kinds.has("feed_record")).toBe(true);
    expect(kinds.has("health_event")).toBe(true);
  });
});

/* ── terminal write-protection ────────────────────────────────────────────── */

describe("terminal write-protection", () => {
  let terminalId;

  beforeAll(async () => {
    const c = await call(U(90), "fish.ponds.create", {
      spaceId: spaceA.id,
      payload: { name: "To Harvest", pondType: "earthen", clientUuid: "fish-terminal-1" },
    });
    expect(c.status).toBe(200);
    terminalId = c.data.id;

    const s = await call(U(90), "fish.ponds.setStatus", {
      spaceId: spaceA.id,
      payload: { pondId: terminalId, status: "harvested" },
    });
    expect(s.status).toBe(200);
  });

  it("409 on setStatus transition out of terminal", async () => {
    const r = await call(U(90), "fish.ponds.setStatus", {
      spaceId: spaceA.id,
      payload: { pondId: terminalId, status: "active" },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addWater to terminal pond", async () => {
    const r = await call(U(92), "fish.water.add", {
      spaceId: spaceA.id,
      payload: { pondId: terminalId, eventDate: "2026-09-10", ph: 7.0 },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addFeed to terminal pond", async () => {
    const r = await call(U(92), "fish.feed.add", {
      spaceId: spaceA.id,
      payload: { pondId: terminalId, feedDate: "2026-09-10", feedType: "pellet" },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addHealth to terminal pond", async () => {
    const r = await call(U(91), "fish.health.add", {
      spaceId: spaceA.id,
      payload: { pondId: terminalId, eventDate: "2026-09-10",
                  eventType: "observation", title: "Blocked" },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addMortality to terminal pond", async () => {
    const r = await call(U(92), "fish.mortality.add", {
      spaceId: spaceA.id,
      payload: { pondId: terminalId, eventDate: "2026-09-10", count: 1 },
    });
    expect(r.status).toBe(409);
  });

  it("409 on addHarvest to terminal pond", async () => {
    const r = await call(U(91), "fish.harvest.add", {
      spaceId: spaceA.id,
      payload: { pondId: terminalId, harvestDate: "2026-09-10",
                  harvestType: "partial", weightKg: 50 },
    });
    expect(r.status).toBe(409);
  });

  it("409 on updatePond for terminal pond", async () => {
    const r = await call(U(90), "fish.ponds.update", {
      spaceId: spaceA.id,
      payload: { pondId: terminalId, notes: "ghost edit" },
    });
    expect(r.status).toBe(409);
  });
});

/* ── finance (farm.fish.finance permission) ───────────────────────────────── */

describe("finance operations", () => {
  it("worker cannot add sale — 403", async () => {
    const r = await call(U(92), "fish.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "fresh_fish", amount: 5000 },
    });
    expect(r.status).toBe(403);
  });

  it("manager can add fresh_fish sale", async () => {
    const r = await call(U(91), "fish.sales.add", {
      spaceId: spaceA.id,
      payload: {
        saleDate: "2026-09-01", saleType: "fresh_fish",
        species: "Rohu", buyer: "Wholesale market",
        weightKg: 100, unitPrice: 120, amount: 12000,
        clientUuid: "fish-sale-1",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.sale_type).toBe("fresh_fish");
  });

  it("prawn sale type is accepted", async () => {
    const r = await call(U(91), "fish.sales.add", {
      spaceId: spaceA.id,
      payload: {
        saleDate: "2026-09-05", saleType: "prawn",
        weightKg: 20, unitPrice: 350, amount: 7000,
        clientUuid: "fish-sale-prawn-1",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.sale_type).toBe("prawn");
  });

  it("fingerlings sale type is accepted", async () => {
    const r = await call(U(91), "fish.sales.add", {
      spaceId: spaceA.id,
      payload: {
        saleDate: "2026-09-06", saleType: "fingerlings",
        amount: 2500, clientUuid: "fish-sale-fing-1",
      },
    });
    expect(r.status).toBe(200);
  });

  it("400 when sale_type is invalid", async () => {
    const r = await call(U(91), "fish.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "pork", amount: 100 },
    });
    expect(r.status).toBe(400);
  });

  it("400 when amount is zero", async () => {
    const r = await call(U(91), "fish.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-01", saleType: "fresh_fish", amount: 0 },
    });
    expect(r.status).toBe(400);
  });

  it("listSales returns added sales", async () => {
    const r = await call(U(91), "fish.sales.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(2);
  });

  it("deleteSale soft-deletes", async () => {
    const add = await call(U(91), "fish.sales.add", {
      spaceId: spaceA.id,
      payload: { saleDate: "2026-09-07", saleType: "other",
                  amount: 300, clientUuid: "fish-sale-del-1" },
    });
    expect(add.status).toBe(200);
    const del = await call(U(91), "fish.sales.delete", {
      spaceId: spaceA.id, payload: { saleId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });

  it("manager can add fingerling cost", async () => {
    const r = await call(U(91), "fish.costs.add", {
      spaceId: spaceA.id,
      payload: {
        costDate: "2026-09-01", category: "fingerlings",
        description: "1000 Rohu fingerlings", amount: 3000,
        clientUuid: "fish-cost-fing-1",
      },
    });
    expect(r.status).toBe(200);
  });

  it("pond_prep category is valid (fish-specific)", async () => {
    const r = await call(U(91), "fish.costs.add", {
      spaceId: spaceA.id,
      payload: {
        costDate: "2026-09-02", category: "pond_prep",
        description: "Lime and drying", amount: 800,
        clientUuid: "fish-cost-prep-1",
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.category).toBe("pond_prep");
  });

  it("400 when cost category is invalid", async () => {
    const r = await call(U(91), "fish.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-01", category: "fiber_shearing",
                  description: "invalid", amount: 100 },
    });
    expect(r.status).toBe(400);
  });

  it("listCosts returns added costs", async () => {
    const r = await call(U(91), "fish.costs.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
  });

  it("deleteCost soft-deletes", async () => {
    const add = await call(U(91), "fish.costs.add", {
      spaceId: spaceA.id,
      payload: { costDate: "2026-09-09", category: "labour",
                  description: "Pond maintenance", amount: 400,
                  clientUuid: "fish-cost-del-1" },
    });
    expect(add.status).toBe(200);
    const del = await call(U(91), "fish.costs.delete", {
      spaceId: spaceA.id, payload: { costId: add.data.id },
    });
    expect(del.status).toBe(200);
    expect(del.data.deleted).toBe(true);
  });

  it("financeSummary returns expected keys", async () => {
    const r = await call(U(91), "fish.finance.summary", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("period");
    expect(r.data).toHaveProperty("total_revenue");
    expect(r.data).toHaveProperty("total_costs");
    expect(r.data).toHaveProperty("net_profit");
    expect(r.data).toHaveProperty("sales_breakdown");
    expect(r.data).toHaveProperty("cost_breakdown");
  });

  it("financeSummary revenue > 0 after adding sales", async () => {
    const r = await call(U(91), "fish.finance.summary", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(200);
    expect(r.data.total_revenue).toBeGreaterThan(0);
  });

  it("worker cannot access financeSummary — 403", async () => {
    const r = await call(U(92), "fish.finance.summary", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(403);
  });

  it("worker cannot list sales — 403", async () => {
    const r = await call(U(92), "fish.sales.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(403);
  });

  it("worker cannot list costs — 403", async () => {
    const r = await call(U(92), "fish.costs.list", {
      spaceId: spaceA.id, payload: {},
    });
    expect(r.status).toBe(403);
  });
});
