import { defineConfig } from "@playwright/test";

/* Tier-2 browser E2E (QA program). Runs the real production bundle:
   `npm run build` first (with VITE_FB_API_KEY blank — see e2e-browser/helpers.js
   for why that is a safety requirement, not a shortcut), then this config
   serves dist/ via `vite preview` and drives it in Chromium.

   Files use the .pw.js suffix so vitest (which collects any *.test.* or
   *.spec.* file) never picks them up, and vice versa.
   Run with: npx playwright test */
export default defineConfig({
  testDir: "./e2e-browser",
  testMatch: "**/*.pw.js",
  timeout: 45_000,
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    /* Primary target device class: budget Android phones. */
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
