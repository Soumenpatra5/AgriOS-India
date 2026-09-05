/* Deterministic seed data for the Phase 3A load test. Everything is created
   THROUGH the real API (same as Tier-1's builders), so the rows k6 reads are
   shaped exactly as production requests would shape them.

   Identities are the Tier-1 TEST-USER-### model. The k6 script mirrors the
   constants below — change them together or the load test reads nothing. */

export const FARMS = {
  alpha: { name: "Load Farm Alpha", owner: 1, managers: [2, 3], supervisors: [4, 5], workers: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
  beta:  { name: "Load Farm Beta",  owner: 16, managers: [17], supervisors: [], workers: [18, 19, 20, 21, 22, 23, 24, 25] },
};

export const TASK_WORDS = ["Irrigate", "Weed", "Harvest", "Fence", "Vaccinate", "Feed", "Repair", "Inspect"];
export const CHAT_WORDS = ["paddy", "tractor", "monsoon", "fertilizer", "market", "mandi", "seeds", "canal"];

export async function seed(h) {
  const { U, call, buildFarm, userIdOf } = h;
  const out = {};

  for (const [k, f] of Object.entries(FARMS)) {
    const farm = await buildFarm(f.owner, f.name, {
      managers: f.managers, supervisors: f.supervisors, workers: f.workers,
    });
    const spaceId = farm.space.id;
    const owner = U(f.owner);
    const manager = U(f.managers[0]);

    /* Tasks: 40 per farm, round-robin assigned to the workers, some advanced
       through the status machine so tasks.list sees a realistic mix. */
    const taskIds = [];
    for (let i = 0; i < 40; i++) {
      const workerN = f.workers[i % f.workers.length];
      const r = await call(manager, "tasks.create", { spaceId, payload: {
        title: `${TASK_WORDS[i % TASK_WORDS.length]} plot ${i + 1}`,
        assigned_to: await userIdOf(U(workerN)),
      } });
      if (r.status !== 200) throw new Error(`seed tasks.create: ${r.status} ${r.error}`);
      taskIds.push(r.data.id);
      if (i % 3 === 0) await call(U(workerN), "tasks.setStatus", { spaceId, payload: { taskId: r.data.id, status: "accepted" } });
    }

    /* Announcements: 12 per farm. */
    for (let i = 0; i < 12; i++) {
      const r = await call(owner, "announcements.create", { spaceId, payload: {
        message: `Notice ${i + 1}: ${CHAT_WORDS[i % CHAT_WORDS.length]} update for ${f.name}`,
      } });
      if (r.status !== 200) throw new Error(`seed announcements.create: ${r.status} ${r.error}`);
    }

    /* Chat: 80 messages per farm from a rotating cast, so chat.list pages and
       chat.search has real text to match. */
    const cast = [f.owner, ...f.managers, ...f.workers.slice(0, 5)];
    for (let i = 0; i < 80; i++) {
      const r = await call(U(cast[i % cast.length]), "chat.send", { spaceId, payload: {
        body: `msg ${i + 1}: the ${CHAT_WORDS[i % CHAT_WORDS.length]} needs attention`,
      } });
      if (r.status !== 200) throw new Error(`seed chat.send: ${r.status} ${r.error}`);
    }

    /* Attendance: every worker marks present today. */
    for (const n of f.workers) {
      const r = await call(U(n), "attendance.mark", { spaceId, payload: { status: "present" } });
      if (r.status !== 200) throw new Error(`seed attendance.mark: ${r.status} ${r.error}`);
    }

    /* DMs: three conversations per farm with a short exchange each. */
    const pairs = [[f.managers[0], f.workers[0]], [f.owner, f.managers[0]], [f.workers[0], f.workers[1]]];
    for (const [a, b] of pairs) {
      const conv = await call(U(a), "dm.open", { spaceId, payload: { otherUserId: await userIdOf(U(b)) } });
      if (conv.status !== 200) throw new Error(`seed dm.open: ${conv.status} ${conv.error}`);
      await call(U(a), "dm.send", { spaceId, payload: { conversationId: conv.data.id, body: "seed: hello" } });
      await call(U(b), "dm.send", { spaceId, payload: { conversationId: conv.data.id, body: "seed: reply" } });
    }

    out[k] = { spaceId, taskIds };
  }

  return out;
}
