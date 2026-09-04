/* Tier-2: a real local-first feature end to end in the browser — the Farm
   Ledger. Add an entry through the actual sheet UI, see it in the list,
   prove it survives a full reload (IndexedDB persistence), then delete it
   through the confirm dialog. */

import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome, openLedger } from "./helpers.js";

test.beforeEach(async ({ context, page }) => {
  await blockExternal(context);
  await seedSignedIn(page);
});

test("add an income entry, persist it across reload, then delete it", async ({ page }) => {
  const errors = collectErrors(page);
  await bootToHome(page);
  await openLedger(page);

  /* Empty state first — fresh browser context, fresh IndexedDB. */
  await expect(page.getByText("No entries yet")).toBeVisible();

  /* Open the add sheet and fill it in. */
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Add entry")).toBeVisible();
  await page.getByPlaceholder("0.00").fill("2500");
  await page.locator("select").first().selectOption("crop_sale");
  const save = page.getByRole("button", { name: "Save entry" });
  await expect(save).toBeEnabled();
  await save.click();

  /* Toast + the row itself. */
  await expect(page.getByText("Income recorded")).toBeVisible();
  await expect(page.getByText("Crop sale", { exact: true })).toBeVisible();
  await expect(page.getByText(/2,500/)).toBeVisible();

  /* Reload the whole app: the entry must come back from IndexedDB. */
  await page.reload();
  await page.getByRole("tab", { name: "Home" }).waitFor({ timeout: 15_000 });
  await openLedger(page);
  await expect(page.getByText("Crop sale", { exact: true })).toBeVisible();
  await expect(page.getByText(/2,500/)).toBeVisible();

  /* Delete through the confirm dialog. */
  await page.getByRole("button", { name: "Delete" }).first().click();
  await expect(page.getByText("Delete entry?")).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  await expect(page.getByText("No entries yet")).toBeVisible();

  expect(realErrors(errors)).toEqual([]);
});

test("the save button stays disabled until the form is valid", async ({ page }) => {
  await bootToHome(page);
  await openLedger(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  const save = page.getByRole("button", { name: "Save entry" });
  await expect(save).toBeDisabled();               // nothing filled
  await page.getByPlaceholder("0.00").fill("100");
  await expect(save).toBeDisabled();               // amount but no category
  await page.locator("select").first().selectOption("crop_sale");
  await expect(save).toBeEnabled();                // both -> valid
  await page.getByPlaceholder("0.00").fill("0");
  await expect(save).toBeDisabled();               // zero amount is invalid
});
