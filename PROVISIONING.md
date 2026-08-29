# Commerce Backend — Provisioning Runbook

The commerce backend (B0–B4) is code-complete and tested (see
`COMMERCE-BACKEND-SPEC.md`) but **dormant** until the cloud services below are
provisioned. These steps require *your* accounts — a Supabase project, a Razorpay
account (with KYC), and access to the Vercel project — so they can't be done for
you; each is a one-time setup. After it, the client (`VITE_COMMERCE_API=1`) and
the `/api/commerce/*` handlers go live.

Until provisioned, the app degrades gracefully to the local marketplace.

## 1. Database — Supabase (Postgres)

1. Create a project at supabase.com.
2. **Settings → Database → Connection string → Transaction pooler** (port 6543).
   Copy it; append `?sslmode=require` if not present.
3. Set `DATABASE_URL` to that string:
   - locally in `.env`,
   - in the Vercel project (Settings → Environment Variables, **not** `VITE_`),
   - as a GitHub Actions secret `DATABASE_URL` (for the DB Migrate workflow).
4. Apply the schema:
   ```bash
   npm run migrate      # applies supabase/migrations/*.sql, once
   npm run check:db     # verifies the core tables exist
   ```
   (Pushing migration changes to `main` also runs the DB Migrate workflow.)

## 2. Payments — Razorpay

1. Create a Razorpay account and complete KYC.
2. Get **Key ID** + **Key Secret** (start in Test mode).
3. Create a **webhook** pointing at `https://<your-domain>/api/commerce/payments/webhook`,
   subscribed to `payment.captured` (and `order.paid`); set a webhook secret.
4. Set in Vercel (server-only unless noted):
   ```
   RAZORPAY_KEY_ID           RAZORPAY_KEY_SECRET        RAZORPAY_WEBHOOK_SECRET
   VITE_RAZORPAY_KEY_ID      # publishable — same as RAZORPAY_KEY_ID, for Checkout
   ```
5. For seller payouts (real marketplace settlement), enable **Razorpay Route** and
   set `PLATFORM_COMMISSION_BPS` (e.g. `250` = 2.5%). Sellers need linked accounts
   + KYC — this is the last piece and can follow the MVP.

## 3. Turn the client on + B4 extras

```
VITE_COMMERCE_API=1          # client sources the marketplace from /api/commerce/*
CRON_SECRET=<random>         # secures the reservation-timeout cron (vercel.json)
ORDER_RESERVATION_TTL_MIN=30
UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   # optional: fleet-wide rate limit
```

## 4. Verify end to end

- **Locally / CI (no cloud):** `npm test` runs the handler **end-to-end suite**
  (`api/_lib/__tests__/commerce.e2e.test.js`) — the real handlers against an
  embedded Postgres, plus the PGlite integration tests. These already prove the
  order → payment webhook → fulfilment → refund flow and the oversell guard.
- **On the deployed preview (real cloud):** with a logged-in user, list a product
  as a seller, order it as a buyer, pay with a Razorpay **test card**, and confirm
  the webhook flips the order to `confirmed`. That's the one check that needs live
  Supabase + Razorpay + a real login.

## Quick reference — env vars

| Var | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Vercel + GH secret + `.env` | Supabase Postgres (pooler) |
| `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` | Vercel (server) | payments + webhook verify |
| `VITE_RAZORPAY_KEY_ID` | Vercel (public) | Razorpay Checkout on the client |
| `VITE_COMMERCE_API=1` | Vercel (public) | switch client to the backend |
| `CRON_SECRET`, `ORDER_RESERVATION_TTL_MIN` | Vercel (server) | reservation cron |
| `PLATFORM_COMMISSION_BPS` | Vercel (server) | Route settlement split |
| `UPSTASH_REDIS_REST_URL/TOKEN` | Vercel (server) | shared rate limiting |

## Not covered here — Firebase

This runbook covers the commerce backend only. Firebase — Auth, Firestore and
Storage — is a separate dependency, and the project the app now points at
(agrios-india-app) has none of the three enabled yet. See
[FIREBASE-PROVISIONING.md](FIREBASE-PROVISIONING.md).
