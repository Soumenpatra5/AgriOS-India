/* Farm Space OPERATIONS — attendance, announcements, activity.

   Real Postgres via PGlite, real migrations, real handlers, as in the other
   Farm Space suites.

   Attendance is where "shared" and "private" meet most awkwardly: a manager
   needs to see who worked, a worker must not see their colleagues' records,
   and both need to be true of the same table. That is most of what is checked
   here.

   Cast:
     A owner of Farm A     B owner of Farm B
     M manager in Farm A   W and V, two workers in Farm A */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

import { requireMembership } from "../farm/gate.js";
import { createSpace } from "../farm/spaces.js";
import { createTask, setTaskStatus } from "../farm/tasks.js";
import { generateAgriosUserId } from "../agriosId.js";
import {
  markAttendance, checkOut, listAttendance, attendanceSummary,
  createAnnouncement, listAnnouncements, removeAnnouncement,
  listActivity, validateAttendanceInput, validateAnnouncementInput,
} from "../farm/operations.js";

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
const today = () => new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  db = new PGlite();
  for (const m of ["0001_commerce_foundation.sql", "0002_farm_space.sql",
                   "0003_farm_tasks.sql", "0004_farm_operations.sql",
                   /* listAttendance now selects the member's agrios_user_id
                      as a name fallback. */
                   "0007_agrios_user_id.sql"]) {
    await db.exec(await readFile(mig(m), "utf8"));
  }
  sql = makeSql(db);
}, 40000);

let A, B, M, W, V, farmA, farmB, memA, memB, memM, memW, memV;

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
  await db.exec(`truncate farm_announcements, farm_attendance, farm_task_events, farm_tasks,
                          farm_audit_logs, farm_space_invitations, farm_space_memberships,
                          farm_spaces, users restart identity cascade`);

  A = await seedUser("uid-a", "9000000001", "Soumen");
  B = await seedUser("uid-b", "9000000002", "Priya");
  M = await seedUser("uid-m", "9000000003", "Raju");
  W = await seedUser("uid-w", "9000000005", "Amit");
  V = await seedUser("uid-v", "9000000006", "Rahul");

  farmA = await createSpace(sql, A.id, { name: "AgriOS Farm" });
  farmB = await createSpace(sql, B.id, { name: "Green Valley Farm" });

  await join(farmA.id, M.id, "manager");
  await join(farmA.id, W.id, "worker");
  await join(farmA.id, V.id, "worker");

  memA = await requireMembership(sql, A.id, farmA.id);
  memB = await requireMembership(sql, B.id, farmB.id);
  memM = await requireMembership(sql, M.id, farmA.id);
  memW = await requireMembership(sql, W.id, farmA.id);
  memV = await requireMembership(sql, V.id, farmA.id);
});

/* ── attendance ──────────────────────────────────────────────────────────── */

describe("attendance", () => {
  it("lets a member mark themselves present without any manage permission", async () => {
    const row = await markAttendance(sql, memW, W.id, {});
    expect(row.status).toBe("present");
    expect(row.user_id).toBe(W.id);
    expect(row.check_in, "arriving is timestamped").toBeTruthy();
    expect(row.marked_by, "self-marked, so nobody marked them").toBeNull();
  });

  it("stops a worker marking somebody else in", async () => {
    /* Who was here is the input to what people get paid, so marking another
       person needs the manage permission. */
    expect(await statusOf(() => markAttendance(sql, memW, W.id, { userId: V.id }))).toBe(403);
    expect(await statusOf(() => markAttendance(sql, memM, M.id, { userId: V.id }))).toBe(200);
  });

  it("records who marked someone else", async () => {
    const row = await markAttendance(sql, memM, M.id, { userId: W.id, status: "leave", note: "Sick" });
    expect(row.status).toBe("leave");
    expect(row.marked_by).toBe(M.id);
    expect(row.note).toBe("Sick");
  });

  it("keeps one record per person per day and never rewrites arrival time", async () => {
    const first = await markAttendance(sql, memW, W.id, {});
    const arrival = first.check_in;

    /* A double tap, or a later correction to half-day, must not invent a
       second day or move when they actually arrived. */
    const second = await markAttendance(sql, memW, W.id, { status: "half_day" });
    expect(second.id).toBe(first.id);
    expect(second.status).toBe("half_day");
    expect(String(second.check_in)).toBe(String(arrival));

    const all = await listAttendance(sql, memM, { date: today() });
    expect(all.filter((r) => r.user_id === W.id)).toHaveLength(1);
  });

  it("refuses to mark someone who is not in the space", async () => {
    expect(await statusOf(() => markAttendance(sql, memA, A.id, { userId: B.id }))).toBe(400);
  });

  it("checks out, and refuses to close a day that never opened", async () => {
    await markAttendance(sql, memW, W.id, {});
    const out = await checkOut(sql, memW, W.id, {});
    expect(out.check_out).toBeTruthy();

    expect(await statusOf(() => checkOut(sql, memV, V.id, {}))).toBe(409);
  });

  it("shows a worker only their own record", async () => {
    await markAttendance(sql, memW, W.id, {});
    await markAttendance(sql, memV, V.id, {});

    const mine = await listAttendance(sql, memW, {});
    expect(mine).toHaveLength(1);
    expect(mine[0].user_id).toBe(W.id);

    const all = await listAttendance(sql, memM, {});
    expect(all).toHaveLength(2);
  });

  it("summarises the farm for a manager and only themselves for a worker", async () => {
    await markAttendance(sql, memW, W.id, {});
    await markAttendance(sql, memM, M.id, { userId: V.id, status: "leave" });

    const forManager = await attendanceSummary(sql, memM, {});
    expect(forManager.present).toBe(1);
    expect(forManager.on_leave).toBe(1);
    expect(forManager.members, "the whole team is the denominator").toBe(4);

    const forWorker = await attendanceSummary(sql, memW, {});
    expect(forWorker.present).toBe(1);
    expect(forWorker.members, "a worker's summary is about them, not the farm").toBe(1);
  });

  it("never shows another farm's attendance", async () => {
    await markAttendance(sql, memB, B.id, {});
    const aRows = await listAttendance(sql, memA, {});
    expect(aRows).toEqual([]);
  });

  it("rejects a bad status or date instead of storing it", () => {
    expect(validateAttendanceInput({ status: "holiday" }).error).toMatch(/status/);
    expect(validateAttendanceInput({ date: "yesterday" }).error).toMatch(/date/);
    expect(validateAttendanceInput({ note: "x".repeat(501) }).error).toMatch(/note/);
    expect(validateAttendanceInput({}).value.status).toBe("present");
  });
});

/* ── announcements ───────────────────────────────────────────────────────── */

describe("announcements", () => {
  it("is created by a manager and read by everyone in the space", async () => {
    await createAnnouncement(sql, memM, M.id, { message: "Vaccination on Friday", kind: "vaccination" });

    for (const mem of [memA, memM, memW, memV]) {
      const list = await listAnnouncements(sql, mem, {});
      expect(list).toHaveLength(1);
      expect(list[0].message).toBe("Vaccination on Friday");
      expect(list[0].author_name).toBe("Raju");
    }
  });

  it("is never visible to another farm", async () => {
    await createAnnouncement(sql, memM, M.id, { message: "Farm A only" });
    expect(await listAnnouncements(sql, memB, {})).toEqual([]);
  });

  it("lets the author or a manager remove one, but not a bystander", async () => {
    const own = await createAnnouncement(sql, memM, M.id, { message: "Mine" });

    /* A worker cannot remove the manager's notice. */
    expect(await statusOf(() => removeAnnouncement(sql, memW, W.id, { announcementId: own.id }))).toBe(403);
    /* The author can. */
    expect(await statusOf(() => removeAnnouncement(sql, memM, M.id, { announcementId: own.id }))).toBe(200);
    expect(await listAnnouncements(sql, memM, {})).toEqual([]);
  });

  it("cannot be removed across a farm boundary", async () => {
    const a = await createAnnouncement(sql, memM, M.id, { message: "Farm A" });
    expect(await statusOf(() => removeAnnouncement(sql, memB, B.id, { announcementId: a.id }))).toBe(404);
  });

  it("validates the message and kind", () => {
    expect(validateAnnouncementInput({}).error).toMatch(/message/);
    expect(validateAnnouncementInput({ message: "  " }).error).toMatch(/message/);
    expect(validateAnnouncementInput({ message: "hi", kind: "gossip" }).error).toMatch(/kind/);
    expect(validateAnnouncementInput({ message: "hi" }).value.kind).toBe("notice");
  });
});

/* ── activity feed ───────────────────────────────────────────────────────── */

describe("activity feed", () => {
  it("reports farm events without a table of its own", async () => {
    const t = await createTask(sql, memM, M.id, { title: "Clean shed", assigned_to: W.id });
    await setTaskStatus(sql, memW, W.id, { taskId: t.id, status: "accepted" });
    await createAnnouncement(sql, memM, M.id, { message: "Meeting at 5" });

    const feed = await listActivity(sql, memM, {});
    const actions = feed.map((r) => r.action);
    expect(actions).toContain("task.created");
    expect(actions).toContain("task.accepted");
    expect(actions).toContain("announcement.created");
    expect(feed[0].actor_name).toBeTruthy();
  });

  it("keeps security-only audit entries out of the members' feed", async () => {
    /* Role changes and document access are a security record, not farm news.
       The feed is an allow-list, so a new audit action stays invisible until
       someone decides it belongs. */
    await sql`insert into farm_audit_logs (space_id, actor_user_id, action)
              values (${farmA.id}, ${A.id}, 'member.role_changed')`;
    await sql`insert into farm_audit_logs (space_id, actor_user_id, action)
              values (${farmA.id}, ${A.id}, 'document.accessed')`;

    const feed = await listActivity(sql, memA, {});
    expect(feed.map((r) => r.action)).not.toContain("member.role_changed");
    expect(feed.map((r) => r.action)).not.toContain("document.accessed");
  });

  it("gives a worker farm news plus their own doings, not a commentary on others", async () => {
    const mine = await createTask(sql, memM, M.id, { title: "Mine", assigned_to: W.id });
    await setTaskStatus(sql, memW, W.id, { taskId: mine.id, status: "accepted" });

    const theirs = await createTask(sql, memM, M.id, { title: "Theirs", assigned_to: V.id });
    await setTaskStatus(sql, memV, V.id, { taskId: theirs.id, status: "accepted" });
    await markAttendance(sql, memV, V.id, {});

    await createAnnouncement(sql, memM, M.id, { message: "Everyone reads this" });

    const feed = await listActivity(sql, memW, {});
    const byOthers = feed.filter((r) => r.actor_name !== "Amit");

    /* Farm news survives the narrowing; another worker's task and attendance
       activity does not. */
    expect(feed.some((r) => r.action === "announcement.created")).toBe(true);
    expect(byOthers.every((r) => !r.action.startsWith("attendance."))).toBe(true);
    expect(feed.some((r) => r.action === "task.accepted" && r.actor_name === "Amit")).toBe(true);
    expect(feed.some((r) => r.action === "task.accepted" && r.actor_name === "Rahul")).toBe(false);
  });

  it("never leaks another farm's activity", async () => {
    await createAnnouncement(sql, memB, B.id, { message: "Green Valley news" });
    const feed = await listActivity(sql, memA, {});
    expect(feed).toHaveLength(1);            // only Farm A's own space.created
    expect(feed[0].action).toBe("space.created");
  });
});
