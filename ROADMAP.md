# AgriOS India — MVP Roadmap

Built from the Core Concept Document v1.0. Guiding rule: **ship the daily loop deep before going wide.**
The daily loop = morning (weather + tasks + advice) → evening (record activities, income, expenses).

---

## Phase 0 — Done (this prototype)

- Onboarding: name, state, land size, enterprises, **language (English / Hindi / Bengali)**
- Home dashboard: live weather (Open-Meteo, per-state) + spray/field-work advisory, monthly money snapshot, task list
- **Farm Diary**: daily activity log (sowing, irrigation, spraying, vaccination, sale, …) tagged by enterprise
- **Business ledger**: income/expense entries, monthly P&L, per-enterprise P&L, category breakdown, Indian ₹ formatting, delete confirmation
- **AI Farm Advisor**: chat grounded in the farmer's profile, this month's ledger, diary, tasks and weather; answers in the app language; safety disclaimer for chemicals/vet advice. Uses the Claude API (`claude-opus-4-8`) with a user-supplied key stored on-device.
- All data offline-first in local storage (artifact `window.storage` compatible)

## Phase 1 — MVP hardening (next)

- **Backend + sync**: keep local-first writes, sync to a small API (Supabase/Firebase class) so data survives device loss. Auth by phone number + OTP (farmers rarely have email).
- **Advisor via server**: move the Claude API call behind your backend so farmers never handle API keys; meter usage for the free/premium split.
- **Voice input** for tasks, diary and advisor questions (Web Speech API / native STT) — critical for low-literacy users.
- **Vaccination & feed reminders** for livestock (local notifications) — first real "intelligent reminder".
- More languages: Odia, Telugu, Marathi (the i18n layer is ready — add a dictionary per language).

## Phase 2 — Intelligence & market

- **AI disease detection (assistive)**: photo + crop + season sent to cloud vision; framed as "possible causes — confirm with KVK".
  - _Status:_ **cloud path live** — 7 domains (crop, poultry, dairy, goat, pig, fish, bee), symptom checklist + photo → structured diagnosis with confidence, severity, and escalation. Offline captures are queued and analyzed on reconnect.
  - _On-device (optional, future):_ a runtime-agnostic **inference harness** is built and verified (`localProvider` + `localInference` — preprocess/softmax/top-k, `registerModel` seam). It ships **no ML dependency and no model** — dormant until a trained crop-disease model + labels are registered, at which point on-device gives fast triage and cloud/expert provides treatment. See [`AUDIT-cloud-vision.md`](AUDIT-cloud-vision.md) (F6). Deciding whether to train/commission a model remains a product call.
- **Market prices**: Agmarknet / eNAM via data.gov.in APIs; nearest-mandi prices for the farmer's crops with 7-day trend.
- **Government schemes**: curated per state × enterprise; start with 2 states done well rather than all states done badly.
- Weather upgrade: village-level pin (GPS) instead of state capital; IMD alerts.

## Phase 3 — Premium anchors

- **AI DPR Generator**: project type + size + state → bank-format draft DPR (this is the strongest willingness-to-pay feature; farmers already pay agents for these).
- **Livestock modules**: animal profiles, growth tracking, batch economics for poultry/goat/fish.
- Cash-flow view, loan EMI calculator, season-over-season comparison.
- B2B channel: FPO/dealer dashboards sponsoring premium for member farmers.

---

## Data sources to line up

| Need | Source | Notes |
|---|---|---|
| Weather | Open-Meteo (now), IMD (later) | Open-Meteo is free, no key, CORS-friendly |
| Market prices | Agmarknet / eNAM via data.gov.in | Needs API key registration; data is messy — budget cleaning time |
| Schemes | PM-KISAN, state portals | No API — manual curation, needs quarterly refresh |
| AI | Claude API (`claude-opus-4-8`) | Move behind backend in Phase 1 |

## Risks to keep in view

1. Scope creep — say no to anything outside the daily loop until Phase 1 ships.
2. Trust — one bad pesticide dose recommendation kills the brand; keep the KVK disclaimer everywhere and never let the AI invent numbers.
3. Connectivity — every feature must degrade gracefully offline (weather and advisor already do).
4. Farmer price sensitivity — validate the premium tier with FPOs before betting on individual subscriptions.
