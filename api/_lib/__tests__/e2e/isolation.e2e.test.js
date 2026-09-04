/* Tier-1: the cross-farm / RBAC attack matrix, through the real handler.

   The tests that matter most in the whole QA program: a fully authorized
   member of Farm-A, holding real credentials, attacks Farm-B with every
   class of forged input the API accepts. The pass condition everywhere is
   the gate's own contract: 404 for anything space-scoped you are not a
   member of (never 403 — a 403 confirms the thing exists), 403 for a real
   member lacking the permission, 401 for no credentials at all. */

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

import { freshDb, call, buildFarm, userIdOf, U } from "./harness.js";

let A, B; // two fully-populated farms
let bTask, bMessage, bAnnouncement, bDm;

beforeAll(async () => {
  await freshDb();
  A = await buildFarm(1, "Attack Source Farm", { managers: [2], workers: [3, 4] });
  B = await buildFarm(11, "Victim Farm", { managers: [12], workers: [13] });

  /* Real objects inside Farm-B for Farm-A members to attack by id. */
  bTask = (await call(U(11), "tasks.create", { spaceId: B.space.id, payload: { title: "B secret task" } })).data;
  bMessage = (await call(U(11), "chat.send", { spaceId: B.space.id, payload: { body: "B secret message" } })).data;
  bAnnouncement = (await call(U(11), "announcements.create", { spaceId: B.space.id, payload: { message: "B only notice" } })).data;
  bDm = (await call(U(11), "dm.open", { spaceId: B.space.id, payload: { otherUserId: await userIdOf(U(12)) } })).data;
}, 120000);

describe("unauthenticated requests", () => {
  it("every action class returns 401 with no credentials", async () => {
    for (const [action, opts] of [
      ["spaces.list", {}],
      ["spaces.get", { spaceId: "00000000-0000-0000-0000-000000000001" }],
      ["chat.list", { spaceId: "00000000-0000-0000-0000-000000000001" }],
      ["tasks.create", { spaceId: "00000000-0000-0000-0000-000000000001", payload: { title: "x" } }],
    ]) {
      const r = await call(null, action, opts);
      expect(r.status, action).toBe(401);
    }
  });

  it("an unknown action is a 400, before any auth work", async () => {
    const r = await call(U(1), "totally.fake", {});
    expect(r.status).toBe(400);
  });
});

describe("forged spaceId: Farm-A member attacks Farm-B wholesale", () => {
  /* Every space-scoped read and write in the routing table, called by a
     Farm-A member with Farm-B's real spaceId. All must 404 identically. */
  const READS = ["spaces.get", "members.list", "tasks.list", "tasks.summary",
    "attendance.list", "announcements.list", "activity.list",
    "chat.list", "chat.pinned", "chat.unread", "chat.search", "dm.conversations"];
  const WRITES = [
    ["spaces.update", { name: "Hacked" }],
    ["members.invite", { agriosUserId: "AGRI-AAAAAAAA", role: "worker" }],
    ["tasks.create", { title: "planted task" }],
    ["attendance.mark", { status: "present" }],
    ["announcements.create", { message: "forged notice" }],
    ["chat.send", { body: "infiltration" }],
    ["dm.open", { otherUserId: "00000000-0000-0000-0000-000000000001" }],
  ];

  it("owner-of-A, manager-of-A and worker-of-A all get identical 404s on reads", async () => {
    for (const attacker of [U(1), U(2), U(3)]) {
      for (const action of READS) {
        const r = await call(attacker, action, { spaceId: B.space.id, payload: { query: "x" } });
        expect(r.status, `${attacker} ${action}`).toBe(404);
      }
    }
  }, 60000);

  it("...and identical 404s on writes — nothing lands in Farm-B", async () => {
    for (const attacker of [U(1), U(3)]) {
      for (const [action, payload] of WRITES) {
        const r = await call(attacker, action, { spaceId: B.space.id, payload });
        expect(r.status, `${attacker} ${action}`).toBe(404);
      }
    }
    /* Prove nothing landed. */
    const msgs = await call(U(11), "chat.list", { spaceId: B.space.id });
    expect(msgs.data.some((m) => m.body === "infiltration")).toBe(false);
    const tasks = await call(U(11), "tasks.list", { spaceId: B.space.id });
    expect(tasks.data.some((t) => t.title === "planted task")).toBe(false);
  }, 60000);
});

describe("cross-farm object ids under the attacker's OWN valid space", () => {
  it("Farm-B's task cannot be read, moved, or edited via Farm-A membership", async () => {
    expect((await call(U(1), "tasks.get", { spaceId: A.space.id, payload: { taskId: bTask.id } })).status).toBe(404);
    expect((await call(U(1), "tasks.setStatus", { spaceId: A.space.id, payload: { taskId: bTask.id, status: "cancelled" } })).status).toBe(404);
    expect((await call(U(1), "tasks.update", { spaceId: A.space.id, payload: { taskId: bTask.id, title: "defaced" } })).status).toBe(404);
  });

  it("Farm-B's chat message cannot be edited, reacted to, pinned, or removed", async () => {
    for (const [action, payload] of [
      ["chat.edit", { messageId: bMessage.id, body: "defaced" }],
      ["chat.react", { messageId: bMessage.id, emoji: "👍" }],
      ["chat.pin", { messageId: bMessage.id }],
      ["chat.remove", { messageId: bMessage.id }],
    ]) {
      const r = await call(U(1), action, { spaceId: A.space.id, payload });
      expect(r.status, action).toBe(404);
    }
    const check = await call(U(11), "chat.list", { spaceId: B.space.id });
    const m = check.data.find((x) => x.id === bMessage.id);
    expect(m.body).toBe("B secret message");
    expect(m.deleted).toBe(false);
  });

  it("Farm-B's announcement and DM conversation are equally unreachable", async () => {
    expect((await call(U(1), "announcements.remove", { spaceId: A.space.id, payload: { announcementId: bAnnouncement.id } })).status).toBe(404);
    expect((await call(U(1), "dm.list", { spaceId: A.space.id, payload: { conversationId: bDm.id } })).status).toBe(404);
    expect((await call(U(1), "dm.send", { spaceId: A.space.id, payload: { conversationId: bDm.id, body: "spy" } })).status).toBe(404);
  });

  it("a DM between two Farm-B members is closed to a THIRD Farm-B member too", async () => {
    expect((await call(U(13), "dm.list", { spaceId: B.space.id, payload: { conversationId: bDm.id } })).status).toBe(404);
    expect((await call(U(13), "dm.send", { spaceId: B.space.id, payload: { conversationId: bDm.id, body: "eavesdrop" } })).status).toBe(404);
  });
});

describe("role escalation inside the attacker's own farm", () => {
  it("a worker cannot perform any manager operation", async () => {
    const worker = U(3);
    const targetId = await userIdOf(U(4));
    for (const [action, payload, expected] of [
      ["members.invite", { agriosUserId: "AGRI-AAAAAAAA", role: "worker" }, 403],
      ["members.setRole", { userId: targetId, role: "manager" }, 403],
      ["members.remove", { userId: targetId }, 403],
      ["members.pendingInvites", {}, 403],
      ["spaces.update", { name: "renamed by worker" }, 403],
      ["spaces.archive", {}, 403],
      ["spaces.delete", {}, 403],
      ["audit.list", {}, 403],
      ["chat.pin", { messageId: "00000000-0000-0000-0000-000000000001" }, 403],
      ["tasks.create", { title: "worker-created" }, 403],
    ]) {
      const r = await call(worker, action, { spaceId: A.space.id, payload });
      expect(r.status, action).toBe(expected);
    }
  });

  it("a worker cannot elevate their own role", async () => {
    const selfId = await userIdOf(U(3));
    const r = await call(U(3), "members.setRole", { spaceId: A.space.id, payload: { userId: selfId, role: "owner" } });
    expect(r.status).toBe(403);
    const members = await call(U(1), "members.list", { spaceId: A.space.id });
    expect(members.data.find((m) => m.user_id === selfId).role).toBe("worker");
  });

  it("a manager cannot assign a role at or above their own", async () => {
    const targetId = await userIdOf(U(3));
    for (const role of ["manager", "owner"]) {
      const r = await call(U(2), "members.setRole", { spaceId: A.space.id, payload: { userId: targetId, role } });
      expect(r.status, role).toBe(403);
    }
  });

  it("a worker cannot mark someone else's attendance", async () => {
    const r = await call(U(3), "attendance.mark", {
      spaceId: A.space.id, payload: { status: "present", userId: await userIdOf(U(4)) } });
    expect(r.status).toBe(403);
  });

  it("a worker cannot read another worker's tasks by id", async () => {
    const t = (await call(U(1), "tasks.create", {
      spaceId: A.space.id, payload: { title: "for 004 only", assignedTo: await userIdOf(U(4)) } })).data;
    /* Whatever field name assignment uses, the created task exists; U(3)
       (a different worker) must not be able to open it. */
    const r = await call(U(3), "tasks.get", { spaceId: A.space.id, payload: { taskId: t.id } });
    expect(r.status).toBe(404);
  });
});
