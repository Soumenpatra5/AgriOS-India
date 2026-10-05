# AgriOS India — Canonical Product Roadmap

> **Review Date:** October 1, 2026<br/>
> **Baseline Commit:** `aa3bf02`<br/>
> **Status:** Active & Re-Baselined<br/>
> **Source of Truth:** Canonical product roadmap<br/>
> **Guiding Philosophy:** Ship the daily loop deep before going wide.<br/>
> *The daily loop = morning (weather + tasks + advice) → evening (record activities, income, expenses).*

## Status Legend

- ✅ **Shipped / Verified** — implemented and supported by repository evidence.
- 🟡 **In Progress** — actively being implemented or completed.
- 🔵 **Planned** — intentionally planned, but not yet implemented as a completed capability.
- ⏸️ **Deferred / Re-scoped** — intentionally postponed, narrowed, or waiting on an external dependency.

---

## 1. Product Evolution: From Daily Loop to Farm Operating System

AgriOS India began as a farmer-first mobile web application focused on the core daily loop. Through iterative engineering, it has expanded into a broader Farm Operating System spanning collaborative Farm Spaces, operational ERP, multi-provider AI, and agricultural commerce.

```text
Original Concept (Single-Farmer Daily Loop)
       ↓
Phase 0 / Phase 1: MVP Hardening (Cloud Sync, Offline Resilience, Phone Auth)
       ↓
Phase 2: Intelligence & Diagnostics (Assistive Disease Detection, Schemes, Weather)
       ↓
Phase 3: Financial & Enterprise Anchors (Bank-Format DPR Generator, Livestock Managers)
       ↓
Farm Space & Multi-Tenancy (Isolated Farm Workspaces, Configurable Modules, ModuleGuard)
       ↓
Team & Collaboration (4-Tier Role Hierarchy, Member Management, Permission Gating)
       ↓
Farm ERP & Operations (Parcels, Equipment, Storage, Local Employee Workforce)
       ↓
Connected Commerce & Logistics (Agri-Marketplace, Service Booking, Trade & Logistics)
       ↓
AI-Native Farm Operating System (Collaborative, Multi-Tenant Agricultural Platform)
```

### Historical Delivery Milestones

- **Phase 0 — Prototype Foundation · ✅ Shipped:** onboarding, daily dashboard, Farm Diary / Business Ledger, AI Farm Advisor, and offline-first foundations.
- **Phase 1 — MVP Hardening · ✅ Shipped:** backend/sync foundations, authentication methods, AI proxy/failover, voice input, and vaccination calendar.
- **Phase 2 — Intelligence & Market · ✅ Shipped:** assistive disease detection, government scheme discovery, and location-aware weather capabilities.
- **Phase 3 — Financial & Enterprise Anchors · ✅ Shipped:** business/advisory AI, Bank-format DPR generation, livestock managers, cash-flow/loan tools, and related enterprise foundations.

---

## 2. Active Priority Order (October 1, 2026)

### Now / In Progress

1. **Farm Space Collaboration & Real-Time Presence:** deepen collaborative workflows in Farm Space Chat and DMs, including presence, unread-state handling, and event synchronization.
2. **Local ERP ↔ Cloud Farm Space Bridge:** provide an optional, explicit migration/synchronization path between device-local ERP records and collaborative multi-tenant Farm Spaces without collapsing the two data models.
3. **Feed & Task Reminder Scheduling:** complete background local notification wiring for livestock feeding intervals and custom task schedules.
4. **Regional Language Dictionary Completion:** expand localization coverage beyond English, Hindi, and Bengali toward Tamil (`ta`), Telugu (`te`), Marathi (`mr`), Punjabi (`pa`), and Odia (`or`).

### Next Priorities

5. **IMD Real-Time Weather Alerts:** direct ingestion of India Meteorological Department severe-weather bulletins into the location advisory flow.
6. **Season-Over-Season Analytics:** comparative yield, cost, and P&L analytics across multi-year crop cycles and livestock batches.
7. **B2B / FPO / Dealer Dashboards:** dedicated multi-farm aggregate views for Farmer Producer Organisations and agricultural input dealers.
8. **Logistics Demand Forecasting:** predictive capacity planning for cold storage and harvest transport routes.

### Deferred / Re-scoped

- ⏸️ **Real-Time Agmarknet / eNAM Live Feed:** live external scraping remains deferred because of upstream/API stability constraints. Existing MSP benchmarks and curated seasonal market bands remain the current approach; live integration will be revisited when stable official access is available.
- ⏸️ **On-Device Edge ML Weights:** the pluggable local inference harness exists, while trained/shipped on-device model weights remain a future product decision.

---

## 3. Shipped & Verified Architecture

### A. Farm Space & Multi-Tenancy Foundation · ✅ Shipped
*Verified in commit checkpoints `5de2c6a` and `47ec388`.*

- **Multi-Tenant Workspaces (`farm_spaces`):** users can create, configure, and switch between separate operational Farm Spaces.
- **Configurable Module Management (`5de2c6a`):**
  - Per-space enable/disable controls for optional farm modules.
  - Active and available module states with drag-and-drop and accessible up/down reordering.
  - Core module protection for required collaboration functionality.
  - Route/navigation enforcement through `ModuleGuard`.
  - Configuration persistence isolated by Farm Space.
- **Team & Member Management (`47ec388`):**
  - **4-Tier Role Hierarchy:** `owner` → `manager` → `supervisor` → `worker`.
  - **Member Details BottomSheet:** member profile, AgriOS user ID, role, contact information, joined date, and membership status.
  - **Search & Role Filtering:** client-side search by name, phone, or AgriOS user ID with role tabs for **All, Managers, Supervisors, and Workers**.
  - **Supervisor UX:** read-only roster experience; management-only actions are hidden when the viewer lacks `farm.members.manage`.
  - **Invitation System (`farm_space_invitations`):** AgriOS User ID-based invite/lookup flow with expiration and acceptance lifecycle.
  - **Permission Enforcement:** server-side and client-side permission gating for member management and owner-protected ownership operations.
- **Farm Space Collaboration:** Team, task/workflow, announcements, activity/audit surfaces, Team Chat, and 1-on-1 Direct Messaging are implemented where supported by the current Farm Space modules.
- **Architectural Separation:** the collaborative multi-tenant Farm Space member directory (`farm_space_memberships`) remains distinct from the single-device offline ERP employee directory (`employeeService.js` / IndexedDB). They represent different identities and purposes.

### B. Platform, Data & Runtime Architecture · ✅ Shipped
*Verified against the repository and runtime checkpoint `aa3bf02`.*

- **Cloud Relational Data Layer:** PostgreSQL-backed multi-tenant data model managed through the repository migration layer (`supabase/migrations/` and `scripts/migrate.mjs`).
- **Deterministic Testing Harness:** embedded `@electric-sql/pglite` used for hermetic migration-backed isolation testing without requiring an external database for those tests.
- **Device-Local Offline Store:** IndexedDB / LocalStorage accessed through repository-style services (`syncRepo.js`, `erpDb.js`) with queued synchronization where implemented.
- **Row Level Security (RLS):** enabled on protected Postgres tables, with backend authorization providing the application-level tenancy boundary.
- **Structured Audit Logging:** `farm_audit_logs` records space-scoped administrative and membership events.
- **Authentication & Identity:** Firebase Authentication with Phone OTP, Email/Password, and federated/OAuth flows as implemented; server-side JWT verification through `verifyAuth.js` / `ensureUser.js`; stable AgriOS User IDs.
- **Authorization:** strict Farm Space role/permission enforcement through `api/_lib/permissions.js` and `api/_lib/gate.js`.
- **Runtime:** Node.js 24 (`"engines": { "node": "24.x" }`) synchronized between `package.json` and `package-lock.json`.
- **CI Automation:** GitHub Actions validation covering lint/build/tests and emulator-leak checks; the verified repository test baseline is **158 test files, 2,135 passing tests, 7 skipped** at the October 1, 2026 checkpoint.
- **Deployment Pipeline:** Vercel production deployment is automated through GitHub Actions and gated by CI success.

### C. AI & Assistive Intelligence · ✅ Shipped

- **Multi-Provider AI Gateway (`api/ai/chat.js`):** authenticated server-side gateway architecture with Google Gemini as the current default path and OpenAI / Anthropic fallback paths.
- **AI Provider Abstraction:** provider and model selection are centralized in the AI configuration/gateway rather than being treated as permanent roadmap commitments.
- **14 Registered AI Agents (`src/ai/agents/registry.js`):**
  - `generalAssistant`, `farmDoctor`, `cropExpert`, `livestockExpert`, `businessAdvisor`, `loanAdvisor`, `governmentAdvisor`, `weatherExpert`, `marketExpert`, `financeExpert`, `veterinaryExpert`, `educationExpert`, `commerceAdvisor`, `dprGenerator`.
  - Tool/context integration is used where implemented, including calculators and relevant agricultural data sources.
- **Assistive Disease Detection:**
  - 7 agricultural domains: Crop, Poultry, Dairy, Goat, Pig, Fish, and Bee.
  - Multimodal photo inspection and symptom-based structured output, with safety/verification guidance.
  - Pluggable local inference harness; trained on-device weights remain future work.
- **Financial & Viability Engines:**
  - Bank-format DPR generator with structured financial analysis including NPV, IRR, BCR, DSCR, payback, break-even analysis, and A4 PDF/CSV export across the implemented templates.
  - Loan EMI, cash-flow, and enterprise P&L capabilities.

### D. Farm Operations & Livestock Modules · ✅ Shipped

- **Livestock Management Engines:**
  - **Poultry:** shed/batch lifecycle, mortality, feed/FCR, vaccination, egg collection, and batch finance.
  - **Dairy:** herd registry, milk logs with fat/SNF, breeding cycles, sales, feed, and herd finance.
  - **Goat & Sheep:** individual tags, weight monitoring, kidding history, milk/sales, and health scheduling.
  - **Pig:** herd records, weight gain, feed, breeding, and sales.
  - **Fish:** pond management, stocking, water-quality records, feeding, and harvest.
  - **Bee:** hive registry, inspections, queen status, harvests, and disease checks.
- **Deterministic Isolation Test Suite (`ddbe47f`):** date-bounded fixtures keep livestock financial-summary and monthly-metric tests deterministic across calendar-month turnovers. This is a **test-suite reliability improvement**, not a claim about changing production aggregation behavior.
- **Crop Planning & Field Operations:** crop planning/calculation engine, multi-stage crop schedules, crop financial tracking, and parcel/field allocation.
- **Farm ERP Foundation:** local-first asset, equipment maintenance, storage/inventory, CRM, and offline employee/workforce records.

### E. Commerce, Logistics & Trade · ✅ Shipped

- **Agri-Marketplace:** product catalog, cart, checkout, order tracking, wishlist, and seller dashboard capabilities present in the repository.
- **Service Marketplace:** agricultural service listings, provider profiles, booking, and scheduling capabilities.
- **Logistics & Trade:** shipment, fleet/driver, warehouse, contract, procurement/auction capabilities present in the repository.
- **Payment Lifecycle:** Razorpay integration with server-side payment/settlement validation.

### F. Administration & MLOps Platform · ✅ Shipped

- **Enterprise Admin Panel:** audit-log views, support tickets, CMS/content, announcements, and administrative dashboards.
- **MLOps Platform:** dataset annotation workspace, model registry, training/experiment workflow views, and monitoring/drift surfaces present in the repository.

---

## 4. Planned & Future Capabilities

### Near-Term Enhancements (Q4 2026)

- 🔵 **Live Event Push Architecture:** move Farm Space chat/task updates from polling-style refreshes toward WebSocket or equivalent real-time subscriptions.
- 🔵 **Cross-Enterprise Inventory Linking:** connect operational feed/fertilizer records to inventory depletion where the relevant Farm Space modules are active.
- 🔵 **Multi-Language Expansion:** complete localization and audio prompts for the five secondary Indian languages.

### Medium-Term Vision (2027)

- 🔵 **FPO Aggregation Portal:** bulk purchasing, shared logistics, and consolidated crop/livestock reporting for farmer-producer collectives.
- 🔵 **Edge Vision Deployment:** integrate optimized TensorFlow Lite / ONNX models into the existing local inference harness for stronger field diagnostics under poor connectivity.
- 🔵 **Predictive Micro-Climate Advisory:** use on-farm IoT telemetry for hyper-local weather, pest, and disease early-warning workflows.

---

## 5. Architectural Data Sources & Boundaries

| Need | Source | Implementation Mechanism | Status |
|---|---|---|---|
| **Weather** | Open-Meteo / ECMWF-backed weather data | Coordinates-based REST client with cached advisory state | ✅ Live |
| **Severe Alerts** | IMD | Direct ingestion of regional warning bulletins | 🔵 In Pipeline |
| **Market Prices** | Data.gov.in / Agmarknet-derived benchmark data | MSP references and curated seasonal bands; no real-time scraper dependency | ✅ Curated |
| **Schemes** | Central & State agricultural portals | Curated eligibility/content data | ✅ Live |
| **AI Advisory** | Google Gemini, OpenAI, Anthropic | Authenticated server-side multi-provider gateway | ✅ Live |
| **Multi-Tenancy** | PostgreSQL-backed Farm Space data model | Tenant-scoped schema, backend authorization, RLS, and deterministic PGlite test harness | ✅ Live |
| **Identity** | Firebase Auth + AgriOS User IDs | Client authentication with server-side JWT verification | ✅ Live |

---

## 6. Operating Principles & Risk Controls

1. **Farmer Safety & Clinical Guidance:** AI diagnostics, dosage-related guidance, and financial guidance must carry clear safety/verification language and direct users toward qualified local professionals or relevant official sources where appropriate.
2. **Offline-First Resilience:** the app should keep core field workflows usable without network access, with queued synchronization and cached data where implemented.
3. **Data Integrity & Tenant Isolation:** Farm Space operations must remain isolated by authenticated identity, tenant space IDs, backend authorization, and database controls. Farm data, communications, and financial records must not cross Farm Space boundaries.
4. **Transparent Economics:** DPR and enterprise financial outputs are planning models with editable assumptions; they should not be presented as guaranteed lender decisions, returns, or approvals.
5. **Architectural Clarity:** the collaborative cloud-backed Farm Space platform and the single-device offline ERP remain separate data domains unless an explicit, tested bridge is introduced.
6. **Roadmap Discipline:** this document records product direction and delivery status; detailed implementation contracts, schemas, and technical procedures belong in the appropriate architecture/specification documents.
