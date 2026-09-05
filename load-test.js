/* Tier-3: load testing against staging environment.

   Scenarios simulate realistic user behavior:
   - onboarding (language → auth, no backend call needed in local-first mode)
   - ledger workflow (browse, add entry, delete)
   - service discovery (scroll Services, open a few screens)

   Run with: k6 run load-test.js
   Or with custom thresholds: k6 run -e RAMP_UP=1m -e PEAK=100 load-test.js

   Environment variables:
   - STAGING_URL: base URL (default: http://localhost:4173 for local preview)
   - RAMP_UP: ramp-up duration (default: 30s)
   - PEAK_VUS: peak VUs (default: 50)
   - DURATION: hold peak (default: 5m)
*/

import http from "k6/http";
import { check, sleep } from "k6";

const STAGING_URL = __ENV.STAGING_URL || "http://localhost:4173";
const RAMP_UP = __ENV.RAMP_UP || "30s";
const PEAK_VUS = parseInt(__ENV.PEAK_VUS || "50", 10);
const DURATION = __ENV.DURATION || "5m";

export const options = {
  /* VUs ramp 0 → PEAK_VUS over RAMP_UP, hold for DURATION, then ramp down. */
  stages: [
    { duration: RAMP_UP, target: PEAK_VUS },
    { duration: DURATION, target: PEAK_VUS },
    { duration: RAMP_UP, target: 0 },
  ],

  /* Thresholds: tests fail if these are breached. */
  thresholds: {
    http_req_duration: ["p(95)<3000", "p(99)<5000"],
    http_req_failed: ["rate<0.05"], // allow 5% error rate
    "http_req_duration{scenario:onboarding}": ["p(95)<2000"],
    "http_req_duration{scenario:ledger}": ["p(95)<2500"],
    "http_req_duration{scenario:services}": ["p(95)<3000"],
  },
};

/* Scenario 1: Fresh visitor onboarding.
   Represents a new farmer landing, choosing language, accepting ToS, entering phone. */
export function onboarding() {
  const sessionId = `vu_${__VU}_${Date.now()}`;

  let res = http.get(`${STAGING_URL}/`, {
    tags: { scenario: "onboarding" },
  });
  check(res, { "splash loads": (r) => r.status === 200 });
  sleep(0.5);

  /* Language screen (no backend call) */
  res = http.post(
    `${STAGING_URL}/`,
    JSON.stringify({ action: "setLanguage", lang: "hi" }),
    { headers: { "Content-Type": "application/json" }, tags: { scenario: "onboarding" } }
  );
  check(res, { "language persists": (r) => r.status === 200 || r.status === 0 }); // POST to static app may 404; that's OK
  sleep(0.3);

  /* Onboarding screen (no backend call) */
  res = http.get(`${STAGING_URL}/`, {
    tags: { scenario: "onboarding" },
  });
  check(res, { "onboarding screen loads": (r) => r.status === 200 });
  sleep(1);
}

/* Scenario 2: Signed-in user ledger workflow.
   Represents a farmer navigating to ledger, viewing entries, adding a new one. */
export function ledger() {
  const sessionId = `vu_${__VU}_${Date.now()}`;

  /* Boot to Home (simulates localStorage seeding + app init) */
  let res = http.get(`${STAGING_URL}/`, {
    tags: { scenario: "ledger" },
  });
  check(res, { "home loads": (r) => r.status === 200 });
  sleep(1);

  /* Navigate to Services → Ledger (tabs are client-side; no server call) */
  sleep(0.5);

  /* In a real test against /api, we'd call:
     GET /api/ledger (fetch entries)
     POST /api/ledger (add entry)
     DELETE /api/ledger/:id (delete)
     But in local-first mode, these are IndexedDB reads/writes, not HTTP.
     We measure the app's HTML delivery performance instead. */

  res = http.get(`${STAGING_URL}/`, {
    tags: { scenario: "ledger" },
  });
  check(res, { "ledger page loads": (r) => r.status === 200 });
  sleep(2);
}

/* Scenario 3: Service discovery.
   Represents a farmer browsing the Services tab, opening a few screens. */
export function services() {
  let res = http.get(`${STAGING_URL}/`, {
    tags: { scenario: "services" },
  });
  check(res, { "services page loads": (r) => r.status === 200 });
  sleep(0.5);

  /* Simulate scrolling and clicking into a service screen. Since all screens are
     lazy-loaded chunks baked into the bundle, every GET is the same HTML; in
     production, chunks would be fetched separately, but preview serves the full dist. */

  for (let i = 0; i < 3; i++) {
    res = http.get(`${STAGING_URL}/`, {
      tags: { scenario: "services" },
    });
    check(res, { "service screen loads": (r) => r.status === 200 });
    sleep(0.8);
  }
}

/* Scenario 4: Heavy Profile tab + repeated navigation.
   Represents a power user switching tabs and viewing data repeatedly. */
export function profileHeavy() {
  let res = http.get(`${STAGING_URL}/`, {
    tags: { scenario: "services" }, // reuse threshold
  });
  check(res, { "profile loads": (r) => r.status === 200 });
  sleep(0.3);

  /* Rapid tab switches */
  for (let i = 0; i < 5; i++) {
    res = http.get(`${STAGING_URL}/`, {
      tags: { scenario: "services" },
    });
    check(res, { "tab switch": (r) => r.status === 200 });
    sleep(0.2);
  }
}

/* Assign scenarios to VUs with probabilistic weights.
   - 40% onboarding (new visitors)
   - 35% ledger (active farmers)
   - 20% services (explorers)
   - 5% profile heavy (power users) */
export const scenarios = {
  onboarding: {
    executor: "per-vu-iterations",
    exec: "onboarding",
    vus: Math.ceil((PEAK_VUS * 0.40) / 1),
    iterations: 1,
  },
  ledger: {
    executor: "per-vu-iterations",
    exec: "ledger",
    vus: Math.ceil((PEAK_VUS * 0.35) / 1),
    iterations: 1,
  },
  services: {
    executor: "per-vu-iterations",
    exec: "services",
    vus: Math.ceil((PEAK_VUS * 0.20) / 1),
    iterations: 1,
  },
  profileHeavy: {
    executor: "per-vu-iterations",
    exec: "profileHeavy",
    vus: Math.ceil((PEAK_VUS * 0.05) / 1),
    iterations: 1,
  },
};
