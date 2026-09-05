/* Tier-3 Phase 3A — k6 load test over the REAL /api/farm contracts.

   Target: load-harness/server.mjs (the production farm.js handler over HTTP,
   PGlite database, x-test-uid auth). Start it first:

     node load-harness/server.mjs
     k6 run load-test.js

   READ-ONLY by design: every action below is a list/get/search/summary. The
   only writes in the whole exercise happen at server seed time, into the
   in-process database, which vanishes when the server exits. Nothing here can
   reach production — BASE defaults to localhost and auth is the harness's
   x-test-uid header, which production would reject as having no Bearer token.

   Identities and data mirror load-harness/seed.mjs (TEST-USER-###; two farms).

   Profile (override with -e):
     PEAK_VUS=30  RAMP=20s  HOLD=3m  DOWN=10s
     BASE=http://127.0.0.1:4174 */

/* global __ENV -- k6 runtime global (open() is covered by the browser globals) */
import http from "k6/http";
import crypto from "k6/crypto";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE = __ENV.BASE || "http://127.0.0.1:4174";

/* ── Phase 3B preview mode ────────────────────────────────────────────────
   Local (default): auth is the harness's x-test-uid header and seed ids come
   from the harness's /seed-info endpoint.
   Preview (LOAD_TEST_AUTH_SECRET set): auth is the staging-branch HMAC header
   and seed ids come from the JSON file seed-preview.mjs wrote (SEED_FILE),
   because the Vercel deployment has no /seed-info — its SPA rewrite would
   answer that path with index.html. Same 15 read-only actions either way. */
const PREVIEW = !!__ENV.LOAD_TEST_AUTH_SECRET;
const SEED = PREVIEW ? JSON.parse(open(__ENV.SEED_FILE || "./seed-preview.json")) : null;

/* Never aim this at production. Production would 401 every request anyway
   (no HMAC path exists there), but refuse outright rather than hammer it. */
const FORBIDDEN_HOSTS = ["agri-os-india.vercel.app", "agrios-india.vercel.app"];
for (const h of FORBIDDEN_HOSTS) {
  if (BASE.includes(`//${h}`)) throw new Error(`BASE points at a production host (${h}) — refusing to run`);
}

function authHeaders(uid) {
  const headers = { "content-type": "application/json" };
  if (PREVIEW) {
    headers["x-load-test-auth"] = `${uid}:${crypto.hmac("sha256", __ENV.LOAD_TEST_AUTH_SECRET, uid, "hex")}`;
    if (__ENV.VERCEL_BYPASS) headers["x-vercel-protection-bypass"] = __ENV.VERCEL_BYPASS;
  } else {
    headers["x-test-uid"] = uid;
  }
  return headers;
}
const PEAK = Number(__ENV.PEAK_VUS || 30);
const RAMP = __ENV.RAMP || "20s";
const HOLD = __ENV.HOLD || "3m";
const DOWN = __ENV.DOWN || "10s";

const status2xx = new Counter("status_2xx");
const status4xx = new Counter("status_4xx");
const status5xx = new Counter("status_5xx");

/* Identity pools — must match load-harness/seed.mjs FARMS. */
const ALPHA = { owner: 1, managers: [2, 3], supervisors: [4, 5], workers: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15] };
const BETA  = { owner: 16, managers: [17], supervisors: [], workers: [18, 19, 20, 21, 22, 23, 24, 25] };
const U = (n) => `TEST-USER-${String(n).padStart(3, "0")}`;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const CHAT_WORDS = ["paddy", "tractor", "monsoon", "fertilizer", "market", "mandi", "seeds", "canal"];

function ramp(fraction) {
  return {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: RAMP, target: Math.max(1, Math.round(PEAK * fraction)) },
      { duration: HOLD, target: Math.max(1, Math.round(PEAK * fraction)) },
      { duration: DOWN, target: 0 },
    ],
    gracefulRampDown: "5s",
  };
}

export const options = {
  scenarios: {
    worker_dashboard: { ...ramp(0.4), exec: "workerDashboard" },
    manager_review:   { ...ramp(0.3), exec: "managerReview" },
    chat_reader:      { ...ramp(0.2), exec: "chatReader" },
    owner_audit:      { ...ramp(0.1), exec: "ownerAudit" },
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500", "p(99)<3000"],
    /* Per-action visibility in the summary. */
    "http_req_duration{action:spaces.list}": ["p(95)<1500"],
    "http_req_duration{action:spaces.get}": ["p(95)<1500"],
    "http_req_duration{action:members.list}": ["p(95)<1500"],
    "http_req_duration{action:tasks.list}": ["p(95)<1500"],
    "http_req_duration{action:tasks.get}": ["p(95)<1500"],
    "http_req_duration{action:tasks.summary}": ["p(95)<1500"],
    "http_req_duration{action:announcements.list}": ["p(95)<1500"],
    "http_req_duration{action:attendance.list}": ["p(95)<1500"],
    "http_req_duration{action:activity.list}": ["p(95)<1500"],
    "http_req_duration{action:chat.list}": ["p(95)<1500"],
    "http_req_duration{action:chat.search}": ["p(95)<1500"],
    "http_req_duration{action:chat.pinned}": ["p(95)<1500"],
    "http_req_duration{action:chat.unread}": ["p(95)<1500"],
    "http_req_duration{action:dm.conversations}": ["p(95)<1500"],
    "http_req_duration{action:audit.list}": ["p(95)<1500"],
  },
};

/* Seed ids: preview mode reads the file seed-preview.mjs wrote; local mode
   asks the harness. Either way nothing is hardcoded twice. */
export function setup() {
  if (PREVIEW) {
    if (!SEED?.alpha?.spaceId || !SEED?.beta?.spaceId) {
      throw new Error("seed file is missing farm ids — run load-harness/seed-preview.mjs first");
    }
    return { alpha: SEED.alpha, beta: SEED.beta };
  }
  const res = http.get(`${BASE}/seed-info`);
  if (res.status !== 200) throw new Error(`seed-info unavailable: ${res.status} — is load-harness/server.mjs running?`);
  const { seeded } = JSON.parse(res.body);
  return { alpha: seeded.alpha, beta: seeded.beta };
}

function api(uid, action, spaceId, payload) {
  const res = http.post(
    `${BASE}/api/farm`,
    JSON.stringify({ action, spaceId, payload: payload || {} }),
    { headers: authHeaders(uid), tags: { action } },
  );
  if (res.status >= 500) status5xx.add(1);
  else if (res.status >= 400) status4xx.add(1);
  else status2xx.add(1);
  check(res, {
    [`${action} 200`]: (r) => r.status === 200,
    [`${action} has data`]: (r) => {
      try { return JSON.parse(r.body).data !== undefined; } catch { return false; }
    },
  });
  return res;
}

/* Farmer checking their day: the app's Home + tasks + chat read path. */
export function workerDashboard(data) {
  const [farm, roster] = Math.random() < 0.6 ? [data.alpha, ALPHA] : [data.beta, BETA];
  const uid = U(pick(roster.workers));
  api(uid, "spaces.list", null);
  sleep(0.3);
  api(uid, "spaces.get", farm.spaceId);
  api(uid, "tasks.list", farm.spaceId, { limit: 50 });
  sleep(0.4);
  api(uid, "announcements.list", farm.spaceId, { limit: 20 });
  api(uid, "chat.list", farm.spaceId, { limit: 50 });
  api(uid, "chat.unread", farm.spaceId);
  sleep(0.8);
}

/* Manager reviewing the roster, tasks and attendance. */
export function managerReview(data) {
  const [farm, roster] = Math.random() < 0.6 ? [data.alpha, ALPHA] : [data.beta, BETA];
  const uid = U(pick(roster.managers));
  api(uid, "spaces.list", null);
  api(uid, "members.list", farm.spaceId);
  sleep(0.3);
  api(uid, "tasks.list", farm.spaceId, { limit: 100 });
  api(uid, "tasks.get", farm.spaceId, { taskId: pick(farm.taskIds) });
  sleep(0.3);
  api(uid, "attendance.list", farm.spaceId, { limit: 50 });
  api(uid, "activity.list", farm.spaceId, { limit: 50 });
  sleep(0.7);
}

/* Member catching up on conversation: group chat, search, pins, DMs. */
export function chatReader(data) {
  const [farm, roster] = Math.random() < 0.6 ? [data.alpha, ALPHA] : [data.beta, BETA];
  const members = roster.workers.concat(roster.supervisors, roster.managers);
  const uid = U(pick(members));
  api(uid, "chat.list", farm.spaceId, { limit: 50 });
  sleep(0.3);
  api(uid, "chat.search", farm.spaceId, { query: pick(CHAT_WORDS), limit: 30 });
  api(uid, "chat.pinned", farm.spaceId);
  sleep(0.3);
  api(uid, "dm.conversations", farm.spaceId);
  sleep(0.6);
}

/* Owner looking at the audit trail and overall state. */
export function ownerAudit(data) {
  const [farm, roster] = Math.random() < 0.6 ? [data.alpha, ALPHA] : [data.beta, BETA];
  const uid = U(roster.owner);
  api(uid, "spaces.get", farm.spaceId);
  api(uid, "audit.list", farm.spaceId, { limit: 50 });
  sleep(0.4);
  api(uid, "members.list", farm.spaceId);
  api(uid, "tasks.summary", farm.spaceId);
  sleep(0.8);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
    "load-test-results.json": JSON.stringify(data, null, 2),
  };
}

/* Minimal text summary (k6's default one is suppressed by handleSummary). */
function textSummary(data) {
  const m = data.metrics;
  const d = m.http_req_duration?.values || {};
  const lines = [
    "",
    "== Tier-3 Phase 3A summary =============================",
    `requests total : ${m.http_reqs?.values?.count ?? 0}`,
    `2xx / 4xx / 5xx: ${m.status_2xx?.values?.count ?? 0} / ${m.status_4xx?.values?.count ?? 0} / ${m.status_5xx?.values?.count ?? 0}`,
    `failed rate    : ${((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(3)}%`,
    `latency avg    : ${(d.avg ?? 0).toFixed(1)}ms`,
    `latency p50    : ${(d.med ?? 0).toFixed(1)}ms`,
    `latency p90    : ${(d["p(90)"] ?? 0).toFixed(1)}ms`,
    `latency p95    : ${(d["p(95)"] ?? 0).toFixed(1)}ms`,
    `latency p99    : ${(d["p(99)"] ?? 0).toFixed(1)}ms`,
    `latency max    : ${(d.max ?? 0).toFixed(1)}ms`,
    "========================================================",
    "",
  ];
  return lines.join("\n");
}
