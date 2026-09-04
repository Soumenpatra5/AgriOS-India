/* Tier-2: first-run boot flow in a real browser — splash, language selection,
   onboarding, auth screen — plus persistence of the choices across reload.
   All with a console-error trap: a white-screen regression (the iOS report)
   would fail here loudly. */

import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors } from "./helpers.js";

test.beforeEach(async ({ context }) => blockExternal(context));

test("fresh visitor: splash -> language -> onboarding -> auth, zero console errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");

  /* Splash paints the brand immediately... */
  await expect(page.getByText("AgriOS", { exact: false }).first()).toBeVisible();

  /* ...and hands over to the language screen (350ms timer). */
  await expect(page.getByRole("heading", { name: "Choose your language" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Continue" }).click();

  /* Onboarding slides; Skip is always available and must land on auth. */
  await expect(page.getByRole("button", { name: "Skip" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Skip" }).click();

  /* Auth screen: the login surface offers phone or email entry. */
  await expect(page.getByPlaceholder(/Mobile number|Email address/).first()).toBeVisible({ timeout: 15_000 });

  expect(realErrors(errors)).toEqual([]);
});

test("language + onboarding choices persist: a reload boots straight to auth", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue" }).click({ timeout: 10_000 });
  await page.getByRole("button", { name: "Skip" }).click({ timeout: 10_000 });
  await page.getByPlaceholder(/Mobile number|Email address/).first().waitFor({ timeout: 15_000 });

  const errors = collectErrors(page);
  await page.reload();
  /* No language screen, no onboarding — straight through the splash to auth. */
  await expect(page.getByPlaceholder(/Mobile number|Email address/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Choose your language" })).toHaveCount(0);
  expect(realErrors(errors)).toEqual([]);
});

test("choosing Hindi renders the shell in Hindi", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose your language" })).toBeVisible({ timeout: 10_000 });
  await page.getByText("हिन्दी", { exact: false }).first().click();
  /* The choice applies when Continue is pressed — from then on the UI is Hindi. */
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "छोड़ें" })).toBeVisible({ timeout: 10_000 });
});
