const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('response', async (res) => {
    if (res.url().includes('/api/farm')) {
      console.log('NETWORK:', res.url(), res.status());
      try {
        console.log('BODY:', await res.text());
      } catch(e) {}
    }
  });

  try {
    await page.goto('http://localhost:5199');
    await page.addInitScript(() => {
      localStorage.setItem("agrios:lang", JSON.stringify("en"));
      localStorage.setItem("agrios:onboarded", "true");
      localStorage.setItem("agrios:tour_done", "true");
      localStorage.setItem("agrios:user", JSON.stringify({
        uid: "PW-TEST-UID-001",
        phone: "9000000001",
        name: "Playwright Tester",
        email: "",
        photo: "",
        provider: "phone",
        joined: 1700000000000,
      }));
    });
    // reload to apply
    await page.reload();
    await page.waitForLoadState('networkidle');
    console.log("On Home");

    // Click Farm tab
    await page.getByRole('tab', { name: 'Farm' }).click();
    await page.waitForTimeout(2000);
    console.log("DOM text:", await page.locator("body").innerText());

    // Save screenshot
    await page.screenshot({ path: 'farm_error.png' });
    console.log("Screenshot saved.");

    // Print DOM
    console.log("DOM:", await page.content());
    
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
