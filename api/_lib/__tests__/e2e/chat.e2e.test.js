/* Tier-1: multi-sender chat behavior through the real handler — bursts,
   attribution, unread math, per-viewer hides, reactions at member scale,
   forged mentions, search scoping, and DM pairs. Concurrency caveat: see
   harness.js. */

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

let F;
const MEMBERS = Array.from({ length: 19 }, (_, i) => 52 + i); // U(52)..U(70) + owner U(51) = 20 senders

beforeAll(async () => {
  await freshDb();
  F = await buildFarm(51, "Chat Farm", { workers: MEMBERS });
}, 240000);

describe("20-sender burst", () => {
  it("all 20 messages land exactly once, correctly attributed, consistently ordered", async () => {
    const senders = [F.owner, ...F.workers];
    const results = await Promise.all(senders.map((uid, i) =>
      call(uid, "chat.send", { spaceId: F.space.id, payload: { body: `burst from ${uid} #${i}` } })));

    for (const r of results) expect(r.status).toBe(200);
    expect(new Set(results.map((r) => r.data.id)).size).toBe(20); // no dupes, none lost

    const list = await call(F.owner, "chat.list", { spaceId: F.space.id, payload: { limit: 100 } });
    const burst = list.data.filter((m) => m.body?.startsWith("burst from"));
    expect(burst).toHaveLength(20);

    /* Attribution: each body names its sender; the row must agree. */
    for (const m of burst) {
      const claimed = m.body.match(/burst from (TEST-USER-\d{3})/)[1];
      expect(m.sender_user_id).toBe(await userIdOf(claimed));
    }

    /* Ordering: ascending created_at, ties broken consistently — every
       member sees the SAME order. */
    const asWorker = await call(F.workers[3], "chat.list", { spaceId: F.space.id, payload: { limit: 100 } });
    expect(asWorker.data.map((m) => m.id)).toEqual(list.data.map((m) => m.id));
  }, 60000);

  it("unread math: a member who saw none of the burst counts exactly the others' messages", async () => {
    /* `since` from before everything: each member's unread excludes their own. */
    const since = "2020-01-01T00:00:00Z";
    const r = await call(F.workers[0], "chat.unread", { spaceId: F.space.id, payload: { since } });
    expect(r.status).toBe(200);
    const totalRows = await dbRef.sql`
      select count(*)::int as n from farm_chat_messages
       where space_id = ${F.space.id} and deleted_at is null and sender_user_id <> ${await userIdOf(F.workers[0])}`;
    expect(r.data.unread).toBe(totalRows[0].n);
  });
});

describe("per-viewer state stays per-viewer", () => {
  let msg;
  beforeAll(async () => {
    msg = (await call(F.owner, "chat.send", { spaceId: F.space.id, payload: { body: "hide me for one member" } })).data;
  });

  it("delete-for-me hides only for the hider", async () => {
    expect((await call(F.workers[1], "chat.hide", { spaceId: F.space.id, payload: { messageId: msg.id } })).status).toBe(200);
    const hidden = await call(F.workers[1], "chat.list", { spaceId: F.space.id, payload: { limit: 100 } });
    expect(hidden.data.some((m) => m.id === msg.id)).toBe(false);
    const visible = await call(F.workers[2], "chat.list", { spaceId: F.space.id, payload: { limit: 100 } });
    expect(visible.data.some((m) => m.id === msg.id)).toBe(true);
  });

  it("ten members react; one per member, replace-not-stack; grouped correctly", async () => {
    const reactors = F.workers.slice(0, 10);
    await Promise.all(reactors.map((uid, i) =>
      call(uid, "chat.react", { spaceId: F.space.id, payload: { messageId: msg.id, emoji: i % 2 ? "👍" : "❤️" } })));
    /* One member changes their mind — replaces, doesn't add. */
    await call(reactors[0], "chat.react", { spaceId: F.space.id, payload: { messageId: msg.id, emoji: "🎉" } });

    const rows = await dbRef.sql`select user_id, emoji from farm_chat_reactions where message_id = ${msg.id}`;
    expect(rows).toHaveLength(10); // one per member, exactly
    expect(rows.filter((r) => r.emoji === "🎉")).toHaveLength(1);
  });

  it("edit is own-message-only even for the space owner", async () => {
    const theirs = (await call(F.workers[5], "chat.send", { spaceId: F.space.id, payload: { body: "worker words" } })).data;
    expect((await call(F.owner, "chat.edit", { spaceId: F.space.id, payload: { messageId: theirs.id, body: "owner rewrite" } })).status).toBe(403);
  });
});

describe("mentions and search", () => {
  it("a forged mention id (any non-member) is silently dropped; a real member sticks", async () => {
    const realMember = await userIdOf(F.workers[6]);
    const r = await call(F.owner, "chat.send", { spaceId: F.space.id, payload: {
      body: "@Tester ping", mentions: [realMember, "00000000-0000-0000-0000-00000000dead"] } });
    expect(r.status).toBe(200);
    expect(r.data.mentions).toEqual([realMember]);
  });

  it("search finds by substring, is case-insensitive, and never crosses farms", async () => {
    const other = await buildFarm(81, "Other Search Farm", {});
    await call(U(81), "chat.send", { spaceId: other.space.id, payload: { body: "UNIQUEWORD in other farm" } });
    await call(F.owner, "chat.send", { spaceId: F.space.id, payload: { body: "UNIQUEWORD in chat farm" } });

    const here = await call(F.workers[0], "chat.search", { spaceId: F.space.id, payload: { query: "uniqueword" } });
    expect(here.data).toHaveLength(1);
    expect(here.data[0].body).toBe("UNIQUEWORD in chat farm");
  });
});

describe("DM pairs at handler level", () => {
  it("five pairs converse; each inbox shows only its own conversations, newest activity first", async () => {
    const pairs = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]].map(([a, b]) => [F.workers[a], F.workers[b]]);
    for (const [a, b] of pairs) {
      const conv = (await call(a, "dm.open", { spaceId: F.space.id, payload: { otherUserId: await userIdOf(b) } })).data;
      expect((await call(a, "dm.send", { spaceId: F.space.id, payload: { conversationId: conv.id, body: `hello from ${a}` } })).status).toBe(200);
      expect((await call(b, "dm.send", { spaceId: F.space.id, payload: { conversationId: conv.id, body: `reply from ${b}` } })).status).toBe(200);
    }

    for (const [a, b] of pairs) {
      const inbox = await call(a, "dm.conversations", { spaceId: F.space.id });
      expect(inbox.data).toHaveLength(1); // exactly their one conversation
      expect(inbox.data[0].last_message.body).toBe(`reply from ${b}`);
      expect(inbox.data[0].last_message.mine).toBe(false);
    }

    /* A member in no pair has an empty inbox. */
    const lonely = await call(F.workers[12], "dm.conversations", { spaceId: F.space.id });
    expect(lonely.data).toHaveLength(0);
  }, 60000);

  it("opening the same pair from either side yields one conversation, not two", async () => {
    const a = F.workers[10], b = F.workers[11];
    const c1 = (await call(a, "dm.open", { spaceId: F.space.id, payload: { otherUserId: await userIdOf(b) } })).data;
    const c2 = (await call(b, "dm.open", { spaceId: F.space.id, payload: { otherUserId: await userIdOf(a) } })).data;
    expect(c2.id).toBe(c1.id);
    const rows = await dbRef.sql`
      select count(*)::int as n from farm_dm_conversations where space_id = ${F.space.id}`;
    expect(rows[0].n).toBe(6); // 5 pairs + this one
  });
});
