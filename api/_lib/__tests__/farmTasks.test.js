/* Farm Space TASKS — lifecycle, role limits and row-level scoping.

   Same approach as farmSpace.isolation.test.js: real Postgres via PGlite, real
   migrations, real handlers. The questions here are narrower than cross-farm
   isolation but just as easy to get wrong — a worker who can read the farm's
   whole task list, or complete work assigned to someone else, is a leak inside
   a space rather than between them.

   Cast:
     A  owner of Farm A          B  owner of Farm B
     M  manager in Farm A        S  supervisor in Farm A
     W  worker in Farm A         V  a second worker in Farm A */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

import { requireMembership } from "../farm/gate.js";
import { createSpace } from "../farm/spaces.js";
import { generateAgriosUserId } from "../agriosId.js";
import {
  listTasks, getTask, createTask, updateTask, setTaskStatus, taskSummary,
  validateTaskInput, withOverdue,
} from "../farm/tasks.js";

let db, sql;

function makeSql(pg) {
  const run = async (strings, ...values) => {
    let text = ""; const params = [];
    strings.forEach((chunk, i) => {
      text += chunk;
      if (i < values.length) {
        const v = values[i];
        params.push(v && v.__json ? JSON.stringify(v.value) : v);
        text += `$${params.length}`;
      }
    });
    return (await pg.query(text, params)).rows;
  };
  run.json = (value) => ({ __json: true, value });
  run.begin = async (fn) => {
    await pg.exec("begin");
    try { const out = await fn(run); await pg.exec("commit"); return out; }
    catch (err) { await pg.exec("rollback"); throw err; }
  };
  return run;
}

const mig = (n) => new URL(`../../../supabase/migrations/${n}`, import.meta.url);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(mig("0001_commerce_foundation.sql"), "utf8"));
  await db.exec(await readFile(mig("0002_farm_space.sql"), "utf8"));
  await db.exec(await readFile(mig("0003_farm_tasks.sql"), "utf8"));
  /* listTasks/getTask now select the assignee's agrios_user_id as a name
     fallback. */
  await db.exec(await readFile(mig("0007_agrios_user_id.sql"), "utf8"));
  sql = makeSql(db);
}, 40000);

let A, B, M, S, W, V, farmA, farmB, memA, memB, memM, memS, memW, memV;

async function seedUser(uid, phone, name = uid) {
  return (await db.query(
    `insert into users (firebase_uid, phone, name, agrios_user_id) values ($1,$2,$3,$4) returning *`,
    [uid, phone, name, generateAgriosUserId()])).rows[0];
}
async function join(spaceId, userId, role) {
  await db.query(
    `insert into farm_space_memberships (space_id,user_id,role,status) values ($1,$2,$3,'active')`,
    [spaceId, userId, role]);
}

async function statusOf(fn) {
  try { await fn(); return 200; } catch (e) { return e?.status ?? 500; }
}

beforeEach(async () => {
  await db.exec(`truncate farm_task_events, farm_tasks, farm_audit_logs,
                          farm_space_invitations, farm_space_memberships,
                          farm_spaces, users restart identity cascade`);

  A = await seedUser("uid-a", "9000000001", "Soumen");
  B = await seedUser("uid-b", "9000000002", "Priya");
  M = await seedUser("uid-m", "9000000003", "Raju");
  S = await seedUser("uid-s", "9000000004", "Sunil");
  W = await seedUser("uid-w", "9000000005", "Amit");
  V = await seedUser("uid-v", "9000000006", "Rahul");

  farmA = await createSpace(sql, A.id, { name: "AgriOS Farm" });
  farmB = await createSpace(sql, B.id, { name: "Green Valley Farm" });

  await join(farmA.id, M.id, "manager");
  await join(farmA.id, S.id, "supervisor");
  await join(farmA.id, W.id, "worker");
  await join(farmA.id, V.id, "worker");

  memA = await requireMembership(sql, A.id, farmA.id);
  memB = await requireMembership(sql, B.id, farmB.id);
  memM = await requireMembership(sql, M.id, farmA.id);
  memS = await requireMembership(sql, S.id, farmA.id);
  memW = await requireMembership(sql, W.id, farmA.id);
  memV = await requireMembership(sql, V.id, farmA.id);
});

const mkTask = (over = {}) => ({ title: "Clean Poultry Shed 1", priority: "medium", ...over });

/* ── the brief's own collaboration flow ──────────────────────────────────── */

describe("the manager-to-worker flow", () => {
  it("runs create → accept → start → complete → verify", async () => {
    const task = await createTask(sql, memM, M.id, mkTask({ assigned_to: W.id, unit: "Shed 1" }));
    expect(task.status).toBe("pending");
    expect(task.assigned_to).toBe(W.id);

    /* The worker drives their own task through the middle of the lifecycle. */
    expect((await setTaskStatus(sql, memW, W.id, { taskId: task.id, status: "accepted" })).status).toBe("accepted");
    expect((await setTaskStatus(sql, memW, W.id, { taskId: task.id, status: "in_progress" })).status).toBe("in_progress");

    const done = await setTaskStatus(sql, memW, W.id, { taskId: task.id, status: "completed", note: "Cleaned and disinfected." });
    expect(done.status).toBe("completed");
    expect(done.completed_at).toBeTruthy();
    expect(done.notes).toBe("Cleaned and disinfected.");

    /* The supervisor verifies — and the completion timestamp survives it. */
    const verified = await setTaskStatus(sql, memS, S.id, { taskId: task.id, status: "verified" });
    expect(verified.status).toBe("verified");
    expect(verified.verified_by).toBe(S.id);
    expect(verified.completed_at, "completing is still on the record").toBeTruthy();

    const full = await getTask(sql, memA, { taskId: task.id });
    expect(full.events.map((e) => e.to_status))
      .toEqual(["pending", "accepted", "in_progress", "completed", "verified"]);
    expect(full.events.at(-1).actor_name).toBe("Sunil");
  });

  it("lets a supervisor reject completed work back to the worker", async () => {
    const t = await createTask(sql, memM, M.id, mkTask({ assigned_to: W.id }));
    await setTaskStatus(sql, memW, W.id, { taskId: t.id, status: "accepted" });
    await setTaskStatus(sql, memW, W.id, { taskId: t.id, status: "completed" });

    const rejected = await setTaskStatus(sql, memS, S.id, { taskId: t.id, status: "rejected", note: "Feeders still dirty." });
    expect(rejected.status).toBe("rejected");

    /* Rejected work is picked back up, not recreated. */
    expect((await setTaskStatus(sql, memW, W.id, { taskId: t.id, status: "in_progress" })).status).toBe("in_progress");
  });
});

/* ── who may move what ───────────────────────────────────────────────────── */

describe("lifecycle rules", () => {
  it("refuses moves that skip the path", async () => {
    const t = await createTask(sql, memM, M.id, mkTask({ assigned_to: W.id }));
    /* pending cannot jump straight to completed or verified. */
    expect(await statusOf(() => setTaskStatus(sql, memW, W.id, { taskId: t.id, status: "completed" }))).toBe(409);
    expect(await statusOf(() => setTaskStatus(sql, memS, S.id, { taskId: t.id, status: "verified" }))).toBe(409);
  });

  it("refuses a status that is not a status", async () => {
    const t = await createTask(sql, memM, M.id, mkTask({ assigned_to: W.id }));
    expect(await statusOf(() => setTaskStatus(sql, memW, W.id, { taskId: t.id, status: "done" }))).toBe(400);
    expect(await statusOf(() => setTaskStatus(sql, memW, W.id, { taskId: t.id, status: "pending" }))).toBe(400);
  });

  it("does not let a worker verify their own work", async () => {
    const t = await createTask(sql, memM, M.id, mkTask({ assigned_to: W.id }));
    await setTaskStatus(sql, memW, W.id, { taskId: t.id, status: "accepted" });
    await setTaskStatus(sql, memW, W.id, { taskId: t.id, status: "completed" });

    /* The whole point of verification is that someone else does it. */
    expect(await statusOf(() => setTaskStatus(sql, memW, W.id, { taskId: t.id, status: "verified" }))).toBe(403);
    expect(await statusOf(() => setTaskStatus(sql, memW, W.id, { taskId: t.id, status: "rejected" }))).toBe(403);
  });

  it("does not let a worker cancel a task", async () => {
    const t = await createTask(sql, memM, M.id, mkTask({ assigned_to: W.id }));
    expect(await statusOf(() => setTaskStatus(sql, memW, W.id, { taskId: t.id, status: "cancelled" }))).toBe(403);
    expect(await statusOf(() => setTaskStatus(sql, memM, M.id, { taskId: t.id, status: "cancelled" }))).toBe(200);
  });

  it("lets a manager close a task the worker forgot, and records who did", async () => {
    const t = await createTask(sql, memM, M.id, mkTask({ assigned_to: W.id }));
    await setTaskStatus(sql, memM, M.id, { taskId: t.id, status: "accepted" });
    await setTaskStatus(sql, memM, M.id, { taskId: t.id, status: "completed" });

    const full = await getTask(sql, memA, { taskId: t.id });
    expect(full.events.at(-1).actor_name, "the trail says it was the manager").toBe("Raju");
  });
});

/* ── row-level scoping inside one space ─────────────────────────────────── */

describe("a worker sees only their own tasks", () => {
  beforeEach(async () => {
    await createTask(sql, memM, M.id, mkTask({ title: "Amit's task", assigned_to: W.id }));
    await createTask(sql, memM, M.id, mkTask({ title: "Rahul's task", assigned_to: V.id }));
    await createTask(sql, memM, M.id, mkTask({ title: "Unassigned" }));
  });

  it("narrows the list in SQL, not in the client", async () => {
    const mine = await listTasks(sql, memW);
    expect(mine.map((t) => t.title)).toEqual(["Amit's task"]);

    const all = await listTasks(sql, memM);
    expect(all).toHaveLength(3);
  });

  it("hides another worker's task behind the same 404 as a foreign one", async () => {
    const [rahuls] = await sql`select id from farm_tasks where title = 'Rahul''s task'`;
    expect(await statusOf(() => getTask(sql, memW, { taskId: rahuls.id }))).toBe(404);
    /* And cannot be worked on either — reading it is not the only risk. */
    expect(await statusOf(() => setTaskStatus(sql, memW, W.id, { taskId: rahuls.id, status: "accepted" }))).toBe(404);
    expect(await statusOf(() => updateTask(sql, memW, W.id, { taskId: rahuls.id, notes: "x" }))).toBe(404);
  });

  it("counts only their own work in the summary", async () => {
    expect((await taskSummary(sql, memW)).open).toBe(1);
    expect((await taskSummary(sql, memM)).open).toBe(3);
  });

  it("lets a worker add notes but not rewrite the job", async () => {
    const [mine] = await sql`select id from farm_tasks where title = 'Amit''s task'`;
    expect(await statusOf(() => updateTask(sql, memW, W.id, { taskId: mine.id, notes: "Done at 4pm" }))).toBe(200);
    expect(await statusOf(() => updateTask(sql, memW, W.id, { taskId: mine.id, title: "Something else" }))).toBe(403);
    expect(await statusOf(() => updateTask(sql, memW, W.id, { taskId: mine.id, due_date: "2027-01-01" }))).toBe(403);
    expect(await statusOf(() => updateTask(sql, memW, W.id, { taskId: mine.id, assigned_to: V.id }))).toBe(403);
  });
});

/* ── cross-farm, again, because tasks are the payload ────────────────────── */

describe("tasks never cross a farm boundary", () => {
  it("hides Farm B's task from Farm A's owner", async () => {
    const bTask = await createTask(sql, memB, B.id, mkTask({ title: "Green Valley job" }));

    expect(await statusOf(() => getTask(sql, memA, { taskId: bTask.id }))).toBe(404);
    expect(await statusOf(() => setTaskStatus(sql, memA, A.id, { taskId: bTask.id, status: "cancelled" }))).toBe(404);
    expect(await statusOf(() => updateTask(sql, memA, A.id, { taskId: bTask.id, title: "Hijacked" }))).toBe(404);

    const aList = await listTasks(sql, memA);
    expect(aList.some((t) => t.title === "Green Valley job")).toBe(false);
  });

  it("refuses to assign work to someone outside the space", async () => {
    /* Without this an owner could assign to any user id in the system, leaking
       the task and the farm's name to a stranger. */
    expect(await statusOf(() => createTask(sql, memA, A.id, mkTask({ assigned_to: B.id })))).toBe(400);

    const t = await createTask(sql, memA, A.id, mkTask());
    expect(await statusOf(() => updateTask(sql, memA, A.id, { taskId: t.id, assigned_to: B.id }))).toBe(400);
  });
});

/* ── derived state and validation ────────────────────────────────────────── */

describe("overdue is derived, not stored", () => {
  it("marks an open past-due task overdue and leaves finished ones alone", () => {
    const today = "2026-09-02";
    expect(withOverdue({ status: "pending", due_date: "2026-09-01" }, today).overdue).toBe(true);
    expect(withOverdue({ status: "in_progress", due_date: "2026-09-02" }, today).overdue).toBe(false);
    /* Finished work cannot become overdue by the calendar moving on. */
    expect(withOverdue({ status: "completed", due_date: "2026-01-01" }, today).overdue).toBe(false);
    expect(withOverdue({ status: "verified", due_date: "2026-01-01" }, today).overdue).toBe(false);
    expect(withOverdue({ status: "cancelled", due_date: "2026-01-01" }, today).overdue).toBe(false);
    expect(withOverdue({ status: "pending", due_date: null }, today).overdue).toBe(false);
  });

  it("counts overdue and due-today in the summary", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await createTask(sql, memM, M.id, mkTask({ title: "late", assigned_to: W.id, due_date: "2020-01-01" }));
    await createTask(sql, memM, M.id, mkTask({ title: "today", assigned_to: W.id, due_date: today }));

    const s = await taskSummary(sql, memM);
    expect(s.overdue).toBe(1);
    expect(s.due_today).toBe(1);
  });
});

describe("input validation", () => {
  it("requires a title and bounds the free text", () => {
    expect(validateTaskInput({}).error).toMatch(/title/);
    expect(validateTaskInput({ title: "   " }).error).toMatch(/title/);
    expect(validateTaskInput({ title: "x".repeat(141) }).error).toMatch(/140/);
    expect(validateTaskInput({ title: "ok", description: "d".repeat(2001) }).error).toMatch(/description/);
  });

  it("rejects a bad priority or date rather than storing it", () => {
    expect(validateTaskInput({ title: "ok", priority: "urgent" }).error).toMatch(/priority/);
    expect(validateTaskInput({ title: "ok", due_date: "next tuesday" }).error).toMatch(/due_date/);
    expect(validateTaskInput({ title: "ok", due_date: "2026-09-02" }).error).toBeUndefined();
    expect(validateTaskInput({ title: "ok", due_date: "" }).value.due_date).toBeNull();
  });

  it("caps attachments and keeps only a description of each file", () => {
    const { value } = validateTaskInput({
      title: "ok",
      attachments: Array.from({ length: 12 }, (_, i) => ({ name: `p${i}.jpg`, size: 100, type: "image/jpeg", secret: "x" })),
    });
    expect(value.attachments).toHaveLength(8);
    expect(value.attachments[0]).toEqual({ name: "p0.jpg", size: 100, type: "image/jpeg" });
  });
});
