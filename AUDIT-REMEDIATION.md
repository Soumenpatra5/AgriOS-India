# AgriOS India — Audit Remediation Summary

Record of the full-application QA/architecture audit and the remediation that
followed. All work below is merged to `main` and green in CI unless noted.

**Bottom line:** every **Critical** and **High** finding is resolved; every
**Medium** except **M7 (RBAC)** is done; the commerce backend the audit called
for (H6) is fully implemented (B0–B4) with a client and integration tests. The
suite grew from **429 → 523 tests**; build, lint, bundle budget, and CI are all
green.

---

## 1. Starting point (the audit)

A read-only, 36-phase QA + architecture audit found a **well-engineered
foundation** (429 passing tests, clean secret hygiene, correct calculators,
honest degradation) with **architectural, data-integrity, and security gaps** —
plus a large "marketplace-class" surface (marketplace/logistics/services/
payments) that was **local-device-only with no backend**.

## 2. Health, before → after

| | Before | After |
|---|---|---|
| Tests | 429 | **523** (+ PGlite DB integration) |
| Lint gate | none | **ESLint in CI (0 errors)** |
| Initial JS bundle | 453 KB (**over budget, CI red**) | **431 KB** (green) |
| Data deletes | hard delete, no cascade | **soft-delete + cascade + tombstones** |
| Sync conflicts | blind overwrite | **last-write-wins reconciliation** |
| Commerce | local-device simulations | **server-authoritative backend (B0–B4)** |

## 3. Critical & High — all resolved

| ID | Finding | Fix |
|---|---|---|
| **C1** | Employee-document access uncodified (no Storage rules) | Version-controlled `storage.rules` (owner-only) + `firebase.json`; uploads scoped to `users/{uid}/…` |
| **H1** | Hard delete + no cascade → orphans | Soft-delete (`deletedAt` + restore/purge) in the shared `erpDb` repo; farm-delete cascades to children |
| **H2** | Deletes resurrect across devices | Deletes propagate as **tombstones** to the cloud |
| **H3** | Last-write-wins clobbers newer edits | Pull **reconciles by newest timestamp** (`syncReconcile.js`) |
| **H4** | Base64 docs synced into Firestore | `stripForSync` keeps blobs out of the cloud (1 MB-limit + privacy) |
| **H5** | Browser/hardware Back exits the PWA | History-API integration (`backNav.js`) — Back pops a screen / returns Home |
| **H6** | Marketplace/logistics/etc. backend-less | Built the **commerce backend** — see §5 |
| **H7** | Auth drop left a null-user shell | On sign-out/uid-mismatch, reset to auth and clear the stack |

## 4. Medium & Low

**Done:** M1 (Login is now theme-aware) · M2 (inventory movement log records the
*applied* qty) · M5 (split `toasts`/`online` into their own contexts — a toast no
longer re-renders ~120 consumers) · M6 (lazy-loaded the alerts aggregator off the
startup path) · M8 (rewrote `ARCHITECTURE.md`, de-drifted the README) · M9
(ESLint gate) · L2 (native `alert()` → toast) · L3 (`erpDb.uid` → `crypto.randomUUID`)
· L4 (splash 1900→1200 ms).

**Open:** **M7 (RBAC)** — the app assumes one user per device, so team/payroll/
document data isn't role-gated. This is a **product decision** (define roles +
permissions), not a fix. **L1** (Vite `esbuild→oxc` deprecation warnings) — an
upstream toolchain artifact, cosmetic; not worth a dependency bump. **~121
`no-unused-vars` warnings** remain as a non-blocking burndown list.

## 5. Commerce backend (H6) — built

Per **COMMERCE-BACKEND-SPEC.md**: a Supabase-Postgres backend behind the existing
Vercel `api/*` layer, authenticated by the Firebase tokens already verified
server-side, with Razorpay payments.

- **B0** foundation (schema, migrations, authed API) · **B1** listings ·
  **B2** orders + Razorpay (atomic stock guard, signed webhook) · **B3** lifecycle
  + reviews · **B4** hardening (refunds, reservation cron, shared rate limit,
  settlement math).
- **Client wired** (buyer + seller + reviews) behind `VITE_COMMERCE_API`, with a
  local fallback.
- **Integration tests on real Postgres (PGlite)** prove the oversell guard,
  webhook idempotency, transitions/refunds, and review uniqueness.

## 6. What's still required (not code — provisioning & a decision)

1. **Provision to activate commerce:** set `DATABASE_URL` (Supabase) + run
   `npm run migrate`; add Razorpay keys + register the webhook; set
   `VITE_COMMERCE_API=1` and the B4 env (`CRON_SECRET`, `PLATFORM_COMMISSION_BPS`,
   Upstash). It degrades gracefully (local marketplace) until then.
2. **True end-to-end** (deployed handlers + live DB + Razorpay + a login) is
   **unverified** — the auth gate and dormant backend can't be exercised locally.
3. **M7 (RBAC)** — decide the role model if multi-user access control is wanted.

## 7. Verification

Build ✓ · `npm run lint` ✓ (0 errors) · **523 tests** ✓ · bundle 431 KB < 450 ✓ ·
GitHub Actions CI green. Each remediation landed on its own branch, verified, and
merged to `main`.
