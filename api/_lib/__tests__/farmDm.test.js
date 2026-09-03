/* Farm Space 1:1 direct messages — a second, separate surface from the
   group channel (farmChat.test.js). The tests that matter most here are
   the ones the group channel never needed: a Farm Space member who is NOT
   a participant in a given conversation must not be able to read or touch
   it, even though they are a fully authorized member of the same space. */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

vi.mock("../blobStore.js", () => ({ deleteAttachment: vi.fn(async () => {}) }));
import { deleteAttachment } from "../blobStore.js";

import { requireMembership } from "../farm/gate.js";
import { createSpace } from "../farm/spaces.js";
import { generateAgriosUserId } from "../agriosId.js";
import {
  openConversation, listConversations, sendDm, editDm, removeDm, hideDmForSelf, listDmMessages,
} from "../farm/dm.js";

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
                   "0007_agrios_user_id.sql", "0009_farm_chat_reply_react_pin.sql",
                   "0010_farm_chat_mentions_search.sql", "0011_farm_dm.sql"]) {
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
  await db.exec(`truncate farm_dm_messages, farm_dm_conversations, farm_chat_messages,
                          farm_task_events, farm_tasks, farm_audit_logs,
                          farm_space_invitations, farm_space_memberships,
                          farm_spaces, users restart identity cascade`);
  deleteAttachment.mockClear();

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

describe("opening a conversation", () => {
  it("creates one on first contact, naming the other member", async () => {
    const conv = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    expect(conv.other_user_id).toBe(M.id);
    expect(conv.other_display_name).toBe("Raju");
    expect(conv.last_message).toBeNull();
  });

  it("returns the SAME conversation whichever side opens it first", async () => {
    const fromA = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    const fromM = await openConversation(sql, memM, M.id, { otherUserId: A.id });
    expect(fromM.id).toBe(fromA.id);
  });

  it("refuses to message yourself", async () => {
    expect(await statusOf(() => openConversation(sql, memA, A.id, { otherUserId: A.id }))).toBe(400);
  });

  it("refuses to open a conversation with someone who is not an active member of this space", async () => {
    /* B is real, but a member of farmB, not farmA. */
    expect(await statusOf(() => openConversation(sql, memA, A.id, { otherUserId: B.id }))).toBe(404);
  });
});

describe("isolation between participants", () => {
  it("a third member of the same space cannot read a conversation they are not part of", async () => {
    const conv = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    await sendDm(sql, memA, A.id, { conversationId: conv.id, body: "private" });

    /* W is a real, authorized member of farmA — just not a participant here. */
    expect(await statusOf(() => listDmMessages(sql, memW, W.id, { conversationId: conv.id }))).toBe(404);
    expect(await statusOf(() => sendDm(sql, memW, W.id, { conversationId: conv.id, body: "butting in" }))).toBe(404);
  });

  it("never shows one space's conversation to a member of another space", async () => {
    const conv = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    expect(await statusOf(() => listDmMessages(sql, memB, B.id, { conversationId: conv.id }))).toBe(404);
  });

  it("only surfaces a conversation in the inbox of its two participants", async () => {
    const conv = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    expect((await listConversations(sql, memA, A.id)).map((c) => c.id)).toContain(conv.id);
    expect((await listConversations(sql, memM, M.id)).map((c) => c.id)).toContain(conv.id);
    expect((await listConversations(sql, memW, W.id)).map((c) => c.id)).not.toContain(conv.id);
  });
});

describe("sending and reading", () => {
  it("both participants see the same messages, oldest first", async () => {
    const conv = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    await sendDm(sql, memA, A.id, { conversationId: conv.id, body: "hi Raju" });
    await sendDm(sql, memM, M.id, { conversationId: conv.id, body: "hi Soumen" });

    const asA = await listDmMessages(sql, memA, A.id, { conversationId: conv.id });
    const asM = await listDmMessages(sql, memM, M.id, { conversationId: conv.id });
    expect(asA.map((m) => m.body)).toEqual(["hi Raju", "hi Soumen"]);
    expect(asM.map((m) => m.body)).toEqual(["hi Raju", "hi Soumen"]);
  });

  it("refuses an empty message", async () => {
    const conv = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    expect(await statusOf(() => sendDm(sql, memA, A.id, { conversationId: conv.id, body: "   " }))).toBe(400);
  });

  it("bumps the conversation to the top of the inbox on a new message", async () => {
    const c1 = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    const c2 = await openConversation(sql, memA, A.id, { otherUserId: W.id });
    await sendDm(sql, memA, A.id, { conversationId: c1.id, body: "first" });
    await sendDm(sql, memA, A.id, { conversationId: c2.id, body: "second, more recent" });

    const inbox = await listConversations(sql, memA, A.id);
    expect(inbox.map((c) => c.id)).toEqual([c2.id, c1.id]);
    expect(inbox[0].last_message.body).toBe("second, more recent");
  });
});

describe("editing", () => {
  it("lets a sender edit their own recent message", async () => {
    const conv = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    const msg = await sendDm(sql, memA, A.id, { conversationId: conv.id, body: "oops typo" });
    const edited = await editDm(sql, memA, A.id, { conversationId: conv.id, messageId: msg.id, body: "fixed" });
    expect(edited.body).toBe("fixed");
    expect(edited.edited_at).toBeTruthy();
  });

  it("refuses to edit the other participant's message", async () => {
    const conv = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    const msg = await sendDm(sql, memA, A.id, { conversationId: conv.id, body: "mine" });
    expect(await statusOf(() => editDm(sql, memM, M.id, { conversationId: conv.id, messageId: msg.id, body: "hijacked" }))).toBe(403);
  });
});

describe("deleting", () => {
  it("lets a sender remove their own recent message for everyone, as a tombstone", async () => {
    const conv = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    const msg = await sendDm(sql, memA, A.id, { conversationId: conv.id, body: "oops" });
    expect(await statusOf(() => removeDm(sql, memA, A.id, { conversationId: conv.id, messageId: msg.id }))).toBe(200);

    const [row] = await listDmMessages(sql, memM, M.id, { conversationId: conv.id });
    expect(row.deleted).toBe(true);
    expect(row.body).toBeNull();
  });

  it("has no moderator override — the other participant cannot remove your message", async () => {
    const conv = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    const msg = await sendDm(sql, memA, A.id, { conversationId: conv.id, body: "mine" });
    /* M is a manager in farmA, which would let them moderate the GROUP
       channel — a DM has no such tier. */
    expect(await statusOf(() => removeDm(sql, memM, M.id, { conversationId: conv.id, messageId: msg.id }))).toBe(403);
  });

  it("frees the Blob file for a real attachment when removed for everyone", async () => {
    const conv = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    const url = "https://abc123.public.blob.vercel-storage.com/farm-chat/space1/shed.jpg";
    const msg = await sendDm(sql, memA, A.id, {
      conversationId: conv.id,
      attachments: [{ kind: "image", url, name: "shed.jpg", size: 10, type: "image/jpeg" }],
    });
    await removeDm(sql, memA, A.id, { conversationId: conv.id, messageId: msg.id });
    expect(deleteAttachment).toHaveBeenCalledWith(url);
  });

  it("delete-for-me hides a message from one participant without touching the other's copy", async () => {
    const conv = await openConversation(sql, memA, A.id, { otherUserId: M.id });
    const msg = await sendDm(sql, memA, A.id, { conversationId: conv.id, body: "hide from me" });
    await hideDmForSelf(sql, memA, A.id, { conversationId: conv.id, messageId: msg.id });

    expect(await listDmMessages(sql, memA, A.id, { conversationId: conv.id })).toEqual([]);
    expect((await listDmMessages(sql, memM, M.id, { conversationId: conv.id })).map((m) => m.body)).toEqual(["hide from me"]);
  });
});
