/* Farm Space ISOLATION tests — the acceptance criterion for phase 1.

   These run against a real Postgres engine (PGlite, embedded, no external
   server) with the real migrations applied, and they call the real gate and
   the real operations. That matters: a test that mocks the database or
   re-implements the handler's SQL proves the mock is isolated, not the code.

   The scenario throughout is the one the brief mandates:

     User A  owns  Farm A            User B  owns  Farm B
     Worker W is a worker in Farm A  Outsider O belongs to nothing

   and the question is always the same — what happens when someone passes an id
   belonging to a space they are not in. The UI is irrelevant here by design:
   every one of these calls bypasses it entirely, which is the only way to
   prove authorization does not depend on it. */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

import {
  requireMembership, requirePermission, requireScope, visibilityFor, audit,
} from "../farm/gate.js";
import {
  createSpace, updateSpace, archiveSpace, listSpaces,
  listMembers, setMemberRole, removeMember, leaveSpace,
  createInvitation, acceptInvitation, declineInvitation, cancelInvitation,
  listMyInvitations, listSpaceInvitations, lookupUserByAgriosId, listAudit,
} from "../farm/spaces.js";
import { memberCan, canAssignRole, scopeForRole } from "../farm/permissions.js";
import { generateAgriosUserId } from "../agriosId.js";

let db, sql;

/* A tagged-template client over PGlite with the small surface the code uses:
   sql``, sql.json() and sql.begin(). Written once here so the production code
   runs unmodified — the alternative, parameterising every query, would mean
   the tests exercise a different code path than production does. */
function makeSql(pg) {
  const run = async (strings, ...values) => {
    let text = "";
    const params = [];
    strings.forEach((chunk, i) => {
      text += chunk;
      if (i < values.length) {
        const v = values[i];
        params.push(v && v.__json ? JSON.stringify(v.value) : v);
        text += `$${params.length}`;
      }
    });
    const r = await pg.query(text, params);
    return r.rows;
  };
  run.json = (value) => ({ __json: true, value });
  run.begin = async (fn) => {
    await pg.exec("begin");
    try { const out = await fn(run); await pg.exec("commit"); return out; }
    catch (err) { await pg.exec("rollback"); throw err; }
  };
  return run;
}

const m0001 = new URL("../../../supabase/migrations/0001_commerce_foundation.sql", import.meta.url);
const m0002 = new URL("../../../supabase/migrations/0002_farm_space.sql", import.meta.url);
const m0007 = new URL("../../../supabase/migrations/0007_agrios_user_id.sql", import.meta.url);
const m0008 = new URL("../../../supabase/migrations/0008_invitation_by_user_id.sql", import.meta.url);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(m0001, "utf8"));
  await db.exec(await readFile(m0002, "utf8"));
  await db.exec(await readFile(m0007, "utf8"));
  await db.exec(await readFile(m0008, "utf8"));
  sql = makeSql(db);
}, 40000);

let A, B, W, O, farmA, farmB, memA, memB, memW;

/* agrios_user_id is NOT NULL — real ensureUser() generates it, so the seed
   does the same here rather than leaving the column to a migration default
   that does not exist. */
async function seedUser(uid, phone, name = uid) {
  const r = await db.query(
    `insert into users (firebase_uid, phone, name, agrios_user_id) values ($1,$2,$3,$4) returning *`,
    [uid, phone, name, generateAgriosUserId()],
  );
  return r.rows[0];
}

beforeEach(async () => {
  await db.exec(`truncate farm_audit_logs, farm_space_invitations, farm_space_memberships,
                          farm_spaces, users restart identity cascade`);

  A = await seedUser("uid-a", "9000000001", "Soumen");
  B = await seedUser("uid-b", "9000000002", "Priya");
  W = await seedUser("uid-w", "9000000003", "Raju");
  O = await seedUser("uid-o", "9000000004", "Outsider");

  farmA = await createSpace(sql, A.id, { name: "AgriOS Farm" });
  farmB = await createSpace(sql, B.id, { name: "Green Valley Farm" });

  await db.query(
    `insert into farm_space_memberships (space_id, user_id, role, status)
     values ($1,$2,'worker','active')`, [farmA.id, W.id],
  );

  memA = await requireMembership(sql, A.id, farmA.id);
  memB = await requireMembership(sql, B.id, farmB.id);
  memW = await requireMembership(sql, W.id, farmA.id);
});

/* A helper that asserts the thrown HttpError's status, since "it threw" is not
   the same claim as "it refused for the right reason". */
async function statusOf(fn) {
  try { await fn(); return 200; } catch (err) { return err?.status ?? 500; }
}

describe("space creation binds an owner", () => {
  it("makes the creator the owner and the only member", async () => {
    expect(farmA.owner_user_id).toBe(A.id);
    const members = await listMembers(sql, memA);
    /* A as owner, plus the worker the fixture seeds. */
    expect(members).toHaveLength(2);
    const owner = members.find((m) => m.role === "owner");
    expect(owner.user_id).toBe(A.id);

    /* Farm B, created the same way, has exactly its own owner. */
    const bMembers = await listMembers(sql, memB);
    expect(bMembers).toHaveLength(1);
    expect(bMembers[0].user_id).toBe(B.id);
  });

  it("shows a user only the spaces they belong to", async () => {
    const forA = await listSpaces(sql, A.id);
    expect(forA.map((s) => s.name)).toEqual(["AgriOS Farm"]);

    const forO = await listSpaces(sql, O.id);
    expect(forO, "a user in no space sees nothing").toEqual([]);
  });
});

/* ── the mandated cross-farm matrix ──────────────────────────────────────── */

describe("User A cannot reach Farm B", () => {
  it("cannot load a membership for a space they are not in", async () => {
    expect(await statusOf(() => requireMembership(sql, A.id, farmB.id))).toBe(404);
  });

  it("returns 404 rather than 403, so farms cannot be enumerated", async () => {
    const foreign = await statusOf(() => requireMembership(sql, A.id, farmB.id));
    const absent = await statusOf(() => requireMembership(sql, A.id, "00000000-0000-0000-0000-000000000000"));
    expect(foreign, "an existing farm they are not in").toBe(404);
    expect(absent, "a farm that does not exist").toBe(404);
    expect(foreign).toBe(absent);
  });

  it("cannot modify Farm B settings", async () => {
    expect(await statusOf(() => requireMembership(sql, A.id, farmB.id))).toBe(404);
    /* Even holding their own valid membership, the update is scoped to that
       membership's space — so it cannot touch B's row. */
    await updateSpace(sql, memA, A.id, { name: "Renamed A" });
    const [b] = await sql`select name from farm_spaces where id = ${farmB.id}`;
    expect(b.name, "Farm B is untouched").toBe("Green Valley Farm");
  });

  it("cannot invite anyone into Farm B", async () => {
    expect(await statusOf(() => requireMembership(sql, A.id, farmB.id))).toBe(404);
    const invites = await sql`select * from farm_space_invitations where space_id = ${farmB.id}`;
    expect(invites).toEqual([]);
  });

  it("cannot archive Farm B", async () => {
    await archiveSpace(sql, memA, A.id);
    const [b] = await sql`select status from farm_spaces where id = ${farmB.id}`;
    expect(b.status).toBe("active");
  });

  it("cannot read Farm B's audit log", async () => {
    await audit(sql, { spaceId: farmB.id, actorUserId: B.id, action: "secret.thing" });
    const seen = await listAudit(sql, memA);
    expect(seen.some((r) => r.action === "secret.thing")).toBe(false);
  });

  it("cannot see Farm B's members", async () => {
    const members = await listMembers(sql, memA);
    expect(members.every((m) => m.user_id !== B.id)).toBe(true);
  });
});

/* Step 6 — the check that a row fetched by id belongs to the caller's space.
   Passing steps 1-5 only proves membership of SOME space. */
describe("object scope (step 6)", () => {
  it("rejects a row belonging to another space", () => {
    const rowFromB = { id: "x", space_id: farmB.id };
    expect(() => requireScope(rowFromB, memA)).toThrow();
    try { requireScope(rowFromB, memA); } catch (e) { expect(e.status).toBe(404); }
  });

  it("accepts a row from the caller's own space", () => {
    const rowFromA = { id: "x", space_id: farmA.id };
    expect(requireScope(rowFromA, memA)).toBe(rowFromA);
  });

  it("treats a missing row and a foreign row identically", () => {
    const missing = statusFromThrow(() => requireScope(null, memA));
    const foreign = statusFromThrow(() => requireScope({ space_id: farmB.id }, memA));
    expect(missing).toBe(404);
    expect(foreign).toBe(404);
  });

  it("does not confuse a uuid with its string form", () => {
    /* A loose comparison between a driver uuid and a body string is exactly
       the subtlety that becomes a breach. */
    expect(() => requireScope({ space_id: String(farmA.id) }, memA)).not.toThrow();
  });
});

function statusFromThrow(fn) {
  try { fn(); return 200; } catch (e) { return e?.status ?? 500; }
}

/* ── role enforcement inside one space ───────────────────────────────────── */

describe("roles inside a space", () => {
  it("a worker cannot manage members, invite, or change settings", () => {
    expect(memberCan(memW, "farm.view")).toBe(true);
    expect(memberCan(memW, "farm.members.manage")).toBe(false);
    expect(memberCan(memW, "farm.settings.manage")).toBe(false);
    expect(memberCan(memW, "farm.announcement.create")).toBe(false);
    expect(memberCan(memW, "farm.attendance.manage")).toBe(false);
  });

  it("a worker's task and attendance visibility is narrowed to their own", () => {
    expect(visibilityFor(memW, "tasks")).toEqual({ scope: "own", userId: W.id });
    expect(visibilityFor(memW, "attendance")).toEqual({ scope: "own", userId: W.id });
    expect(visibilityFor(memA, "tasks")).toEqual({ scope: "all", userId: null });
    expect(scopeForRole("manager", "attendance")).toBe("all");
  });

  it("requirePermission refuses a worker with 403, not 404", async () => {
    expect(await statusOf(async () => requirePermission(memW, "farm.settings.manage"))).toBe(403);
  });

  it("nobody can assign a role at or above their own", () => {
    expect(canAssignRole("manager", "owner")).toBe(false);
    expect(canAssignRole("manager", "manager")).toBe(false);
    expect(canAssignRole("manager", "supervisor")).toBe(true);
    expect(canAssignRole("owner", "manager")).toBe(true);
    expect(canAssignRole("worker", "worker")).toBe(false);
  });

  it("the owner's role cannot be changed or removed out from under them", async () => {
    expect(await statusOf(() => setMemberRole(sql, memA, A.id, { userId: A.id, role: "manager" }))).toBe(409);
    expect(await statusOf(() => removeMember(sql, memA, A.id, { userId: A.id }))).toBe(409);
    expect(await statusOf(() => leaveSpace(sql, memA, A.id))).toBe(409);
  });

  it("an unknown role grants nothing rather than everything", () => {
    expect(memberCan({ status: "active", role: "administrator", permissions: {} }, "farm.settings.manage")).toBe(false);
    expect(memberCan({ status: "active", role: undefined, permissions: {} }, "farm.members.manage")).toBe(false);
  });

  it("per-member overrides can grant and revoke", () => {
    const promoted = { ...memW, permissions: { "farm.tasks.assign": true } };
    expect(memberCan(promoted, "farm.tasks.assign")).toBe(true);

    const curtailed = { ...memA, permissions: { "farm.settings.manage": false } };
    expect(memberCan(curtailed, "farm.settings.manage")).toBe(false);
  });

  it("an override cannot invent a permission the server does not know", () => {
    const sneaky = { ...memW, permissions: { "farm.everything": true } };
    expect(memberCan(sneaky, "farm.everything")).toBe(false);
  });
});

/* ── membership lifecycle ────────────────────────────────────────────────── */

describe("membership lifecycle", () => {
  it("a removed member immediately loses all access", async () => {
    expect(await statusOf(() => requireMembership(sql, W.id, farmA.id))).toBe(200);

    await removeMember(sql, memA, A.id, { userId: W.id });

    expect(await statusOf(() => requireMembership(sql, W.id, farmA.id))).toBe(404);
    expect(await listSpaces(sql, W.id)).toEqual([]);
  });

  it("an archived space is frozen for its members with 409, not 404", async () => {
    await archiveSpace(sql, memA, A.id);
    expect(await statusOf(() => requireMembership(sql, A.id, farmA.id))).toBe(409);
    /* A non-member still gets 404 — archiving must not reveal existence. */
    expect(await statusOf(() => requireMembership(sql, B.id, farmA.id))).toBe(404);
  });

  it("a non-owner may leave, and then cannot get back in", async () => {
    await leaveSpace(sql, memW, W.id);
    expect(await statusOf(() => requireMembership(sql, W.id, farmA.id))).toBe(404);
  });
});

/* ── invitations ─────────────────────────────────────────────────────────── */

describe("invitations", () => {
  it("only reaches the invited person, and lets them join", async () => {
    await createInvitation(sql, memA, A.id, { agriosUserId: O.agrios_user_id, role: "worker" });

    expect(await listMyInvitations(sql, B), "not addressed to B").toEqual([]);
    const mine = await listMyInvitations(sql, O);
    expect(mine).toHaveLength(1);
    expect(mine[0].space_name).toBe("AgriOS Farm");
    expect(mine[0].invited_by_name).toBe("Soumen");

    await acceptInvitation(sql, O, { invitationId: mine[0].id });
    const m = await requireMembership(sql, O.id, farmA.id);
    expect(m.role).toBe("worker");
  });

  it("cannot be accepted or declined by someone it was not addressed to", async () => {
    await createInvitation(sql, memA, A.id, { agriosUserId: O.agrios_user_id, role: "worker" });
    const [invite] = await sql`select id from farm_space_invitations limit 1`;

    /* B holds a real account and a real invitation id — and still cannot use
       it, because acceptance is matched on the invitee's own account id
       rather than on possession of the invitation id. */
    expect(await statusOf(() => acceptInvitation(sql, B, { invitationId: invite.id }))).toBe(404);
    expect(await statusOf(() => declineInvitation(sql, B, { invitationId: invite.id }))).toBe(404);
    expect(await statusOf(() => requireMembership(sql, B.id, farmA.id))).toBe(404);
  });

  it("the recipient can decline, and it can no longer be accepted afterward", async () => {
    await createInvitation(sql, memA, A.id, { agriosUserId: O.agrios_user_id, role: "worker" });
    const [mine] = await listMyInvitations(sql, O);

    await declineInvitation(sql, O, { invitationId: mine.id });
    expect(await listMyInvitations(sql, O)).toEqual([]);
    expect(await statusOf(() => acceptInvitation(sql, O, { invitationId: mine.id }))).toBe(404);
    expect(await statusOf(() => requireMembership(sql, O.id, farmA.id))).toBe(404);
  });

  it("an expired invitation is neither visible nor acceptable", async () => {
    await createInvitation(sql, memA, A.id, { agriosUserId: O.agrios_user_id, role: "worker" });
    await db.query(`update farm_space_invitations set expires_at = now() - interval '1 day'`);

    expect(await listMyInvitations(sql, O), "an expired invite must not appear as pending").toEqual([]);
    const [invite] = await sql`select id from farm_space_invitations`;
    expect(await statusOf(() => acceptInvitation(sql, O, { invitationId: invite.id }))).toBe(404);
  });

  it("refuses to invite above the inviter's own role", async () => {
    await db.query(`update farm_space_memberships set role='manager' where space_id=$1 and user_id=$2`,
      [farmA.id, W.id]);
    const managerW = await requireMembership(sql, W.id, farmA.id);

    expect(await statusOf(() => createInvitation(sql, managerW, W.id, { agriosUserId: O.agrios_user_id, role: "manager" }))).toBe(403);
    expect(await statusOf(() => createInvitation(sql, managerW, W.id, { agriosUserId: O.agrios_user_id, role: "owner" }))).toBe(400);
  });

  it("refuses a User ID that no account has, rather than creating an unreachable invitation", async () => {
    expect(await statusOf(() => createInvitation(sql, memA, A.id, { agriosUserId: "AGRI-00000000", role: "worker" }))).toBe(404);
    expect(await sql`select * from farm_space_invitations`).toEqual([]);
  });

  it("rejects an invitation with no usable AgriOS User ID", async () => {
    expect(await statusOf(() => createInvitation(sql, memA, A.id, { agriosUserId: "not-an-id", role: "worker" }))).toBe(400);
    expect(await statusOf(() => createInvitation(sql, memA, A.id, {}))).toBe(400);
  });

  it("refuses to let someone invite themselves", async () => {
    expect(await statusOf(() => createInvitation(sql, memA, A.id, { agriosUserId: A.agrios_user_id, role: "worker" }))).toBe(400);
  });

  it("will not invite someone who is already a member", async () => {
    expect(await statusOf(() => createInvitation(sql, memA, A.id, { agriosUserId: W.agrios_user_id, role: "worker" }))).toBe(409);
  });

  it("will not create a second pending invitation for the same person", async () => {
    await createInvitation(sql, memA, A.id, { agriosUserId: O.agrios_user_id, role: "worker" });
    expect(await statusOf(() => createInvitation(sql, memA, A.id, { agriosUserId: O.agrios_user_id, role: "manager" }))).toBe(409);
  });

  it("lets a previously removed member rejoin", async () => {
    await removeMember(sql, memA, A.id, { userId: W.id });
    await createInvitation(sql, memA, A.id, { agriosUserId: W.agrios_user_id, role: "supervisor" });
    const [mine] = await listMyInvitations(sql, W);

    await acceptInvitation(sql, W, { invitationId: mine.id });
    const back = await requireMembership(sql, W.id, farmA.id);
    expect(back.role, "rejoins at the invited role").toBe("supervisor");
  });

  it("lookupUserByAgriosId returns only a name and id, or nothing at all", async () => {
    const found = await lookupUserByAgriosId(sql, O.agrios_user_id);
    expect(found).toEqual({ id: O.id, name: "Outsider", agrios_user_id: O.agrios_user_id });
    expect(await lookupUserByAgriosId(sql, "AGRI-00000000")).toBeNull();
  });

  it("the inviter can cancel a pending invitation, and it can no longer be accepted", async () => {
    await createInvitation(sql, memA, A.id, { agriosUserId: O.agrios_user_id, role: "worker" });
    const [mine] = await listMyInvitations(sql, O);

    await cancelInvitation(sql, memA, A.id, { invitationId: mine.id });
    expect(await listMyInvitations(sql, O)).toEqual([]);
    expect(await statusOf(() => acceptInvitation(sql, O, { invitationId: mine.id }))).toBe(404);
  });

  it("listSpaceInvitations shows the sender's pending invites, not accepted or cancelled ones", async () => {
    await createInvitation(sql, memA, A.id, { agriosUserId: O.agrios_user_id, role: "worker" });
    await createInvitation(sql, memA, A.id, { agriosUserId: B.agrios_user_id, role: "manager" });

    const [forO] = await listMyInvitations(sql, O);
    await acceptInvitation(sql, O, { invitationId: forO.id });

    const pending = await listSpaceInvitations(sql, memA);
    expect(pending).toHaveLength(1);
    expect(pending[0].invited_name).toBe("Priya");
    expect(pending[0].role).toBe("manager");
  });

  it("cannot cancel an invitation belonging to a different Farm Space", async () => {
    await createInvitation(sql, memB, B.id, { agriosUserId: O.agrios_user_id, role: "worker" });
    const [inviteB] = await sql`select id from farm_space_invitations`;

    /* memA is a real, authorized membership — just of the wrong space. The
       same requireScope() every other handler uses is what stops this. */
    expect(await statusOf(() => cancelInvitation(sql, memA, A.id, { invitationId: inviteB.id }))).toBe(404);
  });
});

/* ── audit ───────────────────────────────────────────────────────────────── */

describe("audit trail", () => {
  it("records membership and settings changes, scoped to the space", async () => {
    await createInvitation(sql, memA, A.id, { agriosUserId: O.agrios_user_id, role: "worker" });
    await setMemberRole(sql, memA, A.id, { userId: W.id, role: "supervisor" });
    await updateSpace(sql, memA, A.id, { name: "AgriOS Farm 2" });

    const log = await listAudit(sql, memA);
    const actions = log.map((r) => r.action);
    expect(actions).toContain("space.created");
    expect(actions).toContain("member.invited");
    expect(actions).toContain("member.role_changed");
    expect(actions).toContain("space.settings_changed");
    expect(log.every((r) => r.actor_name === "Soumen")).toBe(true);
  });

  it("never fails the action it is recording", async () => {
    /* A broken audit write must not cost the farmer the work they just did. */
    const broken = Object.assign(async () => { throw new Error("audit table gone"); },
      { json: (v) => v, begin: sql.begin });
    await expect(audit(broken, { spaceId: farmA.id, actorUserId: A.id, action: "x" })).resolves.toBeUndefined();
  });
});
