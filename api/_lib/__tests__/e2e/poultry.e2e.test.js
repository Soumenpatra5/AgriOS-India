/* Poultry P1 — sheds, batches, and the isolation matrix.

   Drives the REAL /api/farm handler: the routing table, the six-step gate and
   the poultry handlers, against a fresh in-process Postgres. What these
   assertions see is what a production request would produce.

   The isolation block is the important half. Passing steps 1-5 only proves the
   caller is a member of SOME space; step 6 is what stops Farm A reading and
   editing Farm B's birds, and it is the check a handler added later is most
   likely to forget. Every space-scoped poultry action is attacked here with a
   forged id and must answer 404 — never 403, which would confirm the row
   exists and turn the API into an enumeration oracle. */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { freshDb, dbRef, call, U, buildFarm, materialize, makeSql } from "./harness.js";

vi.mock("../../db.js", () => ({ getSql: () => dbRef.sql }));
vi.mock("../../../_middleware/verifyAuth.js", async () => ({
  verifyToken: (await import("./harness.js")).testVerifyToken,
}));
vi.mock("../../blobStore.js", () => ({ deleteAttachment: async () => {} }));

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

let A, B; // two independent farms

beforeAll(async () => {
  await freshDb();
  makeSql; // referenced so the harness import stays honest
  A = await buildFarm(1, "Poultry Farm A", { managers: [2], supervisors: [3], workers: [4, 5] });
  B = await buildFarm(20, "Poultry Farm B", { managers: [21], workers: [22] });
});

/* ── sheds ────────────────────────────────────────────────────────────────── */

describe("sheds", () => {
  it("a manager creates a shed and every role can read it", async () => {
    const created = await call(U(2), "poultry.sheds.create", {
      spaceId: A.space.id, payload: { name: "Shed 01", capacity: 5000, ventilation_type: "tunnel" },
    });
    expect(created.status).toBe(200);
    expect(created.data.name).toBe("Shed 01");
    expect(created.data.space_id).toBe(A.space.id);

    for (const uid of [U(1), U(2), U(3), U(4)]) {
      const r = await call(uid, "poultry.sheds.list", { spaceId: A.space.id });
      expect(r.status).toBe(200);
      expect(r.data.some((s) => s.name === "Shed 01")).toBe(true);
    }
  });

  it("a worker cannot create a shed", async () => {
    const r = await call(U(4), "poultry.sheds.create", { spaceId: A.space.id, payload: { name: "Sneaky shed" } });
    expect(r.status).toBe(403);
  });

  it("refuses a blank name and a negative capacity", async () => {
    expect((await call(U(2), "poultry.sheds.create", { spaceId: A.space.id, payload: { name: "  " } })).status).toBe(400);
    expect((await call(U(2), "poultry.sheds.create", { spaceId: A.space.id, payload: { name: "Bad", capacity: -5 } })).status).toBe(400);
  });

  it("archiving is refused while the shed still holds an open batch", async () => {
    const shed = (await call(U(2), "poultry.sheds.create", { spaceId: A.space.id, payload: { name: "Shed 09" } })).data;
    const batch = (await call(U(2), "poultry.batches.create", {
      spaceId: A.space.id,
      payload: { name: "Occupier", placement_date: today(), placed_qty: 100, shed_id: shed.id, status: "active" },
    })).data;
    expect(batch.status).toBe("active");

    const blocked = await call(U(2), "poultry.sheds.archive", { spaceId: A.space.id, payload: { shedId: shed.id } });
    expect(blocked.status).toBe(409);

    /* Move the batch out, then the shed archives cleanly. */
    await call(U(2), "poultry.batches.update", { spaceId: A.space.id, payload: { batchId: batch.id, shed_id: null } });
    const ok = await call(U(2), "poultry.sheds.archive", { spaceId: A.space.id, payload: { shedId: shed.id } });
    expect(ok.status).toBe(200);
    expect(ok.data.status).toBe("inactive");
  });
});

/* ── batches ──────────────────────────────────────────────────────────────── */

describe("batches", () => {
  it("creates a batch and derives age from the placement date — never from stored input", async () => {
    const r = await call(U(2), "poultry.batches.create", {
      spaceId: A.space.id,
      payload: {
        name: "Batch A", placement_date: daysAgo(5), placed_qty: 5000,
        breed: "Cobb", strain: "Cobb 500", target_harvest_age_days: 42, target_fcr: 1.6,
      },
    });
    expect(r.status).toBe(200);
    expect(r.data.age_days).toBe(5);
    expect(r.data.age_weeks).toBe(1);          // day 5 is still week 1
    expect(r.data.status).toBe("draft");
    expect(r.data).not.toHaveProperty("ageWeeks"); // the legacy hand-typed field is gone
    /* placement + 42 days */
    const expected = new Date(Date.parse(daysAgo(5)) + 42 * 86400000).toISOString().slice(0, 10);
    expect(r.data.expected_harvest_date).toBe(expected);
  });

  it("reports live birds as provisional until the records that reduce it exist", async () => {
    const b = (await call(U(2), "poultry.batches.create", {
      spaceId: A.space.id, payload: { name: "Provisional", placement_date: today(), placed_qty: 900 },
    })).data;
    expect(b.live_birds).toBe(900);
    expect(b.live_birds_provisional).toBe(true);
  });

  it("rejects impossible placement data", async () => {
    const bad = [
      { name: "", placement_date: today(), placed_qty: 10 },
      { name: "X", placement_date: "not-a-date", placed_qty: 10 },
      { name: "X", placement_date: today(), placed_qty: 0 },
      { name: "X", placement_date: today(), placed_qty: -5 },
      { name: "X", placement_date: today(), placed_qty: 10.5 },
      { name: "X", placement_date: "2999-01-01", placed_qty: 10 },
      { name: "X", placement_date: today(), placed_qty: 10, target_mortality_pct: 150 },
      { name: "X", placement_date: today(), placed_qty: 10, target_fcr: -1 },
    ];
    for (const payload of bad) {
      const r = await call(U(2), "poultry.batches.create", { spaceId: A.space.id, payload });
      expect(r.status, JSON.stringify(payload)).toBe(400);
    }
  });

  it("a worker may read batches but not create or edit one", async () => {
    expect((await call(U(4), "poultry.batches.list", { spaceId: A.space.id })).status).toBe(200);
    expect((await call(U(4), "poultry.batches.create", {
      spaceId: A.space.id, payload: { name: "W", placement_date: today(), placed_qty: 5 },
    })).status).toBe(403);
  });

  it("a supervisor may read but not manage", async () => {
    expect((await call(U(3), "poultry.batches.list", { spaceId: A.space.id })).status).toBe(200);
    expect((await call(U(3), "poultry.batches.create", {
      spaceId: A.space.id, payload: { name: "S", placement_date: today(), placed_qty: 5 },
    })).status).toBe(403);
  });

  it("a batch cannot be parented to another farm's shed", async () => {
    const bShed = (await call(U(21), "poultry.sheds.create", { spaceId: B.space.id, payload: { name: "B Shed" } })).data;
    const r = await call(U(2), "poultry.batches.create", {
      spaceId: A.space.id,
      payload: { name: "Cross", placement_date: today(), placed_qty: 10, shed_id: bShed.id },
    });
    expect(r.status).toBe(404); // indistinguishable from "no such shed"
  });
});

/* ── lifecycle ────────────────────────────────────────────────────────────── */

describe("batch lifecycle", () => {
  const mk = async (name) => (await call(U(2), "poultry.batches.create", {
    spaceId: A.space.id, payload: { name, placement_date: daysAgo(30), placed_qty: 1000 },
  })).data;

  it("walks the legal path draft → active → harvesting → partially_sold → completed → closed", async () => {
    const b = await mk("Lifecycle");
    const path = ["active", "harvesting", "partially_sold", "completed"];
    for (const status of path) {
      const r = await call(U(2), "poultry.batches.setStatus", { spaceId: A.space.id, payload: { batchId: b.id, status } });
      expect(r.status, status).toBe(200);
      expect(r.data.status).toBe(status);
    }
    /* Closing is owner-only: the manager who ran the cycle cannot close it. */
    expect((await call(U(2), "poultry.batches.setStatus", {
      spaceId: A.space.id, payload: { batchId: b.id, status: "closed" } })).status).toBe(403);

    const closed = await call(U(1), "poultry.batches.setStatus", {
      spaceId: A.space.id, payload: { batchId: b.id, status: "closed" } });
    expect(closed.status).toBe(200);
    expect(closed.data.closed_at).toBeTruthy();
  });

  it("refuses illegal jumps", async () => {
    const b = await mk("Illegal");
    for (const status of ["completed", "closed", "partially_sold", "harvesting"]) {
      const r = await call(U(2), "poultry.batches.setStatus", { spaceId: A.space.id, payload: { batchId: b.id, status } });
      expect(r.status, `draft → ${status}`).toBe(409);
    }
    expect((await call(U(2), "poultry.batches.setStatus", {
      spaceId: A.space.id, payload: { batchId: b.id, status: "nonsense" } })).status).toBe(400);
  });

  it("a closed batch refuses edits until it is reopened by the owner", async () => {
    const b = await mk("Frozen");
    for (const s of ["active", "harvesting", "completed"]) {
      await call(U(2), "poultry.batches.setStatus", { spaceId: A.space.id, payload: { batchId: b.id, status: s } });
    }
    await call(U(1), "poultry.batches.setStatus", { spaceId: A.space.id, payload: { batchId: b.id, status: "closed" } });

    const blocked = await call(U(2), "poultry.batches.update", {
      spaceId: A.space.id, payload: { batchId: b.id, notes: "sneaky edit" } });
    expect(blocked.status).toBe(409);

    /* Reopen is owner-only, and then the edit lands. */
    expect((await call(U(2), "poultry.batches.setStatus", {
      spaceId: A.space.id, payload: { batchId: b.id, status: "completed" } })).status).toBe(403);
    expect((await call(U(1), "poultry.batches.setStatus", {
      spaceId: A.space.id, payload: { batchId: b.id, status: "completed" } })).status).toBe(200);
    expect((await call(U(2), "poultry.batches.update", {
      spaceId: A.space.id, payload: { batchId: b.id, notes: "ok now" } })).status).toBe(200);
  });

  it("every transition leaves an audit entry", async () => {
    const b = await mk("Audited");
    await call(U(2), "poultry.batches.setStatus", { spaceId: A.space.id, payload: { batchId: b.id, status: "active", note: "chicks placed" } });
    const rows = await dbRef.sql`
      select * from farm_audit_logs where target_id = ${b.id} and action = 'poultry.batch.status'`;
    expect(rows.length).toBe(1);
    expect(rows[0].meta.from).toBe("draft");
    expect(rows[0].meta.to).toBe("active");
    expect(rows[0].space_id).toBe(A.space.id);
  });
});

/* ── isolation: the attack matrix ─────────────────────────────────────────── */

describe("cross-farm isolation", () => {
  let aBatch, bBatch, bShed;

  beforeAll(async () => {
    aBatch = (await call(U(2), "poultry.batches.create", {
      spaceId: A.space.id, payload: { name: "A-secret", placement_date: today(), placed_qty: 111 } })).data;
    bBatch = (await call(U(21), "poultry.batches.create", {
      spaceId: B.space.id, payload: { name: "B-secret", placement_date: today(), placed_qty: 222 } })).data;
    bShed = (await call(U(21), "poultry.sheds.create", {
      spaceId: B.space.id, payload: { name: "B-shed-2" } })).data;
  });

  it("a member of A never sees B's batches in a list", async () => {
    const r = await call(U(1), "poultry.batches.list", { spaceId: A.space.id });
    expect(r.status).toBe(200);
    expect(r.data.some((b) => b.name === "B-secret")).toBe(false);
  });

  it("forging A's spaceId while addressing B's batch returns 404 on every action", async () => {
    const attacks = [
      ["poultry.batches.get",       { batchId: bBatch.id }],
      ["poultry.batches.update",    { batchId: bBatch.id, notes: "pwned" }],
      ["poultry.batches.setStatus", { batchId: bBatch.id, status: "active" }],
      ["poultry.batches.delete",    { batchId: bBatch.id }],
      ["poultry.sheds.update",      { shedId: bShed.id, name: "pwned" }],
      ["poultry.sheds.archive",     { shedId: bShed.id }],
    ];
    for (const [action, payload] of attacks) {
      const r = await call(U(1), action, { spaceId: A.space.id, payload });
      expect(r.status, action).toBe(404);   // never 403 — no existence oracle
    }
    /* And nothing was actually touched. */
    const [row] = await dbRef.sql`select * from poultry_batches where id = ${bBatch.id}`;
    expect(row.name).toBe("B-secret");
    expect(row.status).toBe("draft");
    expect(row.deleted_at).toBeNull();
  });

  it("a stranger with no membership gets 404, not 403", async () => {
    await materialize(U(90));
    for (const action of ["poultry.batches.list", "poultry.sheds.list"]) {
      const r = await call(U(90), action, { spaceId: A.space.id });
      expect(r.status, action).toBe(404);
    }
  });

  it("an unauthenticated request is rejected before anything else", async () => {
    const r = await call(null, "poultry.batches.list", { spaceId: A.space.id });
    expect(r.status).toBe(401);
  });

  it("a removed member loses access immediately", async () => {
    await call(U(1), "members.remove", { spaceId: A.space.id, payload: { userId: (await dbRef.sql`
      select id from users where firebase_uid = ${U(5)}`)[0].id } });
    const r = await call(U(5), "poultry.batches.list", { spaceId: A.space.id });
    expect(r.status).toBe(404);
  });

  it("space_id is taken from the membership, never from the payload", async () => {
    /* A caller who smuggles another space's id into the body must not have it
       honoured: the row must land in the space they were authorized for. */
    const r = await call(U(2), "poultry.batches.create", {
      spaceId: A.space.id,
      payload: { name: "Smuggled", placement_date: today(), placed_qty: 7, space_id: B.space.id },
    });
    expect(r.status).toBe(200);
    expect(r.data.space_id).toBe(A.space.id);
  });
});
