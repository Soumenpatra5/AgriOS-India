import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "../e2e-browser/helpers.js";

test.beforeEach(async ({ context, page }) => {
  await blockExternal(context);
  await seedSignedIn(page);
});

test("My Farm Space opens correctly", async ({ page }) => {
  const errors = collectErrors(page);
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('response', response => {
    if (response.url().includes('/api/farm')) {
      console.log('NETWORK:', response.url(), response.status());
    }
  });

  await bootToHome(page);
  console.log("At home");
  await page.getByRole("tab", { name: /Farm Space/i }).click();
  console.log("Clicked Farm tab");
  
  await page.waitForTimeout(2000);
  console.log("DOM text:", await page.locator("body").innerText());
});
