/* Tier-1 multi-user harness: drives the REAL /api/farm handler in-process.

   Unlike the unit suites (which call api/_lib functions directly), every
   request here goes through farm.js's actual routing table, the six-step
   authorization gate, ensureUser, and the action handlers — the same path a
   production request takes, minus HTTP transport and real JWT crypto. Each
   test file supplies those two seams itself via vi.mock:

     vi.mock of api/_lib/db.js            -> getSql() returns this harness's
                                             PGlite-backed client (dbRef.sql)
     vi.mock of api/_middleware/verifyAuth -> verifyToken() decodes the
                                             x-test-* headers into token claims
     vi.mock of api/_lib/blobStore.js      -> deleteAttachment inert (no network)

   Identity model: TEST-USER-001..NNN. A user materializes in Postgres the
   first time their uid makes an authenticated call — through the real
   ensureUser path, exactly like production. Names/phones are deterministic
   so assertions can predict them.

   Honest limits, stated once here: PGlite is a single-connection Postgres,
   so "concurrent" scenarios (Promise.all bursts) exercise interleaved
   request handling and data-model correctness, NOT parallel-writer lock
   contention. True concurrency semantics need Tier 3 on a real Postgres. */

import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

/* ── deterministic identities ─────────────────────────────────────────── */

export const U = (n) => `TEST-USER-${String(n).padStart(3, "0")}`;
export const nameFor = (uid) => `Tester ${uid.slice(-3)}`;
export const phoneFor = (uid) => `9${uid.slice(-3).padStart(9, "0")}`;

/* ── database ─────────────────────────────────────────────────────────── */

/* Shared with the unit suites' makeSql: a tagged-template shim over PGlite
   that binds $n parameters, understands sql.json(), and provides begin(). */
export function makeSql(pg) {
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

/* The db.js mock closes over this ref, so one fresh database per test file
   is a single assignment. */
export const dbRef = { pg: null, sql: null };

const MIGRATIONS = [
  "0001_commerce_foundation.sql", "0002_farm_space.sql", "0003_farm_tasks.sql",
  "0004_farm_operations.sql", "0005_farm_chat.sql", "0006_otp_challenges.sql",
  "0007_agrios_user_id.sql", "0008_invitation_by_user_id.sql",
  "0009_farm_chat_reply_react_pin.sql", "0010_farm_chat_mentions_search.sql",
  "0011_farm_dm.sql", "0012_performance_indexes.sql",
];

export async function freshDb() {
  const pg = new PGlite();
  for (const m of MIGRATIONS) {
    const url = new URL(`../../../../supabase/migrations/${m}`, import.meta.url);
    await pg.exec(await readFile(url, "utf8"));
  }
  dbRef.pg = pg;
  dbRef.sql = makeSql(pg);
  return dbRef;
}

/* ── the request runner ───────────────────────────────────────────────── */

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

/* One in-process request through the real handler. `uid: null` = an
   unauthenticated request. Returns { status, data, error }. */
export async function call(uid, action, { spaceId = null, payload = {} } = {}, identity = {}) {
  const { default: handler } = await import("../../../farm.js");
  const headers = uid ? {
    "x-test-uid": uid,
    "x-test-name": identity.name !== undefined ? identity.name : nameFor(uid),
    "x-test-phone": identity.phone !== undefined ? identity.phone : phoneFor(uid),
  } : {};
  const res = makeRes();
  await handler({ method: "POST", headers, body: { action, spaceId, payload } }, res);
  return { status: res.statusCode, data: res.body?.data, error: res.body?.error?.message };
}

/* The verifyToken mock body, exported so every test file's vi.mock factory
   is one line and cannot drift from the header contract above. */
export async function testVerifyToken(req) {
  const uid = req?.headers?.["x-test-uid"];
  if (!uid) return null;
  return {
    sub: uid,
    name: req.headers["x-test-name"] || null,
    phone_number: req.headers["x-test-phone"] || null,
  };
}

/* ── data builders (all THROUGH the API, so state is production-real) ──── */

export async function agriosIdOf(uid) {
  const rows = await dbRef.sql`select agrios_user_id from users where firebase_uid = ${uid}`;
  return rows[0]?.agrios_user_id || null;
}

/* Materialize a user by making their first authenticated call. */
export async function materialize(uid) {
  const r = await call(uid, "spaces.list");
  if (r.status !== 200) throw new Error(`materialize(${uid}) failed: ${r.status} ${r.error}`);
  return r;
}

export async function createFarm(ownerUid, name) {
  const r = await call(ownerUid, "spaces.create", { payload: { name } });
  if (r.status !== 200) throw new Error(`createFarm failed: ${r.status} ${r.error}`);
  return r.data; // the space row (id, name, ...)
}

export async function invite(byUid, spaceId, targetUid, role) {
  await materialize(targetUid); // target must exist to be looked up by AgriOS id
  const agriosUserId = await agriosIdOf(targetUid);
  return call(byUid, "members.invite", { spaceId, payload: { agriosUserId, role } });
}

export async function join(byUid, spaceId, targetUid, role) {
  const inv = await invite(byUid, spaceId, targetUid, role);
  if (inv.status !== 200) throw new Error(`invite failed: ${inv.status} ${inv.error}`);
  const acc = await call(targetUid, "invitations.accept", { payload: { invitationId: inv.data.id } });
  if (acc.status !== 200) throw new Error(`accept failed: ${acc.status} ${acc.error}`);
  return acc.data; // the membership
}

/* Build a farm with a full roster in one line. Returns ids for assertions. */
export async function buildFarm(ownerN, name, { managers = [], supervisors = [], workers = [] } = {}) {
  const owner = U(ownerN);
  await materialize(owner);
  const space = await createFarm(owner, name);
  for (const n of managers) await join(owner, space.id, U(n), "manager");
  for (const n of supervisors) await join(owner, space.id, U(n), "supervisor");
  for (const n of workers) await join(owner, space.id, U(n), "worker");
  return { space, owner, managers: managers.map(U), supervisors: supervisors.map(U), workers: workers.map(U) };
}

export async function userIdOf(uid) {
  const rows = await dbRef.sql`select id from users where firebase_uid = ${uid}`;
  return rows[0]?.id || null;
}
