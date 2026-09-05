/* Tier-3 Phase 3B — one-time seeder for the STAGING preview.

   Drives the deployed preview's real API over HTTPS with the staging-only
   HMAC auth, creating the same deterministic dataset seed.mjs builds locally
   (two farms, TEST-USER-### roster, 40 tasks + 12 announcements + 80 chat
   messages + attendance + DMs per farm), then writes seed-preview.json for
   load-test.js's preview mode.

   Writes go to the staging Supabase database only — that is what it exists
   for. This script structurally cannot seed production:

     1. It refuses to start unless SEED_ALLOW=staging is set explicitly.
     2. It refuses known production hostnames outright.
     3. Its very first request is HMAC-authenticated — production has no HMAC
        auth path at all, so it answers 401 and the script aborts before any
        write is attempted. Only the staging-branch preview can pass the probe.

   Usage:
     SEED_ALLOW=staging \
     SEED_TARGET=https://<preview-url>.vercel.app \
     LOAD_TEST_AUTH_SECRET=<preview secret> \
     [VERCEL_BYPASS=<protection bypass secret>] \
     node load-harness/seed-preview.mjs

   Idempotent: a farm whose name already exists for its owner is reused
   (task ids re-read from tasks.list) instead of re-created. */

import { createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { FARMS, TASK_WORDS, CHAT_WORDS } from "./seed.mjs";

const TARGET = (process.env.SEED_TARGET || "").replace(/\/$/, "");
const SECRET = process.env.LOAD_TEST_AUTH_SECRET || "";
const BYPASS = process.env.VERCEL_BYPASS || "";

/* ── safety gates ─────────────────────────────────────────────────────── */

if (process.env.SEED_ALLOW !== "staging") {
  console.error("Refusing to run: set SEED_ALLOW=staging to confirm the target is the staging preview.");
  process.exit(1);
}
if (!TARGET || !SECRET) {
  console.error("Refusing to run: SEED_TARGET and LOAD_TEST_AUTH_SECRET are required.");
  process.exit(1);
}
for (const host of ["agri-os-india.vercel.app", "agrios-india.vercel.app"]) {
  if (TARGET.includes(`//${host}`)) {
    console.error(`Refusing to run: ${host} is a production host.`);
    process.exit(1);
  }
}
if (!/^https:\/\//.test(TARGET) && !/^http:\/\/(127\.0\.0\.1|localhost)/.test(TARGET)) {
  console.error("Refusing to run: SEED_TARGET must be https:// (or localhost for dry runs).");
  process.exit(1);
}

/* ── identities & auth (mirrors the Tier-1 harness conventions) ───────── */

const U = (n) => `TEST-USER-${String(n).padStart(3, "0")}`;
const hmacHeader = (uid) => `${uid}:${createHmac("sha256", SECRET).update(uid).digest("hex")}`;

function headers(uid) {
  const h = { "content-type": "application/json", "x-load-test-auth": hmacHeader(uid) };
  if (BYPASS) h["x-vercel-protection-bypass"] = BYPASS;
  return h;
}

async function farm(uid, action, { spaceId = null, payload = {} } = {}) {
  const res = await fetch(`${TARGET}/api/farm`, {
    method: "POST", headers: headers(uid),
    body: JSON.stringify({ action, spaceId, payload }),
  });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON = not our API */ }
  return { status: res.status, data: body?.data, error: body?.error?.message };
}

const must = (r, what) => {
  if (r.status !== 200) throw new Error(`${what}: ${r.status} ${r.error || ""}`);
  return r.data;
};

/* The caller's own row (internal uuid + AgriOS id), via /api/commerce/me —
   also how a user first materializes through the real ensureUser path. */
const meCache = new Map();
async function me(uid) {
  if (meCache.has(uid)) return meCache.get(uid);
  const res = await fetch(`${TARGET}/api/commerce/me`, { headers: headers(uid) });
  if (res.status !== 200) throw new Error(`commerce/me(${uid}): ${res.status}`);
  const { user } = await res.json();
  meCache.set(uid, user);
  return user;
}

/* ── the probe: staging previews pass, production cannot ──────────────── */

console.log(`probing ${TARGET} with HMAC auth...`);
const probe = await farm(U(1), "spaces.list");
if (probe.status === 401) {
  console.error("Target rejected HMAC auth (401). This is not the staging preview — aborting before any write.");
  process.exit(1);
}
must(probe, "probe spaces.list");
console.log("probe OK — target accepts the staging test auth.");

/* ── seed (same plan as seed.mjs, over HTTP) ──────────────────────────── */

async function join(ownerUid, spaceId, targetUid, role) {
  const target = await me(targetUid);
  const inv = must(await farm(ownerUid, "members.invite", { spaceId, payload: { agriosUserId: target.agrios_user_id, role } }), `invite ${targetUid}`);
  must(await farm(targetUid, "invitations.accept", { payload: { invitationId: inv.id } }), `accept ${targetUid}`);
}

const out = {};
for (const [key, f] of Object.entries(FARMS)) {
  const owner = U(f.owner);
  const manager = U(f.managers[0]);

  const mine = must(await farm(owner, "spaces.list"), "spaces.list");
  const existing = mine.find((s) => s.name === f.name);
  if (existing) {
    const tasks = must(await farm(manager, "tasks.list", { spaceId: existing.id, payload: { limit: 100 } }), "tasks.list");
    out[key] = { spaceId: existing.id, taskIds: tasks.map((t) => t.id) };
    console.log(`${key}: "${f.name}" already seeded (${tasks.length} tasks) — reusing`);
    continue;
  }

  console.log(`${key}: creating "${f.name}"...`);
  const space = must(await farm(owner, "spaces.create", { payload: { name: f.name } }), "spaces.create");
  const spaceId = space.id;
  for (const n of f.managers) await join(owner, spaceId, U(n), "manager");
  for (const n of f.supervisors) await join(owner, spaceId, U(n), "supervisor");
  for (const n of f.workers) await join(owner, spaceId, U(n), "worker");

  const taskIds = [];
  for (let i = 0; i < 40; i++) {
    const workerN = f.workers[i % f.workers.length];
    const t = must(await farm(manager, "tasks.create", { spaceId, payload: {
      title: `${TASK_WORDS[i % TASK_WORDS.length]} plot ${i + 1}`,
      assigned_to: (await me(U(workerN))).id,
    } }), "tasks.create");
    taskIds.push(t.id);
    if (i % 3 === 0) must(await farm(U(workerN), "tasks.setStatus", { spaceId, payload: { taskId: t.id, status: "accepted" } }), "tasks.setStatus");
  }

  for (let i = 0; i < 12; i++) {
    must(await farm(owner, "announcements.create", { spaceId, payload: {
      message: `Notice ${i + 1}: ${CHAT_WORDS[i % CHAT_WORDS.length]} update for ${f.name}`,
    } }), "announcements.create");
  }

  const cast = [f.owner, ...f.managers, ...f.workers.slice(0, 5)];
  for (let i = 0; i < 80; i++) {
    must(await farm(U(cast[i % cast.length]), "chat.send", { spaceId, payload: {
      body: `msg ${i + 1}: the ${CHAT_WORDS[i % CHAT_WORDS.length]} needs attention`,
    } }), "chat.send");
  }

  for (const n of f.workers) {
    must(await farm(U(n), "attendance.mark", { spaceId, payload: { status: "present" } }), "attendance.mark");
  }

  const pairs = [[f.managers[0], f.workers[0]], [f.owner, f.managers[0]], [f.workers[0], f.workers[1]]];
  for (const [a, b] of pairs) {
    const conv = must(await farm(U(a), "dm.open", { spaceId, payload: { otherUserId: (await me(U(b))).id } }), "dm.open");
    must(await farm(U(a), "dm.send", { spaceId, payload: { conversationId: conv.id, body: "seed: hello" } }), "dm.send");
    must(await farm(U(b), "dm.send", { spaceId, payload: { conversationId: conv.id, body: "seed: reply" } }), "dm.send");
  }

  out[key] = { spaceId, taskIds };
  console.log(`${key}: seeded (space ${spaceId}, ${taskIds.length} tasks)`);
}

await writeFile("seed-preview.json", JSON.stringify(out, null, 2));
console.log("wrote seed-preview.json — load-test.js preview mode reads it via -e SEED_FILE");
