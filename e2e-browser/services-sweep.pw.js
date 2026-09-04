/* Tier-2: smoke sweep over every live service screen. Each card on the
   Services tab is opened for real — its lazy chunk downloaded, the screen
   mounted at phone width — then closed with browser Back. A screen fails the
   sweep if it crashes into the error boundary ("Something went wrong") or
   logs a real console error. The backend is deliberately absent (vite
   preview serves no /api), so this also proves every screen degrades
   gracefully offline-from-the-API — the local-first promise.

   Titles come from src/services/serviceHub/serviceRegistry.js (live entries
   with a real `kind`). Grouped by area so a failure names its neighborhood
   and the groups run in parallel workers. */

import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "./helpers.js";

const GROUPS = {
  "crops & land": [
    "Farm ERP", "Farm profiles", "Land management", "Farm assets", "IoT devices",
    "Farm locations", "Alerts centre", "Crop calendar", "Crop planner",
    "Fertilizer calculator", "Yield calculator", "Plant disease detection", "Weather",
  ],
  "livestock & feed": [
    "Livestock manager", "Poultry manager", "Dairy manager", "Goat manager",
    "Pig manager", "Sheep manager", "Fish / pond manager", "Bee manager",
    "Feed management", "Feed cost calculator", "Vaccination calendar", "Veterinary",
  ],
  "people & finance": [
    "Worker & team management", "Inventory", "Feed inventory", "Suppliers & CRM",
    "Procurement", "Farm business", "Farm ledger", "Profit & loss", "Cash flow",
    "Loan EMI calculator", "Profit calculator",
  ],
  "commerce & logistics": [
    "Agri marketplace", "My orders", "Wishlist", "Sell products", "Logistics",
    "Shipments", "Fleet", "Warehouse", "Contracts", "Auctions", "Export",
    "Service marketplace", "My bookings", "Provider dashboard",
  ],
  "ai, records & reports": [
    "Soil testing", "Drone services", "Training centre", "Insurance",
    "AI farm advisor", "AI insights", "AI commerce", "MLOps",
    "Government schemes", "Nearby offices", "Farm documents", "Farm reports",
    "Farm analytics", "Feed reports",
  ],
};

/* Category section headers on the Services page. When a card title equals a
   header ("Logistics"), .first() would hit the header — take .last() instead
   (within a section, the header precedes its cards in the DOM). */
const SECTION_HEADERS = new Set([
  "Farm management", "Crop & agriculture", "Livestock", "Workforce",
  "Inventory & procurement", "Finance & business", "Marketplace", "Logistics",
  "Professional services", "AI & smart farm", "Government & schemes", "Documents",
]);
const card = (page, title) => {
  const all = page.getByText(title, { exact: true });
  return SECTION_HEADERS.has(title) ? all.last() : all.first();
};

test.beforeEach(async ({ context, page }) => {
  await blockExternal(context);
  await seedSignedIn(page);
});

for (const [group, titles] of Object.entries(GROUPS)) {
  test(`every "${group}" screen mounts cleanly and comes back (${titles.length} screens)`, async ({ page }) => {
    test.setTimeout(30_000 + titles.length * 10_000);
    const errors = collectErrors(page);
    await bootToHome(page);
    await page.getByRole("tab", { name: "Services" }).click();
    await expect(card(page, titles[0])).toBeVisible({ timeout: 15_000 });

    const crashed = [];
    const badBack = [];
    for (const title of titles) {
      const before = errors.length;
      await card(page, title).click();
      /* Let the lazy chunk load and the screen render. */
      await page.waitForTimeout(900);
      if (await page.getByText("Something went wrong").count()) {
        crashed.push(title);
        errors.length = before; // the boundary caught it; the crash is the report
      }
      await page.goBack();
      const back = card(page, title);
      try {
        await back.waitFor({ timeout: 4_000 });
      } catch {
        /* Back did not land on the Services list — record it and recover. */
        badBack.push(title);
        await page.getByRole("tab", { name: "Services" }).click();
        await back.waitFor({ timeout: 15_000 });
      }
    }

    expect(crashed, `screens that hit the error boundary: ${crashed.join(", ")}`).toEqual([]);
    expect(badBack, `screens whose Back did not return to Services: ${badBack.join(", ")}`).toEqual([]);
    expect(realErrors(errors)).toEqual([]);
  });
}
