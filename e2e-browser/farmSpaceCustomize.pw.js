import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "./helpers.js";

test.describe("Farm Space Customization & Settings Suite", () => {
  let mockSpace;
  let mockModules;

  test.beforeEach(async ({ context, page }) => {
    await blockExternal(context);
    await seedSignedIn(page);

    mockSpace = {
      id: "space-test-custom-001",
      name: "AgriOS Test Farm",
      description: "Automated test space",
      photo_url: null,
      location: "Bengaluru, KA",
      status: "active",
      owner_user_id: "PW-TEST-UID-001",
      configuration_version: 1,
      created_at: new Date().toISOString(),
      user_id: "PW-TEST-UID-001",
      role: "owner",
      permissions: ["farm.all"],
      joined_at: new Date().toISOString(),
      member_count: 1,
    };

    // Exactly 7 authoritative core modules + 1 optional module (Poultry) = 8 active
    mockModules = [
      { module_id: "farmSpaceTeam", enabled: true, sort_order: 0 },
      { module_id: "farmSpaceTasks", enabled: true, sort_order: 1 },
      { module_id: "farmSpaceAttendance", enabled: true, sort_order: 2 },
      { module_id: "farmSpaceAnnouncements", enabled: true, sort_order: 3 },
      { module_id: "farmSpaceChat", enabled: true, sort_order: 4 },
      { module_id: "farmSpaceActivity", enabled: true, sort_order: 5 },
      { module_id: "farmSpaceNotifications", enabled: true, sort_order: 6 },
      { module_id: "poultryDashboard", enabled: true, sort_order: 7 },
    ];

    await page.route("**/api/farm", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        return route.continue();
      }

      let body;
      try {
        body = JSON.parse(request.postData() || "{}");
      } catch {
        body = {};
      }

      const { action, payload } = body;

      if (action === "spaces.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [mockSpace] }),
        });
      }

      if (action === "members.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                user_id: "PW-TEST-UID-001",
                role: "owner",
                status: "active",
                name: "Playwright Tester",
                phone: "9000000001",
              },
            ],
          }),
        });
      }

      if (action === "spaces.modules.get") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: mockModules }),
        });
      }

      if (action === "spaces.modules.update") {
        const { expected_version, orderedModuleIds } = payload || {};
        if (expected_version !== mockSpace.configuration_version) {
          return route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({ error: { message: "Configuration changed concurrently" } }),
          });
        }

        mockSpace.configuration_version += 1;
        mockModules = (orderedModuleIds || []).map((id, index) => ({
          module_id: id,
          enabled: true,
          sort_order: index,
        }));

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { configuration_version: mockSpace.configuration_version } }),
        });
      }

      // Default mock fallback for other farm actions
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });
  });

  test("customize farm space: enable, reorder, disable and persist modules with reactivity on Hub", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();

    // Verify Farm Space Hub rendered with active space
    await expect(page.getByText("My Farm Space")).toBeVisible();
    await expect(page.getByText("AgriOS Test Farm")).toBeVisible();

    // Verify initial state: Poultry is visible on Hub, Dairy is not
    await expect(page.getByText("Poultry", { exact: true })).toBeVisible();
    await expect(page.getByText("Dairy", { exact: true })).toHaveCount(0);

    // Verify Customize shortcut card is visible for authorized user
    const customizeCard = page.getByText("Customize Farm Space", { exact: true });
    await expect(customizeCard).toBeVisible();
    await customizeCard.click();

    // Wait for Customize screen to render
    // 7 core modules + 1 optional (Poultry) = 8 active
    await expect(page.getByText("Active Modules (8)")).toBeVisible();
    await expect(page.getByText("Available Modules (7)")).toBeVisible();

    // Core module should show "Required" badge and no disable button
    await expect(page.getByText("Required").first()).toBeVisible();

    // Test Reordering: Move Poultry up
    const movePoultryUp = page.getByRole("button", { name: "Move Poultry up" });
    await expect(movePoultryUp).toBeVisible();
    await movePoultryUp.click();

    // Find Poultry in Active Modules and disable it
    const disablePoultryBtn = page
      .locator('[data-module-id="poultryDashboard"]')
      .getByRole("button", { name: /Disable/i });
    await expect(disablePoultryBtn).toBeVisible();
    await disablePoultryBtn.click();

    // Active modules count decreased to 7, Available increased to 8
    await expect(page.getByText("Active Modules (7)")).toBeVisible();
    await expect(page.getByText("Available Modules (8)")).toBeVisible();

    // Enable Dairy from Available Modules
    const enableDairyBtn = page
      .locator('[data-module-id="dairyDashboard"]')
      .getByRole("button", { name: /Enable/i });
    await expect(enableDairyBtn).toBeVisible();
    await enableDairyBtn.click();

    // Active count back to 8, Available back to 7
    await expect(page.getByText("Active Modules (8)")).toBeVisible();
    await expect(page.getByText("Available Modules (7)")).toBeVisible();

    // Click Save Changes button
    const saveBtn = page.getByRole("button", { name: /Save Changes/i });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Verify success toast
    await expect(page.getByText("Changes saved.")).toBeVisible();

    // Screen pops back to Hub. Check updated list on Hub:
    // Dairy must now be visible, and Poultry must NOT be present
    await expect(page.getByText("Dairy", { exact: true })).toBeVisible();
    await expect(page.getByText("Poultry", { exact: true })).toHaveCount(0);

    // Browser reload persistence check:
    // A completely fresh document load must re-query the backend and preserve the configured modules
    await page.reload();
    await page.getByRole("tab", { name: "Home" }).waitFor({ timeout: 15_000 });
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("My Farm Space")).toBeVisible();
    await expect(page.getByText("AgriOS Test Farm")).toBeVisible();

    // Verify persisted configuration is still reflected after fresh reload
    await expect(page.getByText("Dairy", { exact: true })).toBeVisible();
    await expect(page.getByText("Poultry", { exact: true })).toHaveCount(0);

    expect(realErrors(errors)).toEqual([]);
  });

  test("Settings screen provides working Customize Modules navigation and dirty save state", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("My Farm Space")).toBeVisible();

    // Open Settings from Hub
    await page.getByText("Farm Space settings", { exact: true }).click();
    await expect(page.getByText("Customize Modules", { exact: true })).toBeVisible();
    await page.getByText("Customize Modules", { exact: true }).click();

    // Verify Customize screen opened from Settings shortcut
    await expect(page.getByText("Active Modules (8)")).toBeVisible();

    // Save Changes button is initially disabled because form is not dirty
    const saveBtn = page.getByRole("button", { name: /Save Changes/i });
    await expect(saveBtn).toBeDisabled();

    // Enabling a module makes the form dirty
    const enableFishBtn = page
      .locator("div")
      .filter({ hasText: /^Fish & AquaPond management, feed, water quality/ })
      .getByRole("button", { name: /Enable/i });
    await expect(enableFishBtn).toBeVisible();
    await enableFishBtn.click();

    // Now Save Changes is enabled
    await expect(saveBtn).toBeEnabled();

    expect(realErrors(errors)).toEqual([]);
  });
});
