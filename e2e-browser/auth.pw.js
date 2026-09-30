import { test, expect } from "@playwright/test";

test.describe("Firebase Auth Emulator", () => {
  test("Can sign in via phone OTP using emulator mocked custom token flow", async ({ page }) => {
    // 1. Open application and skip onboarding
    await page.goto("/");
    await page.getByRole("button", { name: "Continue" }).click({ timeout: 10_000 });
    await page.getByRole("button", { name: "Skip" }).click({ timeout: 10_000 });

    // 2. Reach Login screen
    // The screen defaults to step="main", we need to click "Continue with phone"
    await page.click("button:has-text(\"Continue with phone\")");

    // 3. Now we are on step="phone"
    const input = page.getByPlaceholder(/Mobile number|Email address/).first();
    await input.waitFor({ timeout: 15_000 });
    await input.fill("9999999999");
    
    // 4. Click Send on WhatsApp (hits mocked otpApi)
    await page.click('button:has-text("WhatsApp")', { force: true });

    // 5. Wait for OTP verify screen (input fields appear)
    await page.waitForSelector('input[inputmode="numeric"]', { timeout: 30000 });
    await page.waitForTimeout(500); // wait for OTP screen

    // 6. Fill dummy OTP
    await page.waitForTimeout(500);
    // Find the OTP inputs, which have inputMode="numeric" and maxLength={1}
    const otpInput = page.locator('input[inputmode="numeric"]').first();
    await otpInput.click();
    await page.keyboard.type("123456");

    // 7. Click Verify
    await expect(page.locator("button:has-text(\"Verify\")")).toBeEnabled({ timeout: 5000 });
    await page.click("button:has-text(\"Verify\")");

    // 8. Verify navigation to the authenticated application state
    await expect(page.getByRole("tab", { name: "Home" })).toBeVisible({ timeout: 15000 });
    
    // 8.5 Dismiss the Home screen feature tour if it appears
    const skipTourBtn = page.getByRole("button", { name: "Skip" }).first();
    await skipTourBtn.click({ timeout: 10000 });

    // 9. Verify logout
    await page.getByRole("tab", { name: "Profile" }).click();
    
    const logoutBtn = page.getByRole("button", { name: "Log out" }).first();
    await expect(logoutBtn).toBeVisible({ timeout: 10000 });
    await logoutBtn.click();
    
    // Wait for the confirmation dialog to appear
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    const confirmBtn = dialog.getByRole('button', { name: 'Log out' });
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();
    
    // 10. Verify logout returns user to unauthenticated state
    await expect(page.getByRole("button", { name: "Continue with phone" })).toBeVisible({ timeout: 15000 });
  });
});
