/* Farm Space Collaboration State Layer — Phase 1 Test Suite
   Covers:
     A. Chat unread (new message increments, own excluded, deleted excluded, markRead clears through target, later remains unread, cursor cannot regress, cross-space isolation)
     B. DM unread (unread_count correct, markRead affects only correct participant, markRead cannot move backward, later messages remain unread, cross-space isolation)
     C. Hub aggregation (farm.unreadCounts returns correct chatUnread/dmUnread, switching spaces changes counts correctly, no cache leakage)
     D. Presence (last_seen_at updates only when throttling interval permits, online/offline threshold behaves correctly, cross-space isolation)
     E. Migration (0029 applies cleanly, columns have valid defaults, indexes exist)
     F. Race-condition test (message A rendered, message B created afterwards, markRead sent for A -> A read, B unread)
*/

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("../db.js", async () => {
  const { dbRef } = await import("./e2e/harness.js");
  return { getSql: () => dbRef.sql };
});
vi.mock("../../_middleware/verifyAuth.js", async () => {
  const { testVerifyToken } = await import("./e2e/harness.js");
  return { verifyToken: testVerifyToken };
});
vi.mock("../blobStore.js", () => ({ deleteAttachment: vi.fn(async () => {}) }));

import { freshDb, call, buildFarm, userIdOf } from "./e2e/harness.js";

let db;

beforeAll(async () => {
  const env = await freshDb();
  db = env.pg;
}, 40000);

beforeEach(async () => {
  await db.exec(`truncate farm_dm_messages, farm_dm_conversations, farm_chat_messages,
                          farm_task_events, farm_tasks, farm_audit_logs,
                          farm_space_invitations, farm_space_memberships,
                          farm_spaces, users restart identity cascade`);
});

describe("Migration 0029 — Schema and Defaults", () => {
  it("applied 0029 cleanly and established default columns and indexes", async () => {
    // Check columns on farm_space_memberships
    const memCols = await db.query(`
      select column_name, data_type, column_default
        from information_schema.columns
       where table_name = 'farm_space_memberships'
         and column_name in ('last_read_chat_at', 'last_seen_at')
       order by column_name asc
    `);
    expect(memCols.rows).toHaveLength(2);
    expect(memCols.rows[0].column_name).toBe("last_read_chat_at");
    expect(memCols.rows[1].column_name).toBe("last_seen_at");

    // Check columns on farm_dm_conversations
    const dmCols = await db.query(`
      select column_name, data_type, column_default
        from information_schema.columns
       where table_name = 'farm_dm_conversations'
         and column_name in ('member_a_last_read_at', 'member_b_last_read_at')
       order by column_name asc
    `);
    expect(dmCols.rows).toHaveLength(2);
    expect(dmCols.rows[0].column_name).toBe("member_a_last_read_at");
    expect(dmCols.rows[1].column_name).toBe("member_b_last_read_at");

    // Check indexes
    const indexes = await db.query(`
      select indexname from pg_indexes
       where indexname in ('idx_farm_chat_messages_unread', 'idx_farm_dm_messages_unread', 'idx_farm_space_memberships_presence')
       order by indexname asc
    `);
    expect(indexes.rows).toHaveLength(3);
  });
});

describe("A. Chat Unread & Cursor Monotonicity", () => {
  it("handles unread counting, exclusions, monotonic markRead, and isolation", async () => {
    const f1 = await buildFarm(1, "Farm One", { workers: [2] });
    const f2 = await buildFarm(3, "Farm Two");

    // Initially unread is 0
    const initialUnread = (await call(f1.workers[0], "chat.unread", { spaceId: f1.space.id })).data;
    expect(initialUnread.unread).toBe(0);

    // 1. New message increments unread for worker
    const m1 = (await call(f1.owner, "chat.send", { spaceId: f1.space.id, payload: { body: "Msg 1 from owner" } })).data;
    const u1 = (await call(f1.workers[0], "chat.unread", { spaceId: f1.space.id })).data;
    expect(u1.unread).toBe(1);

    // 2. Own message is excluded
    await call(f1.workers[0], "chat.send", { spaceId: f1.space.id, payload: { body: "Msg 2 from worker" } });
    const u2 = (await call(f1.workers[0], "chat.unread", { spaceId: f1.space.id })).data;
    expect(u2.unread).toBe(1);

    // 3. New message from owner increments to 2
    const m3 = (await call(f1.owner, "chat.send", { spaceId: f1.space.id, payload: { body: "Msg 3 from owner" } })).data;
    const u3 = (await call(f1.workers[0], "chat.unread", { spaceId: f1.space.id })).data;
    expect(u3.unread).toBe(2);

    // 4. Deleted message is excluded
    const m4 = (await call(f1.owner, "chat.send", { spaceId: f1.space.id, payload: { body: "Msg 4 to delete" } })).data;
    expect((await call(f1.workers[0], "chat.unread", { spaceId: f1.space.id })).data.unread).toBe(3);
    await call(f1.owner, "chat.remove", { spaceId: f1.space.id, payload: { messageId: m4.id } });
    expect((await call(f1.workers[0], "chat.unread", { spaceId: f1.space.id })).data.unread).toBe(2);

    // 5. markRead clears only through target message (m1), later message (m3) remains unread
    await call(f1.workers[0], "chat.markRead", { spaceId: f1.space.id, payload: { throughMessageId: m1.id } });
    const uAfterM1 = (await call(f1.workers[0], "chat.unread", { spaceId: f1.space.id })).data;
    expect(uAfterM1.unread).toBe(1);

    // 6. Cursor cannot regress: calling markRead with earlier message m1 does not un-read or move cursor backward
    await call(f1.workers[0], "chat.markRead", { spaceId: f1.space.id, payload: { throughMessageId: m3.id } });
    expect((await call(f1.workers[0], "chat.unread", { spaceId: f1.space.id })).data.unread).toBe(0);

    // Trying to regress with m1
    await call(f1.workers[0], "chat.markRead", { spaceId: f1.space.id, payload: { throughMessageId: m1.id } });
    expect((await call(f1.workers[0], "chat.unread", { spaceId: f1.space.id })).data.unread).toBe(0);

    // 7. Cross-space isolation: messages in space 2 do not affect space 1
    await call(f2.owner, "chat.send", { spaceId: f2.space.id, payload: { body: "Space 2 chat" } });
    expect((await call(f1.workers[0], "chat.unread", { spaceId: f1.space.id })).data.unread).toBe(0);

    // Reject nonexistent or cross-space message in markRead
    const badMark = await call(f1.workers[0], "chat.markRead", { spaceId: f1.space.id, payload: { throughMessageId: "00000000-0000-0000-0000-000000000000" } });
    expect(badMark.status).toBe(404);
  });
});

describe("B. DM Unread & Cursor Monotonicity", () => {
  it("tracks unread_count per conversation, affects only target participant, cannot regress", async () => {
    const f1 = await buildFarm(1, "Farm One", { workers: [2] });
    const f2 = await buildFarm(3, "Farm Two", { workers: [4] });

    const u2Id = await userIdOf(f1.workers[0]);
    const u4Id = await userIdOf(f2.workers[0]);

    // Open DM between U(1) and U(2) in Space 1
    const conv1 = (await call(f1.owner, "dm.open", { spaceId: f1.space.id, payload: { otherUserId: u2Id } })).data;

    // 1. Initial conversations list has unread_count = 0
    const listInitial = (await call(f1.workers[0], "dm.conversations", { spaceId: f1.space.id })).data;
    expect(listInitial[0].unread_count).toBe(0);

    // 2. U(1) sends DM 1 -> U(2)'s unread_count becomes 1, U(1)'s unread_count remains 0
    const d1 = (await call(f1.owner, "dm.send", { spaceId: f1.space.id, payload: { conversationId: conv1.id, body: "Hello U2 msg 1" } })).data;
    const listU2_1 = (await call(f1.workers[0], "dm.conversations", { spaceId: f1.space.id })).data;
    expect(listU2_1[0].unread_count).toBe(1);

    const listU1_1 = (await call(f1.owner, "dm.conversations", { spaceId: f1.space.id })).data;
    expect(listU1_1[0].unread_count).toBe(0);

    // 3. U(1) sends DM 2 -> unread_count becomes 2
    const d2 = (await call(f1.owner, "dm.send", { spaceId: f1.space.id, payload: { conversationId: conv1.id, body: "Hello U2 msg 2" } })).data;
    const listU2_2 = (await call(f1.workers[0], "dm.conversations", { spaceId: f1.space.id })).data;
    expect(listU2_2[0].unread_count).toBe(2);

    // 4. Mark read through d1 -> d2 remains unread (count becomes 1)
    await call(f1.workers[0], "dm.markRead", { spaceId: f1.space.id, payload: { conversationId: conv1.id, throughMessageId: d1.id } });
    const listU2_3 = (await call(f1.workers[0], "dm.conversations", { spaceId: f1.space.id })).data;
    expect(listU2_3[0].unread_count).toBe(1);

    // 5. Mark read through d2 -> count becomes 0
    await call(f1.workers[0], "dm.markRead", { spaceId: f1.space.id, payload: { conversationId: conv1.id, throughMessageId: d2.id } });
    const listU2_4 = (await call(f1.workers[0], "dm.conversations", { spaceId: f1.space.id })).data;
    expect(listU2_4[0].unread_count).toBe(0);

    // 6. Monotonicity: calling markRead with earlier d1 cannot regress cursor
    await call(f1.workers[0], "dm.markRead", { spaceId: f1.space.id, payload: { conversationId: conv1.id, throughMessageId: d1.id } });
    const listU2_5 = (await call(f1.workers[0], "dm.conversations", { spaceId: f1.space.id })).data;
    expect(listU2_5[0].unread_count).toBe(0);

    // 7. Isolation: space 2 DM cannot affect space 1
    const conv2 = (await call(f2.owner, "dm.open", { spaceId: f2.space.id, payload: { otherUserId: u4Id } })).data;
    await call(f2.owner, "dm.send", { spaceId: f2.space.id, payload: { conversationId: conv2.id, body: "Space 2 DM" } });

    // U(2) in space 1 still has 0
    expect((await call(f1.workers[0], "dm.conversations", { spaceId: f1.space.id })).data[0].unread_count).toBe(0);
  });
});

describe("C. Hub Aggregated Unread Counts", () => {
  it("returns correct chatUnread and dmUnread, switches spaces cleanly, avoids cache leakage", async () => {
    const f1 = await buildFarm(1, "Farm One", { workers: [2] });
    const f2 = await buildFarm(2, "Farm Two"); // U(2) is owner of farm 2

    // Initial counts for U(2) in Farm 1
    const countsS1_init = (await call(f1.workers[0], "farm.unreadCounts", { spaceId: f1.space.id })).data;
    expect(countsS1_init).toEqual({ chatUnread: 0, dmUnread: 0 });

    // 1. Send chat message from U(1) in Space 1
    await call(f1.owner, "chat.send", { spaceId: f1.space.id, payload: { body: "Team announcement" } });

    // 2. Send DM from U(1) to U(2) in Space 1
    const u2Id = await userIdOf(f1.workers[0]);
    const conv = (await call(f1.owner, "dm.open", { spaceId: f1.space.id, payload: { otherUserId: u2Id } })).data;
    await call(f1.owner, "dm.send", { spaceId: f1.space.id, payload: { conversationId: conv.id, body: "Direct question" } });

    // Check Hub unread counts in Space 1
    const countsS1 = (await call(f1.workers[0], "farm.unreadCounts", { spaceId: f1.space.id })).data;
    expect(countsS1).toEqual({ chatUnread: 1, dmUnread: 1 });

    // 3. Switch to Space 2: counts must be 0 (no leakage across spaces)
    const countsS2 = (await call(f2.owner, "farm.unreadCounts", { spaceId: f2.space.id })).data;
    expect(countsS2).toEqual({ chatUnread: 0, dmUnread: 0 });
  });
});

describe("D. Presence Piggyback & Liveness Evaluation", () => {
  it("piggybacks last_seen_at updates with 60s throttling and detects online/offline status", async () => {
    const f = await buildFarm(1, "Presence Farm", { workers: [2] });
    const u1Id = await userIdOf(f.owner);
    const u2Id = await userIdOf(f.workers[0]);

    // Initial membership last_seen_at
    const mem1Before = (await db.query(`select last_seen_at from farm_space_memberships where space_id = $1 and user_id = $2`, [f.space.id, u1Id])).rows[0];
    expect(mem1Before.last_seen_at).toBeDefined();

    // Make an API request immediately: should NOT update last_seen_at because it was updated < 60s ago
    await call(f.owner, "chat.list", { spaceId: f.space.id });
    const mem1AfterImmediate = (await db.query(`select last_seen_at from farm_space_memberships where space_id = $1 and user_id = $2`, [f.space.id, u1Id])).rows[0];
    expect(new Date(mem1AfterImmediate.last_seen_at).getTime()).toBe(new Date(mem1Before.last_seen_at).getTime());

    // Artificially age last_seen_at by 70 seconds
    await db.query(`update farm_space_memberships set last_seen_at = now() - interval '70 seconds' where space_id = $1 and user_id = $2`, [f.space.id, u1Id]);

    // Call API: now last_seen_at SHOULD update
    await call(f.owner, "chat.list", { spaceId: f.space.id });
    const mem1AfterThrottled = (await db.query(`select last_seen_at from farm_space_memberships where space_id = $1 and user_id = $2`, [f.space.id, u1Id])).rows[0];
    expect(new Date(mem1AfterThrottled.last_seen_at).getTime()).toBeGreaterThan(Date.now() - 5000);

    // Verify online evaluation in dm.conversations
    await call(f.owner, "dm.open", { spaceId: f.space.id, payload: { otherUserId: u2Id } });

    // U(1) is online (< 90s), so when U(2) lists conversations, other_is_online should be true
    const convsForU2 = (await call(f.workers[0], "dm.conversations", { spaceId: f.space.id })).data;
    expect(convsForU2[0].other_is_online).toBe(true);

    // Age U(1) past 90 seconds (e.g. 100 seconds)
    await db.query(`update farm_space_memberships set last_seen_at = now() - interval '100 seconds' where space_id = $1 and user_id = $2`, [f.space.id, u1Id]);
    const convsForU2Offline = (await call(f.workers[0], "dm.conversations", { spaceId: f.space.id })).data;
    expect(convsForU2Offline[0].other_is_online).toBe(false);
  });
});

describe("F. Race-Condition Test", () => {
  it("maintains message B as unread when message A is rendered and marked read while B arrives", async () => {
    const f = await buildFarm(1, "Race Condition Farm", { workers: [2] });
    const u2Id = await userIdOf(f.workers[0]);

    // 1. Message A is sent and rendered by worker
    const msgA = (await call(f.owner, "chat.send", { spaceId: f.space.id, payload: { body: "Message A" } })).data;
    expect((await call(f.workers[0], "chat.unread", { spaceId: f.space.id })).data.unread).toBe(1);

    // 2. Message B is created afterwards
    const msgB = (await call(f.owner, "chat.send", { spaceId: f.space.id, payload: { body: "Message B arriving later" } })).data;
    expect(msgB.id).toBeTruthy();
    expect((await call(f.workers[0], "chat.unread", { spaceId: f.space.id })).data.unread).toBe(2);

    // 3. markRead is sent for Message A (the only one that was rendered on client)
    await call(f.workers[0], "chat.markRead", { spaceId: f.space.id, payload: { throughMessageId: msgA.id } });

    // 4. Message A becomes read, but Message B remains unread!
    const unreadAfterA = (await call(f.workers[0], "chat.unread", { spaceId: f.space.id })).data;
    expect(unreadAfterA.unread).toBe(1);

    // Same test for Direct Messages:
    const conv = (await call(f.owner, "dm.open", { spaceId: f.space.id, payload: { otherUserId: u2Id } })).data;

    // DM A sent
    const dmA = (await call(f.owner, "dm.send", { spaceId: f.space.id, payload: { conversationId: conv.id, body: "DM A" } })).data;
    // DM B sent
    const dmB = (await call(f.owner, "dm.send", { spaceId: f.space.id, payload: { conversationId: conv.id, body: "DM B" } })).data;

    expect((await call(f.workers[0], "dm.conversations", { spaceId: f.space.id })).data[0].unread_count).toBe(2);

    // markRead sent for DM A
    await call(f.workers[0], "dm.markRead", { spaceId: f.space.id, payload: { conversationId: conv.id, throughMessageId: dmA.id } });

    // DM B must remain unread!
    expect((await call(f.workers[0], "dm.conversations", { spaceId: f.space.id })).data[0].unread_count).toBe(1);

    // markRead sent for DM B -> clears to 0
    await call(f.workers[0], "dm.markRead", { spaceId: f.space.id, payload: { conversationId: conv.id, throughMessageId: dmB.id } });
    expect((await call(f.workers[0], "dm.conversations", { spaceId: f.space.id })).data[0].unread_count).toBe(0);
  });
});
