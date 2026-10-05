/* Farm Space Collaboration Phase 2 Test Suite
   Covers:
     A. Migration 0030 Schema & Index verification
     B. Chat Typing Indicators (update, 6s expiration, self-exclusion, cross-space isolation, backward compat)
     C. DM Typing Indicators (update caller side only, 6s expiration, cross-conversation isolation)
     D. Task Linking (task existence, space scoping, deleted task rejection, task_title in send and list)
     E. Mention UX (active member mention validation, cross-space drop, mention persistence)
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

describe("Migration 0030 — Schema and Indexes", () => {
  it("applied 0030 cleanly and added typing columns and partial index", async () => {
    // 1. Columns on farm_space_memberships
    const memCols = await db.query(`
      select column_name, data_type
        from information_schema.columns
       where table_name = 'farm_space_memberships'
         and column_name = 'typing_chat_at'
    `);
    expect(memCols.rows).toHaveLength(1);
    expect(memCols.rows[0].column_name).toBe("typing_chat_at");

    // 2. Columns on farm_dm_conversations
    const dmCols = await db.query(`
      select column_name, data_type
        from information_schema.columns
       where table_name = 'farm_dm_conversations'
         and column_name in ('member_a_typing_at', 'member_b_typing_at')
       order by column_name asc
    `);
    expect(dmCols.rows).toHaveLength(2);
    expect(dmCols.rows[0].column_name).toBe("member_a_typing_at");
    expect(dmCols.rows[1].column_name).toBe("member_b_typing_at");

    // 3. Partial index on farm_space_memberships
    const indexes = await db.query(`
      select indexname from pg_indexes
       where indexname = 'idx_farm_space_memberships_typing'
    `);
    expect(indexes.rows).toHaveLength(1);
  });
});

describe("Chat Typing Indicators", () => {
  it("records typing, reports active typing members to peers, filters caller, and expires after 6s", async () => {
    const f1 = await buildFarm(1, "Farm One", { workers: [2, 3] });
    const ownerId = await userIdOf(f1.owner);
    const worker1Id = await userIdOf(f1.workers[0]);
    const worker2Id = await userIdOf(f1.workers[1]);

    // Initial state: no one is typing
    const res1 = (await call(f1.owner, "chat.list", { spaceId: f1.space.id, payload: { includeTyping: true } })).data;
    expect(res1.typing_members).toEqual([]);

    // Worker 1 reports typing
    const typeRes = (await call(f1.workers[0], "chat.typing", { spaceId: f1.space.id })).data;
    expect(typeRes.success).toBe(true);

    // Owner checks typing members: should see Worker 1
    const resOwner = (await call(f1.owner, "chat.list", { spaceId: f1.space.id, payload: { includeTyping: true } })).data;
    expect(resOwner.typing_members).toHaveLength(1);
    expect(resOwner.typing_members[0].user_id).toBe(worker1Id);

    // Worker 1 checks typing members: should NOT see self
    const resWorker1 = (await call(f1.workers[0], "chat.list", { spaceId: f1.space.id, payload: { includeTyping: true } })).data;
    expect(resWorker1.typing_members).toEqual([]);

    // Worker 2 also reports typing
    await call(f1.workers[1], "chat.typing", { spaceId: f1.space.id });
    const resOwner2 = (await call(f1.owner, "chat.list", { spaceId: f1.space.id, payload: { includeTyping: true } })).data;
    expect(resOwner2.typing_members).toHaveLength(2);
    const userIds = resOwner2.typing_members.map((m) => m.user_id);
    expect(userIds).toContain(worker1Id);
    expect(userIds).toContain(worker2Id);

    // Backward compatibility: chat.list without includeTyping returns an Array of messages
    const legacyRes = (await call(f1.owner, "chat.list", { spaceId: f1.space.id, payload: {} })).data;
    expect(Array.isArray(legacyRes)).toBe(true);

    // Fast-forward / age Worker 1's typing beyond 6 seconds
    await db.query(`
      update farm_space_memberships
         set typing_chat_at = now() - interval '7 seconds'
       where space_id = $1 and user_id = $2
    `, [f1.space.id, worker1Id]);

    // Now Owner should only see Worker 2 typing
    const resAfterExpiry = (await call(f1.owner, "chat.list", { spaceId: f1.space.id, payload: { includeTyping: true } })).data;
    expect(resAfterExpiry.typing_members).toHaveLength(1);
    expect(resAfterExpiry.typing_members[0].user_id).toBe(worker2Id);
  });

  it("isolates chat typing state between different farm spaces", async () => {
    const f1 = await buildFarm(1, "Farm Alpha", { workers: [2] });
    const f2 = await buildFarm(3, "Farm Beta", { workers: [4] });

    // Worker in Farm 1 types
    await call(f1.workers[0], "chat.typing", { spaceId: f1.space.id });

    // Farm 1 owner sees typing
    const f1OwnerRes = (await call(f1.owner, "chat.list", { spaceId: f1.space.id, payload: { includeTyping: true } })).data;
    expect(f1OwnerRes.typing_members).toHaveLength(1);

    // Farm 2 owner does NOT see any typing
    const f2OwnerRes = (await call(f2.owner, "chat.list", { spaceId: f2.space.id, payload: { includeTyping: true } })).data;
    expect(f2OwnerRes.typing_members).toHaveLength(0);
  });
});

describe("DM Typing Indicators", () => {
  it("records participant typing, updates only caller side, and expires after 6s", async () => {
    const f = await buildFarm(1, "Farm DM", { workers: [2, 3] });
    const ownerId = await userIdOf(f.owner);
    const worker1Id = await userIdOf(f.workers[0]);
    const worker2Id = await userIdOf(f.workers[1]);

    // Open conversation between Owner and Worker 1
    const conv = (await call(f.owner, "dm.open", { spaceId: f.space.id, payload: { otherUserId: worker1Id } })).data;
    expect(conv.id).toBeDefined();

    // Initially neither is typing
    const initialList = (await call(f.owner, "dm.list", { spaceId: f.space.id, payload: { conversationId: conv.id, includeTyping: true } })).data;
    expect(initialList.other_is_typing).toBe(false);

    // Worker 1 types in this DM
    const typeRes = (await call(f.workers[0], "dm.typing", { spaceId: f.space.id, payload: { conversationId: conv.id } })).data;
    expect(typeRes.success).toBe(true);

    // Owner checks dm.list: other_is_typing should be true
    const ownerList = (await call(f.owner, "dm.list", { spaceId: f.space.id, payload: { conversationId: conv.id, includeTyping: true } })).data;
    expect(ownerList.other_is_typing).toBe(true);

    // Worker 1 checks dm.list: other_is_typing should be false (owner is not typing)
    const workerList = (await call(f.workers[0], "dm.list", { spaceId: f.space.id, payload: { conversationId: conv.id, includeTyping: true } })).data;
    expect(workerList.other_is_typing).toBe(false);

    // Owner checks dm.conversations inbox: conversation row includes other_is_typing: true
    const inbox = (await call(f.owner, "dm.conversations", { spaceId: f.space.id })).data;
    const convRow = inbox.find((c) => c.id === conv.id);
    expect(convRow.other_is_typing).toBe(true);

    // Age typing timestamp beyond 6 seconds
    await db.query(`
      update farm_dm_conversations
         set member_a_typing_at = case when member_a_id = $1 then now() - interval '7 seconds' else member_a_typing_at end,
             member_b_typing_at = case when member_b_id = $1 then now() - interval '7 seconds' else member_b_typing_at end
       where id = $2
    `, [worker1Id, conv.id]);

    // Now other_is_typing has expired
    const expiredList = (await call(f.owner, "dm.list", { spaceId: f.space.id, payload: { conversationId: conv.id, includeTyping: true } })).data;
    expect(expiredList.other_is_typing).toBe(false);

    // Non-participant cannot send typing to this conversation
    const rogue = await call(f.workers[1], "dm.typing", { spaceId: f.space.id, payload: { conversationId: conv.id } });
    expect(rogue.status).toBe(404);
  });
});

describe("Task Linking", () => {
  it("links existing active task and returns task_title on send and list", async () => {
    const f = await buildFarm(1, "Farm Tasks", { workers: [2] });

    // Create a task
    const task = (await call(f.owner, "tasks.create", {
      spaceId: f.space.id,
      payload: { title: "Fix irrigation line 4", category: "field" },
    })).data;
    expect(task.id).toBeDefined();

    // Send a chat message linking this task
    const sent = (await call(f.workers[0], "chat.send", {
      spaceId: f.space.id,
      payload: { body: "I am starting work on this task", taskId: task.id },
    })).data;
    expect(sent.task_id).toBe(task.id);
    expect(sent.task_title).toBe("Fix irrigation line 4");

    // Chat list also joins task_title
    const list = (await call(f.owner, "chat.list", { spaceId: f.space.id, payload: {} })).data;
    const msg = list.find((m) => m.id === sent.id);
    expect(msg).toBeDefined();
    expect(msg.task_id).toBe(task.id);
    expect(msg.task_title).toBe("Fix irrigation line 4");
  });

  it("rejects linking non-existent task or task belonging to another farm space", async () => {
    const f1 = await buildFarm(1, "Farm One");
    const f2 = await buildFarm(2, "Farm Two");

    // Create task in Farm Two
    const taskF2 = (await call(f2.owner, "tasks.create", {
      spaceId: f2.space.id,
      payload: { title: "Cross-farm task", category: "field" },
    })).data;

    // Farm One user attempts to link Farm Two task
    const crossRes = await call(f1.owner, "chat.send", {
      spaceId: f1.space.id,
      payload: { body: "Linking other farm task", taskId: taskF2.id },
    });
    expect(crossRes.status).toBe(404);

    // Link a deleted task
    await call(f2.owner, "tasks.setStatus", {
      spaceId: f2.space.id,
      payload: { taskId: taskF2.id, status: "completed" },
    });
    // Soft delete the task
    await db.query(`update farm_tasks set deleted_at = now() where id = $1`, [taskF2.id]);
    const deletedRes = await call(f2.owner, "chat.send", {
      spaceId: f2.space.id,
      payload: { body: "Linking deleted task", taskId: taskF2.id },
    });
    expect(deletedRes.status).toBe(404);
  });
});

describe("Mention UX", () => {
  it("persists mentions of active space members and drops outsiders", async () => {
    const f1 = await buildFarm(1, "Farm Alpha", { workers: [2] });
    const f2 = await buildFarm(3, "Farm Beta");
    const worker1Id = await userIdOf(f1.workers[0]);
    const outsiderId = await userIdOf(f2.owner);

    // Owner mentions both Worker 1 (in space) and Outsider (in another space)
    const sent = (await call(f1.owner, "chat.send", {
      spaceId: f1.space.id,
      payload: {
        body: "Hello @Worker1 and @Outsider",
        mentions: [worker1Id, outsiderId],
      },
    })).data;

    // Worker 1 is preserved, outsider is dropped
    expect(sent.mentions).toEqual([worker1Id]);

    // Chat list retains verified mentions
    const list = (await call(f1.workers[0], "chat.list", { spaceId: f1.space.id, payload: {} })).data;
    const msg = list.find((m) => m.id === sent.id);
    expect(msg.mentions).toEqual([worker1Id]);
  });
});
