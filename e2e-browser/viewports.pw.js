/* Tier-2: viewport sweep across the small-phone range the user base actually
   carries. The page body must never scroll horizontally (the QA brief's
   mobile-responsiveness requirement), on the boot screens and in the shell. */

import { test, expect } from "@playwright/test";
import { blockExternal, seedSignedIn, bootToHome } from "./helpers.js";

const WIDTHS = [320, 360, 390, 414];

const noHorizontalOverflow = async (page, label) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label}: horizontal overflow of ${overflow}px`).toBeLessThanOrEqual(0);
};

for (const width of WIDTHS) {
  test(`no horizontal overflow at ${width}px — language screen and app shell`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 800 }, baseURL: "http://localhost:4173" });
    await blockExternal(context);

    /* First-run language screen. */
    const fresh = await context.newPage();
    await fresh.goto("/");
    await fresh.getByRole("heading", { name: "Choose your language" }).waitFor({ timeout: 10_000 });
    await noHorizontalOverflow(fresh, `${width}px language`);
    await fresh.close();

    /* Signed-in shell: Home, Services, Profile. */
    const page = await context.newPage();
    await seedSignedIn(page);
    await bootToHome(page);
    await noHorizontalOverflow(page, `${width}px home`);
    for (const tab of ["Services", "Profile"]) {
      await page.getByRole("tab", { name: tab }).click();
      await page.waitForTimeout(500); // let the lazy chunk paint
      await noHorizontalOverflow(page, `${width}px ${tab}`);
    }
    await context.close();
  });
}
