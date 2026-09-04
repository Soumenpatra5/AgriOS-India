/* Tier-2: offline behavior — the app's core promise is local-first. Going
   offline must show the banner, keep navigation alive, and keep the ledger
   recording to IndexedDB; coming back online must clear the banner. */

import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome, openLedger } from "./helpers.js";

test.beforeEach(async ({ context, page }) => {
  await blockExternal(context);
  await seedSignedIn(page);
});

test("offline: banner appears, tabs still navigate, banner clears on reconnect", async ({ context, page }) => {
  await bootToHome(page);

  await context.setOffline(true);
  await expect(page.getByText("You're offline", { exact: false })).toBeVisible({ timeout: 10_000 });

  /* Navigation still works while offline (chunks for these tabs may load
     from the browser cache; Home is eagerly bundled and must always work). */
  await page.getByRole("tab", { name: "Profile" }).click();
  await expect(page.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Home" }).click();
  await expect(page.getByRole("tab", { name: "Home" })).toHaveAttribute("aria-selected", "true");

  await context.setOffline(false);
  await expect(page.getByText("You're offline", { exact: false })).toHaveCount(0, { timeout: 10_000 });
});

test("offline: a ledger entry saves locally and survives reconnect + reload", async ({ context, page }) => {
  const errors = collectErrors(page);
  await bootToHome(page);
  /* Open the ledger while online so its lazy chunk is loaded... */
  await openLedger(page);

  /* ...then go offline and record an expense. */
  await context.setOffline(true);
  await expect(page.getByText("You're offline", { exact: false })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Add", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Add entry" });
  /* "Expense" also exists as a filter chip behind the sheet — scope to it. */
  await sheet.getByText("Expense", { exact: true }).click();
  await sheet.getByPlaceholder("0.00").fill("750");
  const category = sheet.locator("select").first();
  /* Pick the first real expense category, whatever its id. */
  const firstCat = await category.locator("option").nth(1).getAttribute("value");
  await category.selectOption(firstCat);
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByText("Expense recorded")).toBeVisible();
  await expect(page.getByText(/750/).first()).toBeVisible();

  /* Reconnect, reload the whole app, and find the entry again. */
  await context.setOffline(false);
  await page.reload();
  await page.getByRole("tab", { name: "Home" }).waitFor({ timeout: 15_000 });
  await openLedger(page);
  await expect(page.getByText(/750/).first()).toBeVisible();

  expect(realErrors(errors)).toEqual([]);
});
