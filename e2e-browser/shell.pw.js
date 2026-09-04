/* Tier-2: the signed-in app shell — tab navigation across all five tabs,
   push/pop screens, browser-Back integration, and shell stability over time
   (an injected local-first session must not be bounced by anything). */

import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "./helpers.js";

test.beforeEach(async ({ context, page }) => {
  await blockExternal(context);
  await seedSignedIn(page);
});

test("boots into the app shell and every tab renders without console errors", async ({ page }) => {
  const errors = collectErrors(page);
  await bootToHome(page);

  /* All five tabs present. */
  for (const name of ["Home", "Farm Space", "AI", "Services", "Profile"]) {
    await expect(page.getByRole("tab", { name })).toBeVisible();
  }

  /* Visit each tab; each is lazy-loaded, so this also proves chunk loading. */
  for (const name of ["Farm Space", "AI", "Services", "Profile", "Home"]) {
    await page.getByRole("tab", { name }).click();
    await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
    /* Give the lazy chunk a beat to render and surface any errors. */
    await page.waitForTimeout(400);
  }

  expect(realErrors(errors)).toEqual([]);
});

test("the injected session survives well past the deferred auth wiring", async ({ page }) => {
  await bootToHome(page);
  /* AppStore defers its auth/sync wiring 2.5s after boot. In this build
     Firebase is disabled, so nothing may sign the user out or change stage. */
  await page.waitForTimeout(4_500);
  await expect(page.getByRole("tab", { name: "Home" })).toBeVisible();
  await expect(page.getByPlaceholder(/Mobile number|Email address/)).toHaveCount(0);
});

test("browser Back pops a pushed screen instead of leaving the app", async ({ page }) => {
  await bootToHome(page);
  await page.getByRole("tab", { name: "Services" }).click();
  await page.getByText("Farm ledger", { exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible({ timeout: 15_000 });

  await page.goBack();
  /* Back must return to the Services tab, still inside the app. */
  await expect(page.getByRole("button", { name: "Export CSV" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Services" })).toBeVisible();
});

test("a full reload restores the same signed-in shell", async ({ page }) => {
  const errors = collectErrors(page);
  await bootToHome(page);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Home" })).toBeVisible({ timeout: 15_000 });
  expect(realErrors(errors)).toEqual([]);
});
