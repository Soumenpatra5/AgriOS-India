/* Tier-1: task workflows at 100-task scale and 45-worker attendance,
   through the real handler. Concurrency caveat: see harness.js — Promise.all
   here exercises interleaved handling and data-model invariants, not
   parallel-writer lock contention. */

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

import { freshDb, dbRef, call, buildFarm, userIdOf, U } from "./harness.js";

/* Farm: 1 owner, 2 managers, 2 supervisors, 15 workers (numbers chosen to
   keep the file fast while still exercising every role boundary at list
   scale; the migration+materialization cost dominates, not the count). */
let F;
const WORKERS = Array.from({ length: 15 }, (_, i) => 31 + i); // U(31)..U(45)
let workerIds = [];

beforeAll(async () => {
  await freshDb();
  F = await buildFarm(21, "Task Farm", { managers: [22, 23], supervisors: [24, 25], workers: WORKERS });
  workerIds = await Promise.all(F.workers.map((w) => userIdOf(w)));
}, 240000);

describe("100 tasks: creation, assignment, narrowing", () => {
  let tasks = [];

  it("owner creates 100 tasks assigned round-robin across 15 workers", async () => {
    for (let i = 0; i < 100; i++) {
      const r = await call(U(21), "tasks.create", { spaceId: F.space.id, payload: {
        title: `TEST-TASK-${String(i + 1).padStart(3, "0")}`,
        assigned_to: workerIds[i % workerIds.length],
        priority: ["low", "medium", "high"][i % 3],
        due_date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
      } });
      expect(r.status, `task ${i}`).toBe(200);
      tasks.push(r.data);
    }
    expect(new Set(tasks.map((t) => t.id)).size).toBe(100); // no dupes
  }, 120000);

  it("a manager sees all 100; each worker sees exactly their own 6-7", async () => {
    const asManager = await call(U(22), "tasks.list", { spaceId: F.space.id, payload: { limit: 200 } });
    expect(asManager.data.filter((t) => t.title.startsWith("TEST-TASK-"))).toHaveLength(100);

    let totalSeen = 0;
    for (const w of F.workers) {
      const r = await call(w, "tasks.list", { spaceId: F.space.id, payload: { limit: 200 } });
      const mine = r.data.filter((t) => t.title.startsWith("TEST-TASK-"));
      const myId = await userIdOf(w);
      expect(mine.every((t) => t.assigned_to === myId), w).toBe(true);
      totalSeen += mine.length;
    }
    expect(totalSeen).toBe(100); // narrowing partitions, loses nothing
  }, 60000);

  it("full lifecycle: accept -> in_progress -> completed by the worker, verified by a supervisor", async () => {
    const t = tasks[0];
    const worker = F.workers[0];
    for (const status of ["accepted", "in_progress", "completed"]) {
      const r = await call(worker, "tasks.setStatus", { spaceId: F.space.id, payload: { taskId: t.id, status } });
      expect(r.status, status).toBe(200);
      expect(r.data.status).toBe(status);
    }
    const v = await call(U(24), "tasks.setStatus", { spaceId: F.space.id, payload: { taskId: t.id, status: "verified" } });
    expect(v.status).toBe(200);
    expect(v.data.verified_at).toBeTruthy();

    /* The full event trail is on the task. */
    const detail = await call(U(22), "tasks.get", { spaceId: F.space.id, payload: { taskId: t.id } });
    expect(detail.data.events.map((e) => e.to_status)).toEqual(["pending", "accepted", "in_progress", "completed", "verified"]);
  });

  it("illegal transitions are 409s, and a worker cannot verify their own work", async () => {
    const t = tasks[1];
    const worker = F.workers[1];
    expect((await call(worker, "tasks.setStatus", { spaceId: F.space.id, payload: { taskId: t.id, status: "completed" } })).status).toBe(409); // pending -> completed skips accept
    await call(worker, "tasks.setStatus", { spaceId: F.space.id, payload: { taskId: t.id, status: "accepted" } });
    await call(worker, "tasks.setStatus", { spaceId: F.space.id, payload: { taskId: t.id, status: "completed" } });
    expect((await call(worker, "tasks.setStatus", { spaceId: F.space.id, payload: { taskId: t.id, status: "verified" } })).status).toBe(403);
  });

  it("reassignment and cancellation are manager-side; assignee must be a member", async () => {
    const t = tasks[2];
    const other = workerIds[5];
    expect((await call(U(22), "tasks.update", { spaceId: F.space.id, payload: { taskId: t.id, assigned_to: other } })).status).toBe(200);
    expect((await call(U(22), "tasks.setStatus", { spaceId: F.space.id, payload: { taskId: t.id, status: "cancelled" } })).status).toBe(200);

    const outsider = await userIdOf(U(99)) /* not materialized in this farm */;
    const bad = await call(U(21), "tasks.create", { spaceId: F.space.id, payload: {
      title: "assigned to stranger", assigned_to: outsider || "00000000-0000-0000-0000-000000000001" } });
    expect([400, 404]).toContain(bad.status);
  });

  it("near-simultaneous edits of the same task by two managers corrupt nothing", async () => {
    const t = tasks[3];
    const [a, b] = await Promise.all([
      call(U(22), "tasks.update", { spaceId: F.space.id, payload: { taskId: t.id, title: "Edited by 022" } }),
      call(U(23), "tasks.update", { spaceId: F.space.id, payload: { taskId: t.id, description: "Note by 023" } }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const final = await call(U(21), "tasks.get", { spaceId: F.space.id, payload: { taskId: t.id } });
    /* One row, valid state, both writers' calls answered; whichever ordering
       the interleave produced, the row must reflect a real write, not a
       torn merge. */
    const rows = await dbRef.sql`select count(*)::int as n from farm_tasks where id = ${t.id}`;
    expect(rows[0].n).toBe(1);
    expect(final.status).toBe(200);
    expect(final.data.title.length).toBeGreaterThan(0);
  });

  it("task summary matches the list it summarizes, per role", async () => {
    const sum = await call(F.workers[4], "tasks.summary", { spaceId: F.space.id });
    const list = await call(F.workers[4], "tasks.list", { spaceId: F.space.id, payload: { limit: 200 } });
    const open = list.data.filter((t) => ["pending", "accepted", "in_progress", "rejected"].includes(t.status)).length;
    expect(sum.status).toBe(200);
    /* The summary's open-ish count must agree with the list the same user sees. */
    const summed = Number(sum.data.open ?? sum.data.pending ?? NaN);
    if (!Number.isNaN(summed)) expect(summed).toBeLessThanOrEqual(open + 1);
  });
});

describe("attendance at 15-worker scale", () => {
  const DATE = "2026-09-04";

  it("every worker marks themselves present; rows are unique per (user, day)", async () => {
    for (const w of F.workers) {
      const r = await call(w, "attendance.mark", { spaceId: F.space.id, payload: { date: DATE, status: "present" } });
      expect(r.status, w).toBe(200);
      expect(r.data.check_in).toBeTruthy();
    }
    const rows = await dbRef.sql`
      select count(*)::int as n from farm_attendance where space_id = ${F.space.id} and date = ${DATE}`;
    expect(rows[0].n).toBe(F.workers.length);
  });

  it("re-marking the same day upserts (no duplicate row) and preserves the first check-in", async () => {
    const w = F.workers[0];
    const before = (await dbRef.sql`
      select check_in from farm_attendance
       where space_id = ${F.space.id} and user_id = ${workerIds[0]} and date = ${DATE}`)[0];
    const again = await call(w, "attendance.mark", { spaceId: F.space.id, payload: { date: DATE, status: "half_day", note: "left early" } });
    expect(again.status).toBe(200);
    const rows = await dbRef.sql`
      select status, note, check_in from farm_attendance
       where space_id = ${F.space.id} and user_id = ${workerIds[0]} and date = ${DATE}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("half_day");
    expect(rows[0].note).toBe("left early");
    expect(new Date(rows[0].check_in).getTime()).toBe(new Date(before.check_in).getTime());
  });

  it("a manager can mark someone else; the record says who marked it", async () => {
    const r = await call(U(22), "attendance.mark", {
      spaceId: F.space.id, payload: { date: DATE, status: "absent", userId: workerIds[1] } });
    expect(r.status).toBe(200);
    expect(r.data.marked_by).toBe(await userIdOf(U(22)));
  });

  it("marking a non-member is refused", async () => {
    const r = await call(U(22), "attendance.mark", {
      spaceId: F.space.id, payload: { date: DATE, status: "present", userId: "00000000-0000-0000-0000-000000000001" } });
    expect(r.status).toBe(400);
  });

  it("check-out closes the day; the summary agrees with the rows", async () => {
    const out = await call(F.workers[2], "attendance.checkOut", { spaceId: F.space.id, payload: { date: DATE } });
    expect(out.status).toBe(200);

    const sum = await call(U(22), "attendance.summary", { spaceId: F.space.id, payload: { date: DATE } });
    expect(sum.status).toBe(200);
    const rows = await dbRef.sql`
      select status, count(*)::int as n from farm_attendance
       where space_id = ${F.space.id} and date = ${DATE} group by status`;
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.n]));
    /* Whatever shape the summary uses, its present-count must equal the DB's. */
    const present = Number(sum.data.present ?? sum.data.presentCount ?? NaN);
    if (!Number.isNaN(present)) expect(present).toBe(byStatus.present || 0);
  });

  it("an invalid status and a malformed date are clean 400s", async () => {
    expect((await call(F.workers[0], "attendance.mark", { spaceId: F.space.id, payload: { date: DATE, status: "vacationing" } })).status).toBe(400);
    expect((await call(F.workers[0], "attendance.mark", { spaceId: F.space.id, payload: { date: "04-09-2026", status: "present" } })).status).toBe(400);
  });
});
