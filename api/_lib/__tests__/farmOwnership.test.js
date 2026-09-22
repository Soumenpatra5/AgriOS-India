/* Ownership transfer and deleting a Farm Space — the two irreversible-feeling
   actions in the settings screen.

   Both are owner-only and both are checked twice: the routing table requires
   farm.settings.manage, and the handler re-checks role === "owner". That is
   deliberate belt-and-braces — a custom-role override could grant the
   permission to a manager, and neither of these should ever be reachable by
   anyone but the owner. */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { freshDb } from './e2e/harness.js';

import { requireMembership } from "../farm/gate.js";
import { createSpace, listSpaces, transferOwnership, deleteSpace } from "../farm/spaces.js";

import { generateAgriosUserId } from "../agriosId.js";

let db, sql;

beforeAll(async () => {
  const env = await freshDb();
  db = env.pg;
  sql = env.sql;
}, 40000);

let A, B, W, farmA, farmB, memA, memW;

async function seedUser(uid, phone, name = uid) {
  return (await db.query(
    `insert into users (firebase_uid, phone, name, agrios_user_id) values ($1,$2,$3,$4) returning *`,
    [uid, phone, name, generateAgriosUserId()])).rows[0];
}
async function statusOf(fn) {
  try { await fn(); return 200; } catch (e) { return e?.status ?? 500; }
}

beforeEach(async () => {
  await db.exec(`truncate farm_audit_logs, farm_space_invitations, farm_space_memberships,
                          farm_spaces, users restart identity cascade`);

  A = await seedUser("uid-a", "9000000001", "Soumen");
  B = await seedUser("uid-b", "9000000002", "Priya");
  W = await seedUser("uid-w", "9000000005", "Amit");

  farmA = await createSpace(sql, A.id, { name: "AgriOS Farm" });
  farmB = await createSpace(sql, B.id, { name: "Green Valley Farm" });

  await db.query(
    `insert into farm_space_memberships (space_id,user_id,role,status) values ($1,$2,'worker','active')`,
    [farmA.id, W.id]);

  memA = await requireMembership(sql, A.id, farmA.id);
  memW = await requireMembership(sql, W.id, farmA.id);
});

/* A manager who somehow holds farm.settings.manage — the case the handler's
   own role check exists for. */
const managerWithOverride = () => ({ ...memW, role: "manager", permissions: { "farm.settings.manage": true } });

describe("ownership transfer", () => {
  it("moves the farm and keeps the outgoing owner on as a manager", async () => {
    await transferOwnership(sql, memA, A.id, { userId: W.id });

    const nowOwner = await requireMembership(sql, W.id, farmA.id);
    const wasOwner = await requireMembership(sql, A.id, farmA.id);

    expect(nowOwner.role).toBe("owner");
    /* Handing over the keys must not lock you out of your own farm — a farm
       where it did is one nobody would ever hand over. */
    expect(wasOwner.role).toBe("manager");
    expect(wasOwner.status).toBe("active");

    const [space] = await sql`select owner_user_id from farm_spaces where id = ${farmA.id}`;
    expect(space.owner_user_id, "the space's own column moved too").toBe(W.id);
  });

  it("leaves exactly one owner behind", async () => {
    await transferOwnership(sql, memA, A.id, { userId: W.id });
    const [owners] = await sql`
      select count(*)::int n from farm_space_memberships
       where space_id = ${farmA.id} and role = 'owner' and status = 'active'`;
    expect(owners.n).toBe(1);
  });

  it("refuses anyone who is not the owner, permission or not", async () => {
    expect(await statusOf(() => transferOwnership(sql, managerWithOverride(), W.id, { userId: A.id }))).toBe(403);
  });

  it("refuses a non-member and refuses transferring to yourself", async () => {
    expect(await statusOf(() => transferOwnership(sql, memA, A.id, { userId: B.id }))).toBe(404);
    expect(await statusOf(() => transferOwnership(sql, memA, A.id, { userId: A.id }))).toBe(400);
    expect(await statusOf(() => transferOwnership(sql, memA, A.id, {}))).toBe(400);
  });

  it("hands the power over, not a copy of it", async () => {
    await transferOwnership(sql, memA, A.id, { userId: W.id });
    const newOwner = await requireMembership(sql, W.id, farmA.id);
    const demoted = await requireMembership(sql, A.id, farmA.id);

    expect(await statusOf(() => transferOwnership(sql, demoted, A.id, { userId: W.id }))).toBe(403);
    expect(await statusOf(() => transferOwnership(sql, newOwner, W.id, { userId: A.id }))).toBe(200);
  });

  it("records who gave the farm to whom", async () => {
    await transferOwnership(sql, memA, A.id, { userId: W.id });
    const log = await sql`select action, target_id, meta from farm_audit_logs
                           where space_id = ${farmA.id} and action = 'space.ownership_transferred'`;
    expect(log).toHaveLength(1);
    expect(log[0].target_id).toBe(W.id);
    expect(log[0].meta.from).toBe(A.id);
  });
});

describe("deleting a Farm Space", () => {
  it("hides it from every member without destroying their work", async () => {
    await deleteSpace(sql, memA, A.id);

    expect(await listSpaces(sql, A.id)).toEqual([]);
    expect(await listSpaces(sql, W.id)).toEqual([]);
    expect(await statusOf(() => requireMembership(sql, A.id, farmA.id))).toBe(404);

    /* Soft on purpose: memberships, tasks, attendance, announcements and chat
       all cascade from this row, so a hard delete would wipe months of a
       team's work behind one confirmation dialog. */
    const [row] = await sql`select deleted_at from farm_spaces where id = ${farmA.id}`;
    expect(row.deleted_at).toBeTruthy();
    const [members] = await sql`select count(*)::int n from farm_space_memberships where space_id = ${farmA.id}`;
    expect(members.n).toBeGreaterThan(0);
  });

  it("is refused for anyone but the owner", async () => {
    expect(await statusOf(() => deleteSpace(sql, managerWithOverride(), W.id))).toBe(403);
  });

  it("cannot be done twice", async () => {
    await deleteSpace(sql, memA, A.id);
    expect(await statusOf(() => deleteSpace(sql, memA, A.id))).toBe(404);
  });

  it("never touches another farm", async () => {
    await deleteSpace(sql, memA, A.id);
    expect((await listSpaces(sql, B.id)).map((s) => s.name)).toEqual(["Green Valley Farm"]);
  });
});
