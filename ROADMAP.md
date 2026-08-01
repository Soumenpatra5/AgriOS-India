# AgriOS India — Roadmap

Built from the Core Concept Document v1.0. Guiding rule: **ship the daily loop deep before going wide.**
The daily loop = morning (weather + tasks + advice) → evening (record activities, income, expenses).

**Status legend:** ✅ shipped · 🟡 partial · ⬜ planned. Last reviewed: Aug 2026.

---

## Phase 0 — Prototype foundation · ✅ shipped

- ✅ Onboarding: name, state, land size, enterprises, **language (English / Hindi / Bengali)**
- ✅ Home dashboard: live weather (Open-Meteo, per-state) + spray/field-work advisory, monthly money snapshot, task list
- ✅ **Farm Diary**: daily activity log (sowing, irrigation, spraying, vaccination, sale, …) tagged by enterprise
- ✅ **Business ledger**: income/expense entries, monthly P&L, per-enterprise P&L, category breakdown, ₹ formatting, delete confirmation
- ✅ **AI Farm Advisor**: chat grounded in the farmer's profile, ledger, diary, tasks and weather; answers in the app language; KVK/vet safety disclaimers. Runs on Claude (`claude-opus-4-8`) **via a keyless serverless proxy — farmers never handle an API key** (auth by Firebase ID token, verified server-side).
- ✅ All data offline-first in local storage

## Phase 1 — MVP hardening · ✅ shipped

- ✅ **Backend + sync**: local-first writes mirrored to **Firebase/Firestore**; offline writes queued in IndexedDB and flushed on reconnect; fresh-device login pulls cloud → local. Data survives device loss.
- ✅ **Auth**: phone-number **OTP** + email/password (with reset) + Google / Apple / Facebook / X. Keyless server-side token verification.
- ✅ **Advisor via server**: Claude call behind the serverless proxy with multi-key failover; no client keys.
- ✅ **Voice input** for advisor questions (Web Speech API STT).
- 🟡 **Vaccination & reminders**: vaccination calendar shipped; local-notification service in place. Feed-reminder scheduling still to wire.
- 🟡 **More languages**: 8 selectable (en, hi, bn, ta, te, mr, pa, or). English/Hindi/Bengali fully translated; others need dictionary completion.

## Phase 2 — Intelligence & market

- ✅ **AI disease detection (assistive)**: 7 domains (crop, poultry, dairy, goat, pig, fish, bee) — symptom checklist + photo → **structured diagnosis** with confidence, severity, risk, and escalation; framed as "possible causes — confirm with KVK". Offline captures are queued and analyzed on reconnect.
  - _On-device (optional):_ a runtime-agnostic **inference harness** is built and verified (`localProvider` + `localInference`, `registerModel` seam). Ships **no ML dependency and no model** — dormant until a trained crop-disease model + labels are registered. See [`AUDIT-cloud-vision.md`](AUDIT-cloud-vision.md) (F6). Training/commissioning a model is a product call.
- ✅ **Government schemes**: curated scheme explorer per enterprise/eligibility.
- ✅ **Weather upgrade**: location-based dashboard (GPS pin) with ECMWF model + advisories.
- ⬜ **Live market prices**: Agmarknet / eNAM via data.gov.in — **not yet live.** UI + `priceProxy` → `/api/prices` scaffolding is ready; today the Market tab shows curated MSP + seasonal bands (clearly labelled "not today's rate"). Needs a data.gov.in key + feed implementation in `api/prices.js`.
- ⬜ IMD real-time alerts.

## Phase 3 — Premium anchors

- 🟡 **Business/advisory AI**: business-advisor agent shipped (project reports, scaling). A dedicated **bank-format DPR generator** (strongest willingness-to-pay) is still to build.
- ✅ **Livestock modules**: managers for poultry, dairy, goat, pig, sheep, fish, bee — profiles, production, events.
- 🟡 Cash-flow view ✅, loan EMI calculator ✅; season-over-season comparison ⬜.
- ⬜ B2B channel: FPO/dealer dashboards sponsoring premium for member farmers.

---

## Delivered beyond the original MVP scope · ✅ shipped

The app has grown well past the initial daily-loop MVP. Also live:

- **Farm ERP**: farms, land/parcels, tasks, inventory, assets, employees, CRM, production, reports, analytics, IoT devices.
- **Marketplace**: buy/sell seeds, feed, medicine, equipment; cart, checkout, orders, wishlist, seller dashboard.
- **Service Marketplace**: vet, drone, machinery, soil-test, farm-worker booking; provider profiles + dashboards.
- **Logistics & Trade**: shipments, cold chain, fleet, warehouses, contracts, auctions, procurement, export.
- **AI Commerce**: recommendations, price forecasts, buyer matchmaking, fraud/risk, insights.
- **MLOps Platform**: dataset/annotation, model registry, deployment pipeline, monitoring.
- **Enterprise Admin Panel**: audit logs, tickets, articles, announcements (local-first, desktop-first).
- **13 specialised AI agents** with intent routing, tool-calling (calculator, weather, market, schemes), and per-farmer context.

---

## Data sources

| Need | Source | Status |
|---|---|---|
| Weather | Open-Meteo / ECMWF (now), IMD (later) | ✅ live; IMD alerts ⬜ |
| Market prices | Agmarknet / eNAM via data.gov.in | ⬜ not wired — needs key + feed; MSP/seasonal bands shown meanwhile |
| Schemes | PM-KISAN, state portals | ✅ curated (manual quarterly refresh) |
| AI | Claude (`claude-opus-4-8`) | ✅ behind keyless serverless proxy with failover |

## Risks to keep in view

1. **Trust** — one bad pesticide/vet dose kills the brand; keep KVK disclaimers everywhere and never let the AI invent numbers. (Enforced in the diagnosis safety layer + prompt safety preamble.)
2. **Connectivity** — every feature degrades gracefully offline; the AI advisor fails honestly (can't fabricate an answer offline).
3. **Data honesty** — don't present static/seed data as live (e.g. market prices are labelled; the misleading Home price block was removed).
4. **Farmer price sensitivity** — validate the premium tier with FPOs before betting on individual subscriptions.
5. **Scope** — the app is now very wide; prioritise depth/polish on the daily loop and the live market feed over new modules.
