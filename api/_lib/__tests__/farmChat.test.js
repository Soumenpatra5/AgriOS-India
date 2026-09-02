/* Farm chat — isolation, paging and the one deliberate difference from the
   rest of Farm Space: chat is NOT narrowed by role.

   A channel where the workers cannot see each other would not be a
   conversation, so farm.chat.view and farm.chat.send are granted to every
   role. Membership is the whole access rule — which makes the cross-farm
   tests here the important ones. */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

import { requireMembership } from "../farm/gate.js";
import { createSpace } from "../farm/spaces.js";
import { createTask } from "../farm/tasks.js";
import {
  sendMessage, listMessages, removeMessage, unreadCount, validateMessageInput,
} from "../farm/chat.js";

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
  for (const m of ["0001_commerce_foundation.sql", "0002_farm_space.sql", "0003_farm_tasks.sql",
                   "0004_farm_operations.sql", "0005_farm_chat.sql"]) {
    await db.exec(await readFile(mig(m), "utf8"));
  }
  sql = makeSql(db);
}, 40000);

let A, B, M, W, farmA, farmB, memA, memB, memM, memW;

async function seedUser(uid, phone, name = uid) {
  return (await db.query(
    `insert into users (firebase_uid, phone, name) values ($1,$2,$3) returning *`,
    [uid, phone, name])).rows[0];
}
async function statusOf(fn) {
  try { await fn(); return 200; } catch (e) { return e?.status ?? 500; }
}

beforeEach(async () => {
  await db.exec(`truncate farm_chat_messages, farm_announcements, farm_attendance,
                          farm_task_events, farm_tasks, farm_audit_logs,
                          farm_space_invitations, farm_space_memberships,
                          farm_spaces, users restart identity cascade`);

  A = await seedUser("uid-a", "9000000001", "Soumen");
  B = await seedUser("uid-b", "9000000002", "Priya");
  M = await seedUser("uid-m", "9000000003", "Raju");
  W = await seedUser("uid-w", "9000000005", "Amit");

  farmA = await createSpace(sql, A.id, { name: "AgriOS Farm" });
  farmB = await createSpace(sql, B.id, { name: "Green Valley Farm" });

  await db.query(`insert into farm_space_memberships (space_id,user_id,role,status) values ($1,$2,'manager','active')`, [farmA.id, M.id]);
  await db.query(`insert into farm_space_memberships (space_id,user_id,role,status) values ($1,$2,'worker','active')`, [farmA.id, W.id]);

  memA = await requireMembership(sql, A.id, farmA.id);
  memB = await requireMembership(sql, B.id, farmB.id);
  memM = await requireMembership(sql, M.id, farmA.id);
  memW = await requireMembership(sql, W.id, farmA.id);
});

describe("the channel is shared by everyone in the space", () => {
  it("lets a worker send and read alongside a manager", async () => {
    await sendMessage(sql, memM, M.id, { body: "Shed 1 needs cleaning today" });
    await sendMessage(sql, memW, W.id, { body: "On it" });

    /* Deliberately unlike tasks and attendance: the worker sees the whole
       conversation, not only their own lines. */
    const asWorker = await listMessages(sql, memW, {});
    expect(asWorker.map((m) => m.body)).toEqual(["Shed 1 needs cleaning today", "On it"]);
    expect(asWorker.map((m) => m.sender_name)).toEqual(["Raju", "Amit"]);

    const asManager = await listMessages(sql, memM, {});
    expect(asManager).toHaveLength(2);
  });

  it("returns messages oldest first, the order a conversation is read in", async () => {
    for (const body of ["one", "two", "three"]) await sendMessage(sql, memM, M.id, { body });
    const list = await listMessages(sql, memM, {});
    expect(list.map((m) => m.body)).toEqual(["one", "two", "three"]);
  });
});

describe("isolation", () => {
  it("never shows one farm's messages to another", async () => {
    await sendMessage(sql, memM, M.id, { body: "Farm A only" });
    await sendMessage(sql, memB, B.id, { body: "Green Valley only" });

    expect((await listMessages(sql, memA, {})).map((m) => m.body)).toEqual(["Farm A only"]);
    expect((await listMessages(sql, memB, {})).map((m) => m.body)).toEqual(["Green Valley only"]);
  });

  it("refuses to delete a message in another farm", async () => {
    const msg = await sendMessage(sql, memM, M.id, { body: "Farm A" });
    expect(await statusOf(() => removeMessage(sql, memB, B.id, { messageId: msg.id }))).toBe(404);
  });

  it("refuses to attach another farm's task to a message", async () => {
    /* Otherwise a member could confirm another farm's task ids by trial. */
    const bTask = await createTask(sql, memB, B.id, { title: "Green Valley job" });
    expect(await statusOf(() => sendMessage(sql, memM, M.id, { body: "look", taskId: bTask.id }))).toBe(404);
  });
});

describe("moderation", () => {
  it("lets a sender remove their own message", async () => {
    const mine = await sendMessage(sql, memW, W.id, { body: "oops" });
    expect(await statusOf(() => removeMessage(sql, memW, W.id, { messageId: mine.id }))).toBe(200);
    expect(await listMessages(sql, memW, {})).toEqual([]);
  });

  it("stops a member removing somebody else's", async () => {
    const theirs = await sendMessage(sql, memM, M.id, { body: "manager says" });
    expect(await statusOf(() => removeMessage(sql, memW, W.id, { messageId: theirs.id }))).toBe(403);
    /* The owner, who manages the space, can. */
    expect(await statusOf(() => removeMessage(sql, memA, A.id, { messageId: theirs.id }))).toBe(200);
  });
});

describe("paging and polling", () => {
  it("pages with a cursor rather than an offset", async () => {
    for (const body of ["m1", "m2", "m3", "m4", "m5"]) {
      await sendMessage(sql, memM, M.id, { body });
    }
    const recent = await listMessages(sql, memM, { limit: 2 });
    expect(recent.map((m) => m.body), "the two newest, in reading order").toEqual(["m4", "m5"]);

    /* An offset would shift under you as people keep talking; a timestamp
       cursor is stable. */
    const older = await listMessages(sql, memM, { limit: 2, before: recent[0].created_at });
    expect(older.map((m) => m.body)).toEqual(["m2", "m3"]);
  });

  it("fetches only what arrived after a timestamp, which is what polling reads", async () => {
    const first = await sendMessage(sql, memM, M.id, { body: "before" });
    const after = await sendMessage(sql, memW, W.id, { body: "after" });

    const fresh = await listMessages(sql, memM, { since: first.created_at });
    expect(fresh.map((m) => m.body)).toEqual(["after"]);
    expect(after.body).toBe("after");
  });

  it("counts only other people's new messages as unread", async () => {
    const start = (await sendMessage(sql, memM, M.id, { body: "seen" })).created_at;
    await sendMessage(sql, memW, W.id, { body: "from someone else" });
    await sendMessage(sql, memM, M.id, { body: "my own, later" });

    /* Your own message must not make your own badge light up. */
    expect((await unreadCount(sql, memM, { since: start })).unread).toBe(1);
    expect((await unreadCount(sql, memM, {})).unread, "no marker yet means nothing unread").toBe(0);
  });
});

describe("validation", () => {
  it("refuses an empty message", () => {
    expect(validateMessageInput({}).error).toMatch(/text or an attachment/);
    expect(validateMessageInput({ body: "   " }).error).toMatch(/text or an attachment/);
  });

  it("accepts an attachment with no text", () => {
    const { value, error } = validateMessageInput({ attachments: [{ name: "shed.jpg", size: 10, type: "image/jpeg" }] });
    expect(error).toBeUndefined();
    expect(value.body).toBeNull();
    expect(value.attachments).toHaveLength(1);
  });

  it("bounds the body and caps attachments, keeping only a description", () => {
    expect(validateMessageInput({ body: "x".repeat(2001) }).error).toMatch(/2000/);
    const { value } = validateMessageInput({
      body: "hi",
      attachments: Array.from({ length: 9 }, (_, i) => ({ name: `p${i}.jpg`, size: 1, type: "image/jpeg", secret: "x" })),
    });
    expect(value.attachments).toHaveLength(4);
    expect(value.attachments[0]).toEqual({ name: "p0.jpg", size: 1, type: "image/jpeg" });
  });

  it("is enforced by the database too, not only the validator", async () => {
    /* The check constraint is the backstop if a future caller skips the
       validator — a 500 from a constraint is bad, a stored empty message is
       worse. */
    await expect(db.query(
      `insert into farm_chat_messages (space_id, sender_user_id, body) values ($1,$2,$3)`,
      [farmA.id, M.id, "   "],
    )).rejects.toThrow();
  });
});
