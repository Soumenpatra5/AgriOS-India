/* Farm chat — isolation, paging and the one deliberate difference from the
   rest of Farm Space: chat is NOT narrowed by role.

   A channel where the workers cannot see each other would not be a
   conversation, so farm.chat.view and farm.chat.send are granted to every
   role. Membership is the whole access rule — which makes the cross-farm
   tests here the important ones. */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

import { requireMembership, requirePermission } from "../farm/gate.js";
import { createSpace } from "../farm/spaces.js";
import { createTask } from "../farm/tasks.js";
import { generateAgriosUserId } from "../agriosId.js";
import {
  sendMessage, listMessages, removeMessage, unreadCount, validateMessageInput,
  editMessage, hideMessageForSelf, reactToMessage, removeReaction,
  pinMessage, unpinMessage, listPinnedMessages, REACTION_EMOJI,
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
                   "0004_farm_operations.sql", "0005_farm_chat.sql",
                   /* listMessages/oneMessage now select agrios_user_id as a
                      sender-name fallback, before 0009 touches chat itself. */
                   "0007_agrios_user_id.sql", "0009_farm_chat_reply_react_pin.sql"]) {
    await db.exec(await readFile(mig(m), "utf8"));
  }
  sql = makeSql(db);
}, 40000);

let A, B, M, W, farmA, farmB, memA, memB, memM, memW;

async function seedUser(uid, phone, name = uid) {
  return (await db.query(
    `insert into users (firebase_uid, phone, name, agrios_user_id) values ($1,$2,$3,$4) returning *`,
    [uid, phone, name, generateAgriosUserId()])).rows[0];
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
  it("lets a sender remove their own message — as a tombstone, not a silent gap", async () => {
    /* Silently dropping the row would mean another member's poll never
       learns the message was removed — a listener watching the same
       created_at range would just never see anything change. */
    const mine = await sendMessage(sql, memW, W.id, { body: "oops" });
    expect(await statusOf(() => removeMessage(sql, memW, W.id, { messageId: mine.id }))).toBe(200);

    const [row] = await listMessages(sql, memW, {});
    expect(row.deleted).toBe(true);
    expect(row.body).toBeNull();
  });

  it("stops a member removing somebody else's — owner and manager both can", async () => {
    const theirs = await sendMessage(sql, memM, M.id, { body: "manager says" });
    expect(await statusOf(() => removeMessage(sql, memW, W.id, { messageId: theirs.id }))).toBe(403);
    /* The owner, who manages the space, can. */
    expect(await statusOf(() => removeMessage(sql, memA, A.id, { messageId: theirs.id }))).toBe(200);
  });

  it("a manager — not only the owner — can remove someone else's message", async () => {
    /* farm.members.manage, not farm.settings.manage: managers already run
       the roster, so they moderate the channel too, not just the owner. */
    const theirs = await sendMessage(sql, memW, W.id, { body: "worker says" });
    expect(await statusOf(() => removeMessage(sql, memM, M.id, { messageId: theirs.id }))).toBe(200);
  });

  it("lets a sender remove their own recent message for everyone, but not an old one", async () => {
    const mine = await sendMessage(sql, memW, W.id, { body: "recent" });
    expect(await statusOf(() => removeMessage(sql, memW, W.id, { messageId: mine.id }))).toBe(200);

    await db.query(`update farm_chat_messages set created_at = now() - interval '2 hours', deleted_at = null
                      where id = $1`, [mine.id]);
    expect(await statusOf(() => removeMessage(sql, memW, W.id, { messageId: mine.id }))).toBe(409);
  });

  it("a manager can remove an old message for everyone regardless of the time window", async () => {
    const old = await sendMessage(sql, memW, W.id, { body: "ancient" });
    await db.query(`update farm_chat_messages set created_at = now() - interval '2 hours' where id = $1`, [old.id]);
    expect(await statusOf(() => removeMessage(sql, memM, M.id, { messageId: old.id }))).toBe(200);
  });
});

describe("delete for me", () => {
  it("hides a message from one viewer without touching anyone else's copy", async () => {
    const msg = await sendMessage(sql, memM, M.id, { body: "visible to most" });
    expect(await statusOf(() => hideMessageForSelf(sql, memW, W.id, { messageId: msg.id }))).toBe(200);

    expect((await listMessages(sql, memW, {})).map((m) => m.body)).toEqual([]);
    expect((await listMessages(sql, memM, {})).map((m) => m.body)).toEqual(["visible to most"]);
  });

  it("hiding twice is not an error", async () => {
    const msg = await sendMessage(sql, memM, M.id, { body: "x" });
    await hideMessageForSelf(sql, memW, W.id, { messageId: msg.id });
    expect(await statusOf(() => hideMessageForSelf(sql, memW, W.id, { messageId: msg.id }))).toBe(200);
  });

  it("refuses to hide a message belonging to another farm", async () => {
    const msg = await sendMessage(sql, memM, M.id, { body: "Farm A" });
    expect(await statusOf(() => hideMessageForSelf(sql, memB, B.id, { messageId: msg.id }))).toBe(404);
  });
});

describe("editing", () => {
  it("lets a sender edit their own message and marks it edited", async () => {
    const mine = await sendMessage(sql, memW, W.id, { body: "typo" });
    const edited = await editMessage(sql, memW, W.id, { messageId: mine.id, body: "fixed" });
    expect(edited.body).toBe("fixed");
    expect(edited.edited_at).not.toBeNull();
  });

  it("refuses to edit somebody else's message, even for a manager", async () => {
    /* Deleting someone else's message is moderation; rewriting their words
       is not something any role gets to do. */
    const theirs = await sendMessage(sql, memW, W.id, { body: "worker says" });
    expect(await statusOf(() => editMessage(sql, memM, M.id, { messageId: theirs.id, body: "manager says" }))).toBe(403);
  });

  it("refuses to edit a message that has aged out of the window", async () => {
    const mine = await sendMessage(sql, memW, W.id, { body: "old" });
    await db.query(`update farm_chat_messages set created_at = now() - interval '2 hours' where id = $1`, [mine.id]);
    expect(await statusOf(() => editMessage(sql, memW, W.id, { messageId: mine.id, body: "too late" }))).toBe(409);
  });

  it("refuses to edit into an empty message", async () => {
    const mine = await sendMessage(sql, memW, W.id, { body: "hello" });
    expect(await statusOf(() => editMessage(sql, memW, W.id, { messageId: mine.id, body: "   " }))).toBe(400);
  });
});

describe("reactions", () => {
  it("lets a member react, and shows who reacted with what", async () => {
    const msg = await sendMessage(sql, memM, M.id, { body: "shed is clean" });
    await reactToMessage(sql, memW, W.id, { messageId: msg.id, emoji: REACTION_EMOJI[0] });

    const [row] = await listMessages(sql, memM, {});
    expect(row.reactions).toEqual([{ user_id: W.id, name: "Amit", emoji: REACTION_EMOJI[0] }]);
  });

  it("reacting again replaces the member's own reaction rather than adding a second", async () => {
    const msg = await sendMessage(sql, memM, M.id, { body: "x" });
    await reactToMessage(sql, memW, W.id, { messageId: msg.id, emoji: REACTION_EMOJI[0] });
    await reactToMessage(sql, memW, W.id, { messageId: msg.id, emoji: REACTION_EMOJI[1] });

    const [row] = await listMessages(sql, memM, {});
    expect(row.reactions).toHaveLength(1);
    expect(row.reactions[0].emoji).toBe(REACTION_EMOJI[1]);
  });

  it("removeReaction takes only the caller's own reaction off", async () => {
    const msg = await sendMessage(sql, memM, M.id, { body: "x" });
    await reactToMessage(sql, memW, W.id, { messageId: msg.id, emoji: REACTION_EMOJI[0] });
    await reactToMessage(sql, memM, M.id, { messageId: msg.id, emoji: REACTION_EMOJI[0] });
    await removeReaction(sql, memW, W.id, { messageId: msg.id });

    const [row] = await listMessages(sql, memM, {});
    expect(row.reactions.map((r) => r.user_id)).toEqual([M.id]);
  });

  it("refuses a reaction outside the supported set", async () => {
    const msg = await sendMessage(sql, memM, M.id, { body: "x" });
    expect(await statusOf(() => reactToMessage(sql, memW, W.id, { messageId: msg.id, emoji: "💩🔥" }))).toBe(400);
  });

  it("refuses to react to a message in another farm", async () => {
    const msg = await sendMessage(sql, memM, M.id, { body: "Farm A" });
    expect(await statusOf(() => reactToMessage(sql, memB, B.id, { messageId: msg.id, emoji: REACTION_EMOJI[0] }))).toBe(404);
  });

  it("refuses to remove a reaction from a message that was deleted for everyone", async () => {
    /* Regression check: removeReaction must exclude a deleted row the same
       way reactToMessage and pinMessage already do — otherwise its
       oneMessage() response could hand the message's real body back to the
       client, un-tombstoning something that was correctly deleted. */
    const msg = await sendMessage(sql, memW, W.id, { body: "temporary" });
    await reactToMessage(sql, memM, M.id, { messageId: msg.id, emoji: REACTION_EMOJI[0] });
    await removeMessage(sql, memW, W.id, { messageId: msg.id });

    expect(await statusOf(() => removeReaction(sql, memM, M.id, { messageId: msg.id }))).toBe(404);
    const [row] = (await listMessages(sql, memM, {})).filter((m) => m.id === msg.id);
    expect(row.deleted).toBe(true);
    expect(row.body).toBeNull();
  });

  it("reacting bumps updated_at, so a poll on an old message picks it up", async () => {
    const msg = await sendMessage(sql, memM, M.id, { body: "old news" });
    const cursor = msg.created_at;
    await reactToMessage(sql, memW, W.id, { messageId: msg.id, emoji: REACTION_EMOJI[0] });

    /* created_at has not moved, so a created_at-based poll would miss this —
       the whole reason listMessages now filters on updated_at instead. */
    const polled = await listMessages(sql, memM, { since: cursor });
    expect(polled.map((m) => m.id)).toContain(msg.id);
  });
});

describe("pinning", () => {
  it("lets a manager pin a message, and it shows up in the pinned list", async () => {
    const msg = await sendMessage(sql, memW, W.id, { body: "vaccination at 10am" });
    await pinMessage(sql, memM, M.id, { messageId: msg.id });

    const pinned = await listPinnedMessages(sql, memM);
    expect(pinned).toHaveLength(1);
    expect(pinned[0].id).toBe(msg.id);
    expect(pinned[0].pinned_by_name).toBe("Raju");
  });

  it("refuses to let a worker pin a message", async () => {
    /* pinMessage() itself only checks scope — like spaces.update and every
       other action gated by a single permission, the actual "may this role
       do this at all" check is the router's authorize() step, run before
       the handler is ever reached. Simulating that step here is what
       actually proves a worker is refused, not calling pinMessage directly
       and hoping it happens to re-check something it was never asked to. */
    expect(() => requirePermission(memW, "farm.members.manage")).toThrow();
    expect(() => requirePermission(memM, "farm.members.manage")).not.toThrow();
  });

  it("unpin removes it from the pinned list", async () => {
    const msg = await sendMessage(sql, memW, W.id, { body: "x" });
    await pinMessage(sql, memM, M.id, { messageId: msg.id });
    await unpinMessage(sql, memM, M.id, { messageId: msg.id });
    expect(await listPinnedMessages(sql, memM)).toEqual([]);
  });

  it("refuses to pin a message in another farm", async () => {
    const msg = await sendMessage(sql, memM, M.id, { body: "Farm A" });
    expect(await statusOf(() => pinMessage(sql, memB, B.id, { messageId: msg.id }))).toBe(404);
  });
});

describe("replies", () => {
  it("carries a preview of the message it replies to", async () => {
    const original = await sendMessage(sql, memM, M.id, { body: "feed the goats" });
    const reply = await sendMessage(sql, memW, W.id, { body: "done", parentMessageId: original.id });

    expect(reply.reply_to).toEqual({ id: original.id, sender_name: "Raju", body: "feed the goats", deleted: false });
  });

  it("shows the parent as deleted, not resurrected, once it is removed", async () => {
    const original = await sendMessage(sql, memM, M.id, { body: "feed the goats" });
    const reply = await sendMessage(sql, memW, W.id, { body: "done", parentMessageId: original.id });
    await removeMessage(sql, memM, M.id, { messageId: original.id });

    const [row] = (await listMessages(sql, memW, {})).filter((m) => m.id === reply.id);
    expect(row.reply_to.deleted).toBe(true);
    expect(row.reply_to.body).toBeNull();
  });

  it("refuses to reply to a message in another farm", async () => {
    const bMsg = await sendMessage(sql, memB, B.id, { body: "Green Valley" });
    expect(await statusOf(() => sendMessage(sql, memM, M.id, { body: "hi", parentMessageId: bMsg.id }))).toBe(404);
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
