# AgriOS India — Architecture

An offline-first, multilingual farm-management PWA for Indian farmers. Started as
a UI shell; it now spans a full local-first farm ERP, livestock/crop/feed tools,
AI assistants, vision diagnostics, and a server-authoritative commerce backend.

Stack: **React 18 + Vite**, plain JS + JSX, `lucide-react` icons. No CSS
framework — a token-driven design system using CSS custom properties (full
light/dark). Data is **local-first** (localStorage + IndexedDB) with a lazy
Firebase/Firestore sync layer. Serverless functions in `api/` (Vercel) hold all
secret keys. Tests: **Vitest** (+ `fake-indexeddb`, + PGlite for DB integration).

## Folder structure

```
api/                    Vercel serverless functions (secrets never reach the client)
├── ai/chat.js          LLM gateway (multi-provider failover)
├── auth/               phone OTP (send/verify)
├── prices.js weather.js  live mandi prices (Agmarknet) + weather
├── commerce/           commerce backend (listings, orders, payments/webhook, reviews, cron)
└── _lib/ _middleware/  Postgres client, auth (Firebase JWKS), rate limit, shared helpers

src/
├── main.jsx App.jsx        entry + composition root (providers → router)
├── theme/                  design tokens + ThemeProvider (light/dark/system)
├── store/AppStore.jsx      language, auth flow, navigation stack, toasts, online
├── navigation/             ScreenRouter (stage/tab/pushed screen), BottomNav, backNav
├── hooks/  customize/      selector hooks; user preferences + appearance
├── components/             shared UI (primitives, inputs, feedback, overlays, layout,
│                           ErrorBoundary, charts, camera, per-domain component folders)
├── pages/                  ~40 screens + domain folders: erp/ livestock/ feed/ cropPlanner/
│                           business/ marketplace/ svcMarketplace/ logistics/ aiCommerce/ mlops/
├── services/              domain logic, one folder per area:
│   ├── erp/erpDb.js        shared IndexedDB repository (soft-delete, timestamps) — most ERP
│   │                       services build on repo(store)
│   ├── farm land inventory assets tasks crm ledger employees production   (farm ERP)
│   ├── livestock feed cropPlanner diagnostics calendar schemes weather market
│   ├── commerce/           client wiring to the api/commerce backend (flag-gated)
│   ├── firebase/           lazy auth + Firestore sync (syncRepo, pullFromCloud, reconcile)
│   ├── alerts serviceHub notifications reports insights nearby location maps iot pwa
│   └── marketplace svcMarketplace logistics aiCommerce mlops   (local-first modules)
├── ai/                     AI engine (see below)
├── admin/                  separate PIN-gated admin console (admin.html entry)
├── constants/ i18n/ utils/ content, string dictionaries (en/hi/bn), storage/format helpers
```

## Design system

- **Tokens → CSS variables.** `ThemeProvider` renders `--ag-*` variables for the
  active theme onto `:root[data-theme]`; components read them via the `T` helper
  (`T.primary`, `T.surface`, …), so dark mode is instant and global. Theme =
  light / dark / system.
- **Motion.** Pure CSS keyframes; respects `prefers-reduced-motion`.
- **Accessibility.** Focus-visible rings, `aria-label`s, dialog roles, large tap
  targets, screen-reader text.
- **Bundle.** Icons are a curated registry; a CI budget (`npm run check:bundle`)
  keeps initial JS under 450 KB and Firebase off the eager path.

## State & navigation

`AppStore` holds `language`, `user` (UI auth mirror), the flow `stage`
(splash → language → onboarding → auth → app), the active `tab`, and a `stack`
of pushed detail screens. Navigation is a **custom stack router**
(`push({kind, props})` / `pop()` / `switchTab()`); `ScreenRouter` maps state to
lazily-loaded screens. The **History API is integrated** (`navigation/backNav.js`)
so the browser/hardware Back button pops a screen or returns to Home instead of
leaving the PWA. Volatile UI state (`toasts`, `online`) lives in separate
contexts so it doesn't re-render every `useApp()` consumer.

## Data layer

- **Local-first.** Reads never touch the network. Most farm data lives in one
  IndexedDB (`agrios-erp`) behind a shared, tested repository (`erpDb.repo`):
  timestamps, **soft-delete** (`deletedAt` + `restore`/`purge`), and reads that
  hide soft-deleted rows. Livestock/marketplace/etc. have parallel DBs.
- **Sync.** `wrapWithSync` writes local, then pushes to Firestore under
  `users/{uid}/…` (lazy SDK, off the eager path), enqueuing on failure.
  Deletes propagate as **tombstones**; the pull **reconciles by last-write-wins**
  (`syncReconcile.js`) so nothing resurrects or clobbers a newer local edit.
- **Secrets.** Firestore rules restrict data to its owner; `storage.rules`
  scope files to `users/{uid}`. API keys live only in `api/` (Vercel env).

## AI Engine

```
src/ai/
├── index.js               public surface: useAI() hook + engine exports (UI imports ONLY this)
├── gateway/aiGateway.js   validate → rate-limit → route → context → prompt → stream → tools → persist
├── router/  agents/       intent routing; baseAgent contract + registry + specialist definitions
├── prompts/ memory/       versioned prompts + safety preamble; conversation store, profile memory
├── context/ tools/        season/farm context; tool registry (calculator live; others honest "n/a")
├── services/ voice/ vision/  llmClient provider abstraction; Web Speech STT/TTS; image pipeline
├── middleware/ analytics/ input caps + Aadhaar/OTP detection; local turn metrics (never content)
api/ai/chat.js             serverless gateway holding the LLM keys (multi-provider failover)
```

## Commerce backend (server-authoritative)

The inherently multi-party modules (marketplace, service-marketplace, logistics,
payments) get a **Supabase Postgres backend behind `api/commerce/*`**,
authenticated by the Firebase tokens `api/_middleware/verifyAuth.js` already
verifies, with **Razorpay** payments. Phases B0–B4 (foundation → listings →
orders+payments → lifecycle+reviews → hardening) are implemented and covered by
unit + PGlite integration tests; the client is wired behind `VITE_COMMERCE_API`.
See **COMMERCE-BACKEND-SPEC.md** for the full design.

## What's still pending / dormant

- **Commerce is code-complete but dormant** until Supabase + Razorpay are
  provisioned (env vars) and `VITE_COMMERCE_API=1`; it degrades gracefully
  (local marketplace) until then. True end-to-end (deployed handlers + live DB +
  a login) is unverified.
- **No RBAC** — the app assumes a single user per device (team/payroll/document
  data isn't role-gated).
- **Model gaps** — bulk/tier pricing, discounts, and low-stock thresholds have no
  server counterpart yet; `pullFromCloud` is a one-time initial pull (made safe
  with reconciliation, not yet continuous bidirectional sync).
