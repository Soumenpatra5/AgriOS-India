# Tier-3: Load Testing & Staging

**Goal:** validate `/api/farm` performance under realistic concurrent load before real farmers arrive — without touching production Firebase, Supabase, or Vercel configuration.

Decisions (2026-09-05):
- **No new Vercel account.** Staging uses the existing account's Preview Deployments when Phase 3B starts.
- **Production data is never load-tested.** Even "read-only" API actions insert a `users` row for a new identity (`ensureUser`), so pointing any test at production Supabase is a write. Phase 3A therefore uses an in-process database; Phase 3B requires a separate staging Supabase project first.
- **Phase 3C (write-heavy/destructive load, staging Firebase, cleanup framework) is parked.**

---

## Phase 3A — Local, real API, read-only (implemented)

The real `/api/farm` handler — routing table, six-step authorization gate, `ensureUser`, action handlers, all unmodified production modules — served over HTTP by `load-harness/server.mjs`, with the same two seams the Tier-1 suite mocks:

| Seam | Production | Phase 3A |
|---|---|---|
| Database | Supabase via `DATABASE_URL` | in-process PGlite Postgres, real `supabase/migrations/*` applied |
| Auth | Firebase ID token verified against Google JWKS | `x-test-uid` header (Tier-1's `testVerifyToken`) |

The harness scrubs `DATABASE_URL` and Upstash variables at boot, and the db seam never reads them — this process cannot reach an external database at all. Production would reject the harness's requests outright (no Bearer token).

Seed data is created **through the API** at server start (two farms, 25 users, 80 tasks, 24 announcements, 160 chat messages, attendance, DMs) and lives only in process memory.

### Run it

```bash
npm run build          # optional; the API harness does not serve the SPA
npm run load-server    # boots PGlite, migrates, seeds (~20s), listens on :4174
npm run load-test      # k6 against http://127.0.0.1:4174
```

Profile overrides: `k6 run -e PEAK_VUS=60 -e HOLD=5m load-test.js`

### What k6 exercises (read-only, exact production contracts)

- `spaces.list`, `spaces.get`, `members.list`
- `tasks.list`, `tasks.get`, `tasks.summary`
- `announcements.list`, `attendance.list`, `activity.list`
- `chat.list`, `chat.search`, `chat.pinned`, `chat.unread`
- `dm.conversations`, `audit.list` (owner)

Four journeys: worker dashboard (40%), manager review (30%), chat reader (20%), owner audit (10%). Identities are role-correct, so permission checks run for real (a worker never calls `audit.list`).

### Honest limit

PGlite is single-connection: concurrent requests interleave on one connection. Phase 3A measures the handler + SQL code path under concurrent HTTP load, **not** parallel-writer lock contention or real Postgres pool behavior. That is exactly what Phase 3B adds.

---

## Phase 3B — Vercel Preview + staging Supabase (implemented; Design A approved 2026-09-05)

**Auth (Design A):** the `staging` branch carries ONE divergence commit that swaps
`api/_middleware/verifyAuth.js` for a version accepting
`x-load-test-auth: <uid>:<hex hmac-sha256(uid, LOAD_TEST_AUTH_SECRET)>` — guarded by
`VERCEL_ENV === "preview"`, the Preview-scoped secret, and a `TEST-USER-###` uid
pattern; everything else falls through to the byte-for-byte production JWKS check.
`main` never contains this path (CI's security guard enforces it). Never merge the
swap commit to main; rebase `staging` onto main before each test cycle.

**Vercel env target state:** Preview scope contains exactly TWO variables —
`DATABASE_URL` (staging Supabase transaction pooler, port 6543) and
`LOAD_TEST_AUTH_SECRET`. Every production credential (Firebase client + admin,
OTP/SMS, Anthropic, Razorpay, Upstash, OTP_JWT_SECRET) is scoped Production-only.
Firebase variables are simply ABSENT in Preview (client: `fbEnabled` false;
server: all Bearer tokens fail closed with 401).

**Runbook, in order (steps 1–3 are dashboard/manual):**
1. Create the staging Supabase project (free tier, ap-south-1), then locally:
   `DATABASE_URL=<staging pooler url> npm run migrate`
2. Vercel dashboard: rescope the variables to the target state above; add
   `LOAD_TEST_AUTH_SECRET` (Preview only, `openssl rand -hex 32`). Check
   Deployment Protection — prefer a "Protection Bypass for Automation" secret.
3. Push the `staging` branch → CI → `deploy-preview.yml` deploys a Preview of
   the existing project (no `--prod`). Note the preview URL.
4. Seed (idempotent; refuses production structurally):
   `SEED_ALLOW=staging SEED_TARGET=<preview url> LOAD_TEST_AUTH_SECRET=<secret> [VERCEL_BYPASS=<bypass>] node load-harness/seed-preview.mjs`
5. Load test (same 15 read-only actions as Phase 3A):
   `k6 run -e BASE=<preview url> -e LOAD_TEST_AUTH_SECRET=<secret> [-e VERCEL_BYPASS=<bypass>] load-test.js`

## Phase 3C — parked

Write-heavy load, staging Firebase project, Admin-token minting, cleanup framework. Only after 3A/3B results justify it.
