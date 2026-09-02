# AgriOS India 🌾

**An AI-powered Farm Operating System PWA for Indian farmers.**

AgriOS brings crop advice, disease diagnosis, weather, a farm
ledger, government schemes, livestock and ERP tools together in one offline-first,
multilingual progressive web app — designed for low-end Android devices and
intermittent connectivity.

---

## Highlights

- **A suite of specialist AI assistants** (crop, livestock, veterinary, finance,
  loans, weather, market, government schemes, business, education, general…)
  behind a single gateway with intent routing, tool use, and streaming responses.
- **Vision disease diagnosis** for plants, poultry, dairy, goats, pigs, fish and bees.
- **Offline-first**: all data lives on-device (localStorage + IndexedDB) and syncs
  to Firestore in the background when signed in and online. The app boots and works
  fully offline via a precaching service worker.
- **Multilingual**: full UI in English, Hindi and Bengali; AI replies in 8 languages
  (adds Tamil, Telugu, Marathi, Punjabi, Odia).
- **Farm tooling**: ledger with CSV export, crop calendar with reminders,
  weather dashboard, scheme explorer, livestock and ERP hubs.
- **My Farm Space**: the app's only shared surface — a farm the owner invites
  people into, with roles, tasks, attendance, announcements, an activity feed
  and a farm chat. Everything else in AgriOS stays personal: profile, AI
  history, payments and personal documents are never shared with members.
  Authorization is server-enforced in Postgres (`api/farm.js`), not in the UI.
- **PWA**: installable, push notifications (FCM), in-app update prompt, backup/restore.

## Tech stack

| Area | Choice |
|------|--------|
| UI | React 18 (no framework), inline-style design system, `lucide-react` icons |
| Build | Vite |
| State | React context (`AppStore`, `PreferencesProvider`, `ThemeProvider`) |
| Storage | localStorage + IndexedDB, local-first with a Firestore sync layer |
| Auth/Cloud | Firebase Auth + Firestore + Cloud Messaging (all lazily loaded) |
| Backend | Vercel serverless functions (`api/`) — hold all secret keys |
| AI | Anthropic / OpenAI via a serverless proxy |
| Tests | Vitest (+ `fake-indexeddb`) |
| CI | GitHub Actions — tests, build, bundle budget, security scan |

## Architecture

```
React UI (src/pages, src/components)
   │  UI talks only to the AI barrel and service modules — never to the LLM directly
   ▼
AI Gateway (src/ai/gateway)  ──►  serverless /api/ai/chat  ──►  LLM provider
   │  validate → route → prompt → stream → tool loop → persist → cache
   ▼
Services (src/services/*)  ──►  local DB modules (IndexedDB)  ──►  syncRepo  ──►  Firestore
```

- **Secrets never reach the browser.** LLM, weather and OTP keys live only in
  `api/` (Vercel env). The client calls same-origin `/api/*` endpoints.
- **Firebase is fully lazy.** The ~900 kB SDK is kept off the initial render path;
  a CI bundle check (`npm run check:bundle`) fails the build if it leaks back in.

### Project layout

```
api/            Vercel serverless functions (AI proxy, auth/OTP, weather)
src/ai/         AI gateway, agents, prompts, memory, tools, vision
src/services/   Domain services (weather, market, calendar, ledger, livestock, erp, firebase…)
src/pages/      Screens (lazy-loaded via ScreenRouter)
src/components/ Shared UI (primitives, overlays, feedback, ErrorBoundary…)
src/store/      App-wide context
src/customize/  User preferences + appearance
src/theme/      Design tokens + light/dark theming
src/i18n/       String dictionaries (en/hi/bn)
src/admin/      Separate admin console (admin.html), PIN-gated
scripts/        Build/CI helpers (bundle budget check)
```

## Getting started

**Prerequisites:** Node.js 24+.

```bash
npm install
cp .env.example .env   # fill in Firebase web config (see below)
npm run dev            # http://localhost:5199
```

The app runs without any keys — Firebase, AI and live feeds degrade gracefully
(local-only data, curated MSP reference figures, offline behaviour). Add keys to
enable sign-in, cloud sync and live AI/weather.

### Environment variables

Client (`VITE_*`, safe to expose — Firebase web config):

```
VITE_FB_API_KEY, VITE_FB_AUTH_DOMAIN, VITE_FB_PROJECT_ID,
VITE_FB_STORAGE_BUCKET, VITE_FB_MSG_SENDER_ID, VITE_FB_APP_ID,
VITE_FB_VAPID_KEY        # Web Push certificate, for FCM
```

Server (Vercel env only — **never** prefixed `VITE_`):

```
ANTHROPIC_API_KEY / OPENAI_API_KEY     # LLM providers
FB_PROJECT_ID, FB_CLIENT_EMAIL, FB_PRIVATE_KEY   # Firebase Admin (verify auth)
OTP_JWT_SECRET, TWOFACTOR_API_KEY, FAST2SMS_API_KEY   # phone OTP
OPENWEATHER_API_KEY                    # live weather (falls back to Open-Meteo)
```

## Scripts

```bash
npm run dev            # dev server on :5199
npm run build          # production build → dist/
npm run preview        # preview the build
npm run test           # run the full Vitest suite (unit + PGlite integration)
npm run check:bundle   # enforce initial-JS budget + no eager Firebase (post-build)
```

## Testing & CI

- `npm run test` runs the full unit suite (services, utils, AI memory, error handling).
- **GitHub Actions** (`.github/workflows/ci.yml`) gates every push/PR on: unit tests →
  build → bundle budget, plus a secret-scan and dataset validation.

## Deployment

Configured for **Vercel** (`vercel.json`): Vite build to `dist/`, SPA rewrites, and
`/admin` → the admin console. Set the server env vars above in the Vercel project,
then deploy. The `/api/*` routes deploy automatically as serverless functions.

## License

Proprietary — all rights reserved (update this if you intend to open-source).
