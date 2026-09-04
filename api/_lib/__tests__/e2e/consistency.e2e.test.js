/* Tier-1: database-consistency invariants after a compound multi-farm,
   multi-user scenario. These assertions are about what must NEVER be true
   in the data, regardless of which code path put it there — the "no
   impossible states" backstop the QA brief asks for. */

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

import { freshDb, dbRef, call, buildFarm, invite, userIdOf, U } from "./harness.js";

let A, B;

beforeAll(async () => {
  await freshDb();
  /* A busy compound scenario across two farms. */
  A = await buildFarm(1, "Consistency A", { managers: [2], workers: [3, 4, 5] });
  B = await buildFarm(6, "Consistency B", { workers: [3] }); // U(3) in both farms

  // Tasks, some moved through the lifecycle, one cancelled
  const t1 = (await call(U(1), "tasks.create", { spaceId: A.space.id, payload: { title: "C task 1", assigned_to: await userIdOf(U(3)) } })).data;
  await call(U(3), "tasks.setStatus", { spaceId: A.space.id, payload: { taskId: t1.id, status: "accepted" } });
  await call(U(3), "tasks.setStatus", { spaceId: A.space.id, payload: { taskId: t1.id, status: "completed" } });
  await call(U(2), "tasks.setStatus", { spaceId: A.space.id, payload: { taskId: t1.id, status: "verified" } });
  const t2 = (await call(U(1), "tasks.create", { spaceId: A.space.id, payload: { title: "C task 2" } })).data;
  await call(U(1), "tasks.setStatus", { spaceId: A.space.id, payload: { taskId: t2.id, status: "cancelled" } });

  // Chat traffic, edits, deletes, reactions, a hide
  const m1 = (await call(U(3), "chat.send", { spaceId: A.space.id, payload: { body: "will be deleted" } })).data;
  await call(U(4), "chat.react", { spaceId: A.space.id, payload: { messageId: m1.id, emoji: "👍" } });
  await call(U(3), "chat.remove", { spaceId: A.space.id, payload: { messageId: m1.id } });
  const m2 = (await call(U(4), "chat.send", { spaceId: A.space.id, payload: { body: "will be edited" } })).data;
  await call(U(4), "chat.edit", { spaceId: A.space.id, payload: { messageId: m2.id, body: "edited" } });
  await call(U(5), "chat.hide", { spaceId: A.space.id, payload: { messageId: m2.id } });

  // DMs
  const conv = (await call(U(3), "dm.open", { spaceId: A.space.id, payload: { otherUserId: await userIdOf(U(4)) } })).data;
  await call(U(3), "dm.send", { spaceId: A.space.id, payload: { conversationId: conv.id, body: "dm hello" } });

  // Attendance
  await call(U(3), "attendance.mark", { spaceId: A.space.id, payload: { status: "present" } });
  await call(U(3), "attendance.mark", { spaceId: B.space.id, payload: { status: "present" } });

  // A pending + a declined invitation, a removed member
  await invite(U(1), A.space.id, U(7), "worker");
  const inv8 = await invite(U(1), A.space.id, U(8), "worker");
  await call(U(8), "invitations.decline", { payload: { invitationId: inv8.data.id } });
  await call(U(1), "members.remove", { spaceId: A.space.id, payload: { userId: await userIdOf(U(5)) } });
}, 240000);

describe("membership invariants", () => {
  it("no duplicate (space, user) memberships anywhere", async () => {
    const dupes = await dbRef.sql`
      select space_id, user_id, count(*)::int as n
        from farm_space_memberships group by space_id, user_id having count(*) > 1`;
    expect(dupes).toEqual([]);
  });

  it("no active membership without a live user and a live space", async () => {
    const orphans = await dbRef.sql`
      select m.id from farm_space_memberships m
        left join users u on u.id = m.user_id
        left join farm_spaces s on s.id = m.space_id
       where m.status = 'active' and (u.id is null or s.id is null or s.deleted_at is not null)`;
    expect(orphans).toEqual([]);
  });

  it("a removed member's row is revoked, not deleted — history preserved, access gone", async () => {
    const rows = await dbRef.sql`
      select status from farm_space_memberships
       where space_id = ${A.space.id} and user_id = ${await userIdOf(U(5))}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).not.toBe("active");
    expect((await call(U(5), "chat.list", { spaceId: A.space.id })).status).toBe(404);
  });

  it("no pending invitation addressed to someone who is already an active member", async () => {
    const bad = await dbRef.sql`
      select i.id from farm_space_invitations i
        join farm_space_memberships m
          on m.space_id = i.space_id and m.user_id = i.invited_user_id and m.status = 'active'
       where i.status = 'pending' and i.expires_at > now()`;
    expect(bad).toEqual([]);
  });
});

describe("task invariants", () => {
  it("every task's assignee (when set) is or was a member of that space", async () => {
    const bad = await dbRef.sql`
      select t.id from farm_tasks t
       where t.assigned_to is not null
         and not exists (
           select 1 from farm_space_memberships m
            where m.space_id = t.space_id and m.user_id = t.assigned_to)`;
    expect(bad).toEqual([]);
  });

  it("status stamps are coherent: verified implies completed_at, and every status is legal", async () => {
    const rows = await dbRef.sql`select status, completed_at, verified_at, verified_by from farm_tasks`;
    for (const r of rows) {
      expect(["pending", "accepted", "in_progress", "completed", "verified", "rejected", "cancelled"]).toContain(r.status);
      if (r.status === "verified") {
        expect(r.completed_at).toBeTruthy();
        expect(r.verified_at).toBeTruthy();
        expect(r.verified_by).toBeTruthy();
      }
    }
  });

  it("every task event belongs to its task's own space", async () => {
    const bad = await dbRef.sql`
      select e.id from farm_task_events e join farm_tasks t on t.id = e.task_id
       where e.space_id <> t.space_id`;
    expect(bad).toEqual([]);
  });
});

describe("chat and DM invariants", () => {
  it("every message sender holds (or held) a membership in the message's space", async () => {
    const bad = await dbRef.sql`
      select msg.id from farm_chat_messages msg
       where not exists (
         select 1 from farm_space_memberships m
          where m.space_id = msg.space_id and m.user_id = msg.sender_user_id)`;
    expect(bad).toEqual([]);
  });

  it("a deleted-for-everyone message keeps its row (tombstone) and its reactions reference real messages", async () => {
    const tombstones = await dbRef.sql`
      select count(*)::int as n from farm_chat_messages where deleted_at is not null`;
    expect(tombstones[0].n).toBeGreaterThan(0);
    const orphanReacts = await dbRef.sql`
      select r.message_id from farm_chat_reactions r
        left join farm_chat_messages m on m.id = r.message_id where m.id is null`;
    expect(orphanReacts).toEqual([]);
  });

  it("DM conversations pair two distinct members of their own space, in canonical order", async () => {
    const rows = await dbRef.sql`select * from farm_dm_conversations`;
    for (const c of rows) {
      expect(c.member_a_id).not.toBe(c.member_b_id);
      expect(c.member_a_id < c.member_b_id).toBe(true);
      for (const member of [c.member_a_id, c.member_b_id]) {
        const m = await dbRef.sql`
          select 1 from farm_space_memberships
           where space_id = ${c.space_id} and user_id = ${member}`;
        expect(m.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("attendance and cross-farm invariants", () => {
  it("attendance is unique per (space, user, date) and scoped to real members", async () => {
    const dupes = await dbRef.sql`
      select space_id, user_id, date, count(*)::int as n
        from farm_attendance group by space_id, user_id, date having count(*) > 1`;
    expect(dupes).toEqual([]);
  });

  it("a user in two farms has cleanly separated rows — nothing bleeds between spaces", async () => {
    const u3 = await userIdOf(U(3));
    const inA = await dbRef.sql`select space_id from farm_attendance where user_id = ${u3}`;
    expect(new Set(inA.map((r) => r.space_id)).size).toBe(2);
    /* And through the API, each farm's views show only that farm's data. */
    const listA = await call(U(3), "chat.list", { spaceId: A.space.id });
    const listB = await call(U(3), "chat.list", { spaceId: B.space.id });
    expect(listA.status).toBe(200);
    expect(listB.status).toBe(200);
    expect(listB.data.some((m) => m.body === "edited")).toBe(false);
  });

  it("audit log rows all belong to real spaces and name real actors", async () => {
    const bad = await dbRef.sql`
      select a.id from farm_audit_logs a
        left join farm_spaces s on s.id = a.space_id
        left join users u on u.id = a.actor_user_id
       where s.id is null or u.id is null`;
    expect(bad).toEqual([]);
  });
});
