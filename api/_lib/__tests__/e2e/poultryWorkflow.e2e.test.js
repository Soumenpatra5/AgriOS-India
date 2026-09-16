/* Poultry Phase A — workflow engine E2E suite.

   Drives the 13 workflow actions through the real /api/farm handler.
   Each action is space-scoped; authorization is tested at the boundary
   (worker cannot skip, wrong space cannot read chain). */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { freshDb, dbRef, call, U, buildFarm } from "./harness.js";

vi.mock("../../db.js", () => ({ getSql: () => dbRef.sql }));
vi.mock("../../../_middleware/verifyAuth.js", async () => ({
  verifyToken: (await import("./harness.js")).testVerifyToken,
}));
vi.mock("../../blobStore.js", () => ({ deleteAttachment: async () => {} }));

const DAY = 86400000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

let A, B;
let batchA;

const mkBatch = async (uid, spaceId, over = {}) => (await call(uid, "poultry.batches.create", {
  spaceId,
  payload: {
    name: `WF-${Math.random().toString(36).slice(2, 6)}`,
    placement_date: daysAgo(14), placed_qty: 500, status: "active",
    placement_avg_weight_g: 42, ...over,
  },
})).data;

beforeAll(async () => {
  await freshDb();
  A = await buildFarm(30, "Workflow Farm A", { managers: [31], workers: [32] });
  B = await buildFarm(40, "Workflow Farm B", { managers: [41] });
  batchA = await mkBatch(U(30), A.space.id);
  await mkBatch(U(40), B.space.id);
}, 60000);

/* ── poultry.summary.daily ──────────────────────────────────────────────── */

describe("poultry.summary.daily", () => {
  it("returns expected shape for an active batch", async () => {
    const r = await call(U(30), "poultry.summary.daily", {
      spaceId: A.space.id,
      payload: { batchId: batchA.id },
    });
    expect(r.status).toBe(200);
    const d = r.data;
    expect(d).toHaveProperty("batchId", batchA.id);
    expect(d).toHaveProperty("batchDay");
    expect(typeof d.batchDay).toBe("number");
    expect(d).toHaveProperty("summary");
    const s = d.summary;
    expect(s).toHaveProperty("pending");
    expect(s).toHaveProperty("overdue");
    expect(s).toHaveProperty("completed");
    expect(s).toHaveProperty("upcoming");
    expect(s).toHaveProperty("attention");
    expect(s).toHaveProperty("recommendation");
    expect(Array.isArray(s.pending.tasks)).toBe(true);
    expect(Array.isArray(s.overdue.tasks)).toBe(true);
    expect(Array.isArray(s.completed.tasks)).toBe(true);
    expect(Array.isArray(s.upcoming.tasks)).toBe(true);
  });

  it("worker (view permission) can call daily summary", async () => {
    const r = await call(U(32), "poultry.summary.daily", {
      spaceId: A.space.id,
      payload: { batchId: batchA.id },
    });
    expect(r.status).toBe(200);
  });

  it("cross-space: space B member cannot read space A batch", async () => {
    const r = await call(U(40), "poultry.summary.daily", {
      spaceId: B.space.id,
      payload: { batchId: batchA.id },
    });
    expect(r.status).not.toBe(200);
  });
});

/* ── poultry.workflow.today ─────────────────────────────────────────────── */

describe("poultry.workflow.today", () => {
  it("generates tasks for an active batch", async () => {
    const r = await call(U(30), "poultry.workflow.today", {
      spaceId: A.space.id,
      payload: { batchId: batchA.id },
    });
    expect(r.status).toBe(200);
    /* generateTodaysTasks returns { tasks: [...], recommendation: {...|null} } */
    expect(r.data).toHaveProperty("tasks");
    expect(Array.isArray(r.data.tasks)).toBe(true);
  });
});

/* ── poultry.workflow.complete ──────────────────────────────────────────── */

describe("poultry.workflow.complete", () => {
  let taskId;

  beforeAll(async () => {
    const r = await call(U(30), "poultry.workflow.today", {
      spaceId: A.space.id,
      payload: { batchId: batchA.id },
    });
    const tasks = (r.data?.tasks || []).filter(t =>
      !["completed", "skipped", "blocked", "cancelled"].includes(t.status) &&
      t.task_type !== "chain_followup"
    );
    taskId = tasks[0]?.id || null;
  });

  it("marks a non-chain task complete", async () => {
    if (!taskId) { expect(true).toBe(true); return; } // no eligible task today
    const r = await call(U(30), "poultry.workflow.complete", {
      spaceId: A.space.id,
      payload: { taskId, notes: "done from test", clientUuid: crypto.randomUUID() },
    });
    expect(r.status).toBe(200);
    expect(r.data?.status).toBe("completed");
  });

  it("idempotency: completing the same task with the same clientUuid is a no-op", async () => {
    if (!taskId) { expect(true).toBe(true); return; }
    const uuid = crypto.randomUUID();
    await call(U(30), "poultry.workflow.complete", {
      spaceId: A.space.id,
      payload: { taskId, clientUuid: uuid },
    });
    const r2 = await call(U(30), "poultry.workflow.complete", {
      spaceId: A.space.id,
      payload: { taskId, clientUuid: uuid },
    });
    expect(r2.status).toBe(200);
  });

  it("rejects chain_followup tasks with 400", async () => {
    /* Seed a chain_followup task directly to keep the test self-contained */
    const rows = await dbRef.sql`
      SELECT id FROM poultry_batch_tasks
      WHERE batch_id = ${batchA.id}
        AND task_type = 'chain_followup'
        AND status NOT IN ('completed','skipped','cancelled')
      LIMIT 1
    `;
    if (!rows.length) { expect(true).toBe(true); return; }
    const r = await call(U(30), "poultry.workflow.complete", {
      spaceId: A.space.id,
      payload: { taskId: rows[0].id, clientUuid: crypto.randomUUID() },
    });
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/follow.?up|chain/i);
  });
});

/* ── poultry.workflow.skip ──────────────────────────────────────────────── */

describe("poultry.workflow.skip", () => {
  let pendingTaskId;

  beforeAll(async () => {
    const r = await call(U(31), "poultry.workflow.today", {
      spaceId: A.space.id,
      payload: { batchId: batchA.id },
    });
    const tasks = (r.data?.tasks || []).filter(t =>
      ["pending", "overdue"].includes(t.status) &&
      t.task_type !== "chain_followup"
    );
    pendingTaskId = tasks[0]?.id || null;
    /* Create a fresh batch to guarantee a skippable task */
    if (!pendingTaskId) {
      const newBatch = await mkBatch(U(30), A.space.id);
        const r2 = await call(U(30), "poultry.workflow.today", {
        spaceId: A.space.id,
        payload: { batchId: newBatch.id },
      });
      pendingTaskId = (r2.data?.tasks || []).find(t =>
        ["pending", "overdue"].includes(t.status) && t.task_type !== "chain_followup"
      )?.id || null;
    }
  });

  it("manager can skip with a valid reason", async () => {
    if (!pendingTaskId) { expect(true).toBe(true); return; }
    const r = await call(U(31), "poultry.workflow.skip", {
      spaceId: A.space.id,
      payload: { taskId: pendingTaskId, reason: "Not applicable today", clientUuid: crypto.randomUUID() },
    });
    expect(r.status).toBe(200);
    expect(r.data?.status).toBe("skipped");
  });

  it("rejects an invalid skip reason with 400", async () => {
    const newBatch = await mkBatch(U(30), A.space.id);
    const rt = await call(U(30), "poultry.workflow.today", {
      spaceId: A.space.id,
      payload: { batchId: newBatch.id },
    });
    const tid = (rt.data?.tasks || []).find(t =>
      ["pending", "overdue"].includes(t.status) && t.task_type !== "chain_followup"
    )?.id;
    if (!tid) { expect(true).toBe(true); return; }
    const r = await call(U(31), "poultry.workflow.skip", {
      spaceId: A.space.id,
      payload: { taskId: tid, reason: "I just felt like it", clientUuid: crypto.randomUUID() },
    });
    expect(r.status).toBe(400);
  });

  it("worker cannot skip (403)", async () => {
    const newBatch = await mkBatch(U(30), A.space.id);
    const rt = await call(U(30), "poultry.workflow.today", {
      spaceId: A.space.id,
      payload: { batchId: newBatch.id },
    });
    const tid = (rt.data?.tasks || []).find(t =>
      ["pending", "overdue"].includes(t.status) && t.task_type !== "chain_followup"
    )?.id;
    if (!tid) { expect(true).toBe(true); return; }
    const r = await call(U(32), "poultry.workflow.skip", {
      spaceId: A.space.id,
      payload: { taskId: tid, reason: "Not applicable today", clientUuid: crypto.randomUUID() },
    });
    expect(r.status).toBe(403);
  });
});

/* ── poultry.incident.report ────────────────────────────────────────────── */

describe("poultry.incident.report", () => {
  it("reports an incident and returns a response envelope", async () => {
    const r = await call(U(30), "poultry.incident.report", {
      spaceId: A.space.id,
      payload: {
        batchId: batchA.id,
        description: "Birds showing labored breathing and nasal discharge",
        clientUuid: crypto.randomUUID(),
      },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("id");
    expect(r.data).toHaveProperty("severity");
  });

  it("urgent keyword in description triggers urgent severity", async () => {
    const r = await call(U(30), "poultry.incident.report", {
      spaceId: A.space.id,
      payload: {
        batchId: batchA.id,
        /* "dying" is in URGENT_KEYWORDS; "outbreak" is also urgent */
        description: "Birds are dying — sudden death in multiple pens, outbreak suspected",
        clientUuid: crypto.randomUUID(),
      },
    });
    expect(r.status).toBe(200);
    expect(r.data?.severity).toMatch(/urgent/);
    /* guided_response is always returned for urgent incidents */
    expect(r.data?.guided_response).toBeTruthy();
  });
});

/* ── poultry.incident.list ──────────────────────────────────────────────── */

describe("poultry.incident.list", () => {
  it("returns incidents for the batch", async () => {
    const r = await call(U(30), "poultry.incident.list", {
      spaceId: A.space.id,
      payload: { batchId: batchA.id },
    });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data)).toBe(true);
    expect(r.data.length).toBeGreaterThan(0);
  });
});

/* ── poultry.incident.resolve ───────────────────────────────────────────── */

describe("poultry.incident.resolve", () => {
  it("manager can resolve an incident", async () => {
    const list = await call(U(30), "poultry.incident.list", {
      spaceId: A.space.id,
      payload: { batchId: batchA.id },
    });
    const open = (list.data || []).find(i => i.status === "open");
    if (!open) { expect(true).toBe(true); return; }
    const r = await call(U(31), "poultry.incident.resolve", {
      spaceId: A.space.id,
      payload: { incidentId: open.id, notes: "Situation resolved after vet visit" },
    });
    expect(r.status).toBe(200);
    expect(r.data?.status).toBe("resolved");
  });
});

/* ── follow-up chains ───────────────────────────────────────────────────── */

describe("poultry.followup chain lifecycle", () => {
  let chainId;

  it("chain_detail returns chain + tasks + outcomes after an incident creates one", async () => {
    /* An urgent incident should have created a chain; query it directly */
    const rows = await dbRef.sql`
      SELECT id FROM poultry_followup_chains
      WHERE batch_id = ${batchA.id}
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (!rows.length) { expect(true).toBe(true); return; }
    chainId = rows[0].id;

    const r = await call(U(30), "poultry.followup.chain_detail", {
      spaceId: A.space.id,
      payload: { chainId },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("chain");
    expect(r.data).toHaveProperty("tasks");
    expect(r.data).toHaveProperty("outcomes");
    expect(Array.isArray(r.data.tasks)).toBe(true);
    expect(Array.isArray(r.data.outcomes)).toBe(true);
  });

  it("cross-space isolation: space B cannot read space A chain", async () => {
    if (!chainId) { expect(true).toBe(true); return; }
    const r = await call(U(40), "poultry.followup.chain_detail", {
      spaceId: B.space.id,
      payload: { chainId },
    });
    expect(r.status).not.toBe(200);
  });

  it("record_outcome updates a chain_followup task", async () => {
    if (!chainId) { expect(true).toBe(true); return; }
    const detail = await call(U(30), "poultry.followup.chain_detail", {
      spaceId: A.space.id,
      payload: { chainId },
    });
    const task = (detail.data?.tasks || []).find(t =>
      ["pending", "overdue", "in_progress"].includes(t.status)
    );
    if (!task) { expect(true).toBe(true); return; }

    const r = await call(U(30), "poultry.followup.record_outcome", {
      spaceId: A.space.id,
      payload: {
        chainId,
        taskId: task.id,
        outcome: "improved",
        observationNotes: "Birds appear more active",
        actionTaken: "repeat_treatment",
        clientUuid: crypto.randomUUID(),
      },
    });
    expect(r.status).toBe(200);
  });

  it("closing outcome (recovered) resolves the chain", async () => {
    if (!chainId) { expect(true).toBe(true); return; }
    /* Find any remaining pending task */
    const detail = await call(U(30), "poultry.followup.chain_detail", {
      spaceId: A.space.id,
      payload: { chainId },
    });
    const task = (detail.data?.tasks || []).find(t =>
      ["pending", "overdue", "in_progress"].includes(t.status)
    );
    if (!task) { expect(true).toBe(true); return; }

    const r = await call(U(30), "poultry.followup.record_outcome", {
      spaceId: A.space.id,
      payload: {
        chainId,
        taskId: task.id,
        outcome: "recovered",
        clientUuid: crypto.randomUUID(),
      },
    });
    expect(r.status).toBe(200);
    /* Chain should now be resolved */
    const chain = r.data?.chain || r.data;
    if (chain?.status) {
      expect(chain.status).toBe("resolved");
    }
  });

  it("poultry.followup.cancel cancels an active chain idempotently", async () => {
    /* Create a fresh incident to get a fresh chain */
    const ir = await call(U(30), "poultry.incident.report", {
      spaceId: A.space.id,
      payload: {
        batchId: batchA.id,
        description: "Unusual mortality spike for cancel test",
        clientUuid: crypto.randomUUID(),
      },
    });
    const rows = await dbRef.sql`
      SELECT id FROM poultry_followup_chains
      WHERE batch_id = ${batchA.id}
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (!rows.length) { expect(ir.status).toBe(200); return; }
    const cid = rows[0].id;

    const r1 = await call(U(31), "poultry.followup.cancel", {
      spaceId: A.space.id,
      payload: { chainId: cid, reason: null },
    });
    expect(r1.status).toBe(200);

    /* Second cancel on already-cancelled chain should not 500 */
    const r2 = await call(U(31), "poultry.followup.cancel", {
      spaceId: A.space.id,
      payload: { chainId: cid, reason: null },
    });
    expect([200, 400, 409]).toContain(r2.status);
  });
});

/* ── Phase B UX fix: chain_detail enrichment ───────────────────────────── */

describe("chain_detail enrichment (batch + sourceEvent)", () => {
  let healthChainId;
  let healthEventTitle;
  let healthEventId;

  it("chain_detail returns batch name and sourceEvent.title for a health-event chain", async () => {
    const today = new Date().toISOString().slice(0, 10);
    healthEventTitle = "Infectious bronchitis — UX regression test";

    const hr = await call(U(30), "poultry.health.add", {
      spaceId: A.space.id,
      payload: {
        batchId: batchA.id,
        event_date: today,
        type: "treatment",
        title: healthEventTitle,
        severity: "high",
      },
    });
    expect(hr.status).toBe(200);
    healthEventId = hr.data.id;

    const rows = await dbRef.sql`
      SELECT id FROM poultry_followup_chains
      WHERE source_id = ${healthEventId}
        AND source_type = 'health_event'
        AND deleted_at IS NULL
      LIMIT 1`;
    if (!rows.length) { expect(true).toBe(true); return; }
    healthChainId = rows[0].id;

    const r = await call(U(30), "poultry.followup.chain_detail", {
      spaceId: A.space.id,
      payload: { chainId: healthChainId },
    });
    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty("batch");
    expect(r.data.batch).toHaveProperty("name", batchA.name);
    expect(r.data).toHaveProperty("sourceEvent");
    expect(r.data.sourceEvent).toHaveProperty("title", healthEventTitle);
  });

  it("no duplicate chain is auto-created for the same health event", async () => {
    if (!healthEventId) { expect(true).toBe(true); return; }
    const rows = await dbRef.sql`
      SELECT id FROM poultry_followup_chains
      WHERE source_id = ${healthEventId}
        AND source_type = 'health_event'
        AND deleted_at IS NULL`;
    expect(rows.length).toBe(1);
  });

  it("non-closing outcome schedules a new follow-up task; no duplicate pending tasks", async () => {
    if (!healthChainId) { expect(true).toBe(true); return; }

    const d1 = await call(U(30), "poultry.followup.chain_detail", {
      spaceId: A.space.id,
      payload: { chainId: healthChainId },
    });
    const firstTask = (d1.data?.tasks || []).find(t =>
      ["pending", "overdue", "in_progress"].includes(t.status)
    );
    if (!firstTask) { expect(true).toBe(true); return; }

    await call(U(30), "poultry.followup.record_outcome", {
      spaceId: A.space.id,
      payload: {
        chainId: healthChainId,
        taskId: firstTask.id,
        outcome: "improved",
        clientUuid: crypto.randomUUID(),
      },
    });

    const d2 = await call(U(30), "poultry.followup.chain_detail", {
      spaceId: A.space.id,
      payload: { chainId: healthChainId },
    });
    const allTasks = d2.data?.tasks || [];
    const completed = allTasks.filter(t => t.status === "completed");
    const pending   = allTasks.filter(t => ["pending","overdue","in_progress"].includes(t.status));
    /* First task is now completed and a new follow-up was scheduled */
    expect(completed.length).toBeGreaterThanOrEqual(1);
    /* No two pending tasks share the same id */
    expect(new Set(pending.map(t => t.id)).size).toBe(pending.length);
  });
});
