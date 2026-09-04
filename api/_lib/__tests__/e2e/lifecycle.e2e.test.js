/* Tier-1: user lifecycle + invitation state machine, through the real
   /api/farm handler. See harness.js for what "through the real handler"
   means and for the PGlite concurrency caveat. */

import { describe, it, expect, beforeAll, vi } from "vitest";

vi.mock("../../db.js", async () => {
  const { dbRef } = await import("./harness.js");
  return { getSql: () => dbRef.sql };
});
vi.mock("../../../_middleware/verifyAuth.js", async () => {
  const { testVerifyToken } = await import("./harness.js");
  return { verifyToken: testVerifyToken };
});
vi.mock("../../blobStore.js", () => ({ deleteAttachment: vi.fn(async () => {}) }));

import {
  freshDb, dbRef, call, materialize, createFarm, invite, join, agriosIdOf, U,
} from "./harness.js";

beforeAll(async () => { await freshDb(); }, 120000);

describe("100 users materialize through the real auth path", () => {
  it("creates each user exactly once, with a unique stable AgriOS ID", async () => {
    for (let n = 1; n <= 100; n++) await materialize(U(n));

    const rows = await dbRef.sql`
      select firebase_uid, agrios_user_id, name from users where firebase_uid like 'TEST-USER-%'`;
    expect(rows).toHaveLength(100);

    const ids = rows.map((r) => r.agrios_user_id);
    expect(new Set(ids).size).toBe(100); // no collisions
    for (const id of ids) expect(id).toMatch(/^AGRI-[0-9A-HJKMNP-TV-Z]{8}$/);

    /* Repeat calls must not create duplicates or churn the ID. */
    const before = ids.slice().sort();
    for (let n = 1; n <= 10; n++) await materialize(U(n));
    const again = await dbRef.sql`
      select agrios_user_id from users where firebase_uid like 'TEST-USER-%'`;
    expect(again).toHaveLength(100);
    expect(again.map((r) => r.agrios_user_id).sort()).toEqual(before);
  }, 120000);

  it("a profile-claim change updates the row without changing identity", async () => {
    const beforeRow = (await dbRef.sql`select id, agrios_user_id from users where firebase_uid = ${U(1)}`)[0];
    await call(U(1), "spaces.list", {}, { name: "Renamed Person" });
    const afterRow = (await dbRef.sql`select id, agrios_user_id, name from users where firebase_uid = ${U(1)}`)[0];
    expect(afterRow.id).toBe(beforeRow.id);
    expect(afterRow.agrios_user_id).toBe(beforeRow.agrios_user_id);
    expect(afterRow.name).toBe("Renamed Person");
  });
});

describe("invitation state machine", () => {
  let space;
  beforeAll(async () => {
    space = await createFarm(U(1), "Lifecycle Farm");
  });

  it("invite -> recipient sees it -> accept -> membership with the invited role", async () => {
    const inv = await invite(U(1), space.id, U(2), "manager");
    expect(inv.status).toBe(200);

    const mine = await call(U(2), "invitations.mine");
    expect(mine.data.some((i) => i.id === inv.data.id)).toBe(true);

    const acc = await call(U(2), "invitations.accept", { payload: { invitationId: inv.data.id } });
    expect(acc.status).toBe(200);
    expect(acc.data.role).toBe("manager");

    const members = await call(U(1), "members.list", { spaceId: space.id });
    const m2 = members.data.find((m) => m.name === "Tester 002");
    expect(m2).toBeTruthy();
    expect(m2.role).toBe("manager");
  });

  it("refuses inviting yourself", async () => {
    const r = await call(U(1), "members.invite", {
      spaceId: space.id, payload: { agriosUserId: await agriosIdOf(U(1)), role: "worker" } });
    expect(r.status).toBe(400);
  });

  it("refuses inviting an existing member (409)", async () => {
    const r = await invite(U(1), space.id, U(2), "worker");
    expect(r.status).toBe(409);
  });

  it("refuses a duplicate pending invitation (409)", async () => {
    const first = await invite(U(1), space.id, U(3), "worker");
    expect(first.status).toBe(200);
    const second = await invite(U(1), space.id, U(3), "worker");
    expect(second.status).toBe(409);
  });

  it("refuses an invalid AgriOS User ID (404) without revealing more", async () => {
    const r = await call(U(1), "members.invite", {
      spaceId: space.id, payload: { agriosUserId: "AGRI-ZZZZZZZZ", role: "worker" } });
    expect(r.status).toBe(404);
  });

  it("decline consumes the invitation — it cannot be accepted afterwards", async () => {
    const inv = await invite(U(1), space.id, U(4), "worker");
    const dec = await call(U(4), "invitations.decline", { payload: { invitationId: inv.data.id } });
    expect(dec.status).toBe(200);
    const acc = await call(U(4), "invitations.accept", { payload: { invitationId: inv.data.id } });
    expect(acc.status).not.toBe(200);
    const members = await call(U(1), "members.list", { spaceId: space.id });
    expect(members.data.some((m) => m.name === "Tester 004")).toBe(false);
  });

  it("cancel by a manager consumes the invitation", async () => {
    const inv = await invite(U(1), space.id, U(5), "worker");
    const can = await call(U(1), "invitations.cancel", { spaceId: space.id, payload: { invitationId: inv.data.id } });
    expect(can.status).toBe(200);
    const acc = await call(U(5), "invitations.accept", { payload: { invitationId: inv.data.id } });
    expect(acc.status).not.toBe(200);
  });

  it("an expired invitation cannot be accepted", async () => {
    const inv = await invite(U(1), space.id, U(6), "worker");
    await dbRef.sql`update farm_space_invitations set expires_at = now() - interval '1 day' where id = ${inv.data.id}`;
    const acc = await call(U(6), "invitations.accept", { payload: { invitationId: inv.data.id } });
    expect(acc.status).not.toBe(200);
  });

  it("someone else's invitation cannot be accepted (id is not a bearer token)", async () => {
    const inv = await invite(U(1), space.id, U(7), "worker");
    const thief = await call(U(8), "invitations.accept", { payload: { invitationId: inv.data.id } });
    expect(thief.status).not.toBe(200);
    const members = await call(U(1), "members.list", { spaceId: space.id });
    expect(members.data.some((m) => m.name === "Tester 008")).toBe(false);
  });

  it("a manager cannot invite at or above their own role", async () => {
    /* U(2) is a manager in this space. */
    const asOwner = await invite(U(2), space.id, U(9), "owner");
    expect([400, 403]).toContain(asOwner.status);
    const asManager = await invite(U(2), space.id, U(9), "manager");
    expect(asManager.status).toBe(403);
  });
});

describe("multi-farm membership", () => {
  it("overlapping memberships list correctly per user, and leaving one farm leaves the others intact", async () => {
    const farmA = await createFarm(U(20), "Multi A");
    const farmB = await createFarm(U(21), "Multi B");
    await join(U(20), farmA.id, U(22), "worker");
    await join(U(21), farmB.id, U(22), "supervisor");

    const spaces = await call(U(22), "spaces.list");
    const names = spaces.data.map((s) => s.name).sort();
    expect(names).toEqual(["Multi A", "Multi B"]);

    const leave = await call(U(22), "members.leave", { spaceId: farmA.id });
    expect(leave.status).toBe(200);

    const after = await call(U(22), "spaces.list");
    expect(after.data.map((s) => s.name)).toEqual(["Multi B"]);
  });
});
