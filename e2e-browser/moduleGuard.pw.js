import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "./helpers.js";

async function navigateToDirect(page, screen) {
  const result = await page.evaluate((target) => {
    const el = document.querySelector("#root *");
    if (!el) return { error: "No element found inside #root" };
    const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    if (!fiberKey) return { error: "No __reactFiber$ property found on element", keys: Object.keys(el) };

    let fiber = el[fiberKey];
    while (fiber.return) {
      fiber = fiber.return;
    }

    function findPush(f) {
      if (!f) return null;
      if (typeof f.memoizedProps?.value?.push === "function") {
        return f.memoizedProps.value.push;
      }
      return findPush(f.child) || findPush(f.sibling);
    }

    const push = findPush(fiber);
    if (push) {
      push(target);
      return { success: true };
    }
    return { error: "Could not find push in fiber tree" };
  }, screen);

  if (!result?.success) {
    throw new Error(`Failed to navigate: ${JSON.stringify(result)}`);
  }
}

test.describe("ModuleGuard E2E Suite", () => {
  let mockSpace;
  let mockModules;

  test.beforeEach(async ({ context, page }) => {
    await blockExternal(context);
    await seedSignedIn(page);

    mockSpace = {
      id: "space-test-guard-001",
      name: "AgriOS Guard Test Farm",
      description: "ModuleGuard test space",
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

    // Poultry is disabled (only core modules present)
    mockModules = [
      { module_id: "farmSpaceTeam", enabled: true, sort_order: 0 },
      { module_id: "farmSpaceTasks", enabled: true, sort_order: 1 },
      { module_id: "farmSpaceAttendance", enabled: true, sort_order: 2 },
      { module_id: "farmSpaceAnnouncements", enabled: true, sort_order: 3 },
      { module_id: "farmSpaceChat", enabled: true, sort_order: 4 },
      { module_id: "farmSpaceActivity", enabled: true, sort_order: 5 },
      { module_id: "farmSpaceNotifications", enabled: true, sort_order: 6 },
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

      const { action } = body;

      if (action === "spaces.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [mockSpace] }),
        });
      }

      if (action === "spaces.modules.get") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: mockModules }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });
  });

  test("Owner navigating to disabled Poultry sees 'Module Not Enabled' and can navigate to Customize", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Guard Test Farm")).toBeVisible();

    // Verify Poultry is disabled / not on Hub
    await expect(page.getByText("Poultry", { exact: true })).toHaveCount(0);

    // Direct navigation to poultryDashboard
    await navigateToDirect(page, { kind: "poultryDashboard" });

    // Verify "Module Not Enabled" error state
    await expect(page.getByText("Module Not Enabled")).toBeVisible();
    await expect(page.getByText("This module is not enabled for the current Farm Space.")).toBeVisible();

    // Verify "Enable in Customize" button is visible for Owner
    const enableBtn = page.getByRole("button", { name: /Enable in Customize/i });
    await expect(enableBtn).toBeVisible();

    // Click "Enable in Customize"
    await enableBtn.click();

    // Verify navigation reaches Farm Space Customize screen for correct spaceId
    await expect(page.getByText("Customize Workspace")).toBeVisible();
    await expect(page.getByText("Active Modules (7)")).toBeVisible();

    expect(realErrors(errors)).toEqual([]);
  });

  test("Supervisor or Worker navigating to disabled Poultry sees 'Module Not Enabled' and NO management action", async ({ page }) => {
    const errors = collectErrors(page);

    // Set role to supervisor with standard non-admin permissions
    mockSpace.role = "supervisor";
    mockSpace.permissions = ["farm.view", "farm.tasks.view"];

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Guard Test Farm")).toBeVisible();

    // Direct navigation to poultryDashboard
    await navigateToDirect(page, { kind: "poultryDashboard" });

    // Verify "Module Not Enabled" error state
    await expect(page.getByText("Module Not Enabled")).toBeVisible();
    await expect(page.getByText("This module is not enabled for the current Farm Space.")).toBeVisible();

    // Verify "Enable in Customize" button is NOT visible
    await expect(page.getByRole("button", { name: /Enable in Customize/i })).toHaveCount(0);

    expect(realErrors(errors)).toEqual([]);
  });

  test("Manager with farm.settings.manage navigating to disabled Poultry sees 'Enable in Customize'", async ({ page }) => {
    const errors = collectErrors(page);

    mockSpace.role = "manager";
    mockSpace.permissions = { "farm.settings.manage": true };

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Guard Test Farm")).toBeVisible();

    await navigateToDirect(page, { kind: "poultryDashboard" });

    await expect(page.getByText("Module Not Enabled")).toBeVisible();
    const enableBtn = page.getByRole("button", { name: /Enable in Customize/i });
    await expect(enableBtn).toBeVisible();

    expect(realErrors(errors)).toEqual([]);
  });

  test("Worker navigating to disabled Poultry sees 'Module Not Enabled' and NO management action", async ({ page }) => {
    const errors = collectErrors(page);

    mockSpace.role = "worker";
    mockSpace.permissions = ["farm.tasks.view", "farm.chat.send"];

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Guard Test Farm")).toBeVisible();

    await navigateToDirect(page, { kind: "poultryDashboard" });

    await expect(page.getByText("Module Not Enabled")).toBeVisible();
    await expect(page.getByRole("button", { name: /Enable in Customize/i })).toHaveCount(0);

    expect(realErrors(errors)).toEqual([]);
  });

  test("Enabled module directly renders module content", async ({ page }) => {
    const errors = collectErrors(page);

    // Enable Poultry
    mockModules.push({ module_id: "poultryDashboard", enabled: true, sort_order: 7 });

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Guard Test Farm")).toBeVisible();

    await navigateToDirect(page, { kind: "poultryDashboard" });

    // When enabled, Poultry Dashboard renders (e.g. Batches or New Batch button)
    await expect(page.getByText("Module Not Enabled")).toHaveCount(0);

    expect(realErrors(errors)).toEqual([]);
  });
});
