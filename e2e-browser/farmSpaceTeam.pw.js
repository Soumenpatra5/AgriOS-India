import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "./helpers.js";

test.describe("Farm Space Team & Member Management Suite", () => {
  let mockSpace;
  let mockMembers;
  let mockPendingInvites;
  let mockMyInvites;

  test.beforeEach(async ({ context, page }) => {
    await blockExternal(context);
    await seedSignedIn(page);

    mockSpace = {
      id: "space-team-test-001",
      name: "AgriOS Test Farm",
      description: "Automated team test space",
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
      member_count: 3,
    };

    mockMembers = [
      {
        user_id: "PW-TEST-UID-001",
        role: "owner",
        status: "active",
        name: "Ramesh Owner",
        phone: "9000000001",
        agrios_user_id: "AGRI-OWNR1234",
        joined_at: "2026-01-15T10:00:00.000Z",
      },
      {
        user_id: "PW-MNGR-002",
        role: "manager",
        status: "active",
        name: "Suresh Manager",
        phone: "9876543211",
        agrios_user_id: "AGRI-MNGR5678",
        joined_at: "2026-02-20T11:00:00.000Z",
      },
      {
        user_id: "PW-WRKR-003",
        role: "worker",
        status: "active",
        name: "Amit Worker",
        phone: "9876543212",
        agrios_user_id: "AGRI-WRKR9012",
        joined_at: "2026-03-10T12:00:00.000Z",
      },
    ];

    mockPendingInvites = [];
    mockMyInvites = [];

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
          body: JSON.stringify({ data: mockMembers }),
        });
      }

      if (action === "members.pendingInvites") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: mockPendingInvites }),
        });
      }

      if (action === "invitations.mine") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: mockMyInvites }),
        });
      }

      if (action === "users.lookup") {
        const { agriosUserId } = payload || {};
        if (agriosUserId === "AGRI-NEWU3456") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                id: "PW-USER-004",
                name: "Sunil NewUser",
                agrios_user_id: "AGRI-NEWU3456",
              },
            }),
          });
        }
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "No AgriOS account has that User ID" } }),
        });
      }

      if (action === "members.invite") {
        const newInvite = {
          id: "inv-test-" + Date.now(),
          space_id: mockSpace.id,
          invited_user_id: "PW-USER-004",
          role: payload.role || "worker",
          status: "pending",
          token: "tok-test-1234567890",
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
          invited_name: "Sunil NewUser",
          agrios_user_id: payload.agriosUserId,
          space_name: mockSpace.name,
          invited_by_name: "Ramesh Owner",
        };
        mockPendingInvites.push(newInvite);
        mockMyInvites.push(newInvite);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: newInvite }),
        });
      }

      if (action === "members.setRole") {
        const target = mockMembers.find((m) => m.user_id === payload.userId);
        if (target) {
          target.role = payload.role;
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: target }),
          });
        }
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Member not found" } }),
        });
      }

      if (action === "members.remove") {
        mockMembers = mockMembers.filter((m) => m.user_id !== payload.userId);
        mockSpace.member_count = mockMembers.length;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { removed: true } }),
        });
      }

      if (action === "invitations.cancel") {
        mockPendingInvites = mockPendingInvites.filter((i) => i.id !== payload.invitationId);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { cancelled: true } }),
        });
      }

      // Default fallback
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });
  });

  test("team & member management complete lifecycle flow", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();

    // Verify Farm Space Hub rendered
    await expect(page.getByText("My Farm Space")).toBeVisible();
    await expect(page.getByText("AgriOS Test Farm")).toBeVisible();

    // 1. Open Farm Space Team
    const teamBtn = page.getByRole("button", { name: "Team", exact: true });
    await expect(teamBtn).toBeVisible();
    await teamBtn.click();

    // 2. Verify existing members render in roster
    await expect(page.getByRole("button", { name: /Ramesh Owner/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Suresh Manager/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Amit Worker/ })).toBeVisible();
    await expect(page.getByText("3 members")).toBeVisible();

    // 3. Search by member name
    const searchInput = page.getByPlaceholder(/Search by name/i);
    await searchInput.fill("Amit");
    await expect(page.getByRole("button", { name: /Amit Worker/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ramesh Owner/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Suresh Manager/ })).toHaveCount(0);
    await expect(page.getByText("1 of 3 members")).toBeVisible();

    // Clear search
    await searchInput.fill("");
    await expect(page.getByRole("button", { name: /Ramesh Owner/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Suresh Manager/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Amit Worker/ })).toBeVisible();

    // 4. Search by AgriOS ID
    await searchInput.fill("MNGR5678");
    await expect(page.getByRole("button", { name: /Suresh Manager/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Amit Worker/ })).toHaveCount(0);
    await searchInput.fill("");

    // 5. Filter by role
    await page.getByRole("button", { name: "Managers" }).click();
    await expect(page.getByRole("button", { name: /Suresh Manager/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Amit Worker/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Workers" }).click();
    await expect(page.getByRole("button", { name: /Amit Worker/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Suresh Manager/ })).toHaveCount(0);

    // Reset to "All"
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByRole("button", { name: /Ramesh Owner/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Suresh Manager/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Amit Worker/ })).toBeVisible();

    // Filter + Search Empty state
    await searchInput.fill("NonExistentPerson");
    await expect(page.getByText("No members found")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByRole("button", { name: /Amit Worker/ })).toBeVisible();

    // 6 & 7. Open member details BottomSheet & verify information
    await page.getByRole("button", { name: /Amit Worker/ }).click();
    const sheet = page.getByRole("dialog", { name: "Member details" });
    await expect(sheet).toBeVisible();

    // Verify role, AgriOS ID, phone, status
    await expect(sheet.getByText("Amit Worker")).toBeVisible();
    await expect(sheet.getByText("AGRI-WRKR9012")).toBeVisible();
    await expect(sheet.getByText("+91 9876543212")).toBeVisible();
    await expect(sheet.getByText("Active").first()).toBeVisible();

    // 8. Change role in Details BottomSheet
    const roleSelect = sheet.locator("select");
    await roleSelect.selectOption("supervisor");
    await expect(page.getByText("Role updated.")).toBeVisible();
    await expect(sheet.getByText("Supervisor").first()).toBeVisible();

    // Close details sheet
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Member details" })).toHaveCount(0);

    // 9. Invite a user using AgriOS ID lookup
    await page.getByRole("button", { name: "Invite" }).click();
    const inviteSheet = page.getByRole("dialog", { name: "Invite a member" });
    await expect(inviteSheet).toBeVisible();

    await inviteSheet.getByPlaceholder("AGRI-8F42K7M9").fill("AGRI-NEWU3456");
    await inviteSheet.getByRole("button", { name: "Find" }).click();

    // Confirms user lookup
    await expect(inviteSheet.getByText("Sunil NewUser")).toBeVisible();
    await expect(inviteSheet.getByText("AGRI-NEWU3456")).toBeVisible();

    // Send invitation
    await inviteSheet.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByText("Invitation sent to Sunil NewUser.")).toBeVisible();

    // 10. Verify pending invitation appears in Pending invitations card
    await expect(page.getByText("Pending invitations")).toBeVisible();
    await expect(page.getByText("Sunil NewUser", { exact: true })).toBeVisible();
    await expect(page.getByText(/AGRI-NEWU3456/)).toBeVisible();

    // 11. Remove member using confirmation Dialog
    const sureshRow = page.getByRole("button", { name: /Suresh Manager/ });
    const removeBtn = sureshRow.getByLabel("Remove member");
    await removeBtn.click();

    // Verify confirmation Dialog
    await expect(page.getByRole("alertdialog", { name: "Remove from Farm Space?" })).toBeVisible();
    await page.getByRole("button", { name: "Remove", exact: true }).click();

    // Verify toast and removal
    await expect(page.getByText("Suresh Manager removed.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Suresh Manager/ })).toHaveCount(0);
    await expect(page.getByText("2 members")).toBeVisible();

    // Verify no unexpected console errors
    expect(realErrors(errors)).toEqual([]);
  });

  test("supervisor read-only experience has no management controls", async ({ page }) => {
    const errors = collectErrors(page);

    // Switch space caller role to supervisor
    mockSpace.role = "supervisor";
    mockSpace.permissions = ["farm.members.view", "farm.tasks.view"];

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();

    // Open Team screen
    await page.getByRole("button", { name: "Team", exact: true }).click();

    // 1. Verify members render
    await expect(page.getByRole("button", { name: /Ramesh Owner/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Suresh Manager/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Amit Worker/ })).toBeVisible();

    // 2. Verify Invite button is NOT visible for supervisor
    await expect(page.getByRole("button", { name: "Invite" })).toHaveCount(0);

    // 3. Verify remove buttons are NOT visible on rows
    await expect(page.getByLabel("Remove member")).toHaveCount(0);

    // 4. Verify "Change a role" section is NOT visible
    await expect(page.getByText("Change a role")).toHaveCount(0);

    // 5. Open member details - verify read-only (no dropdown or remove button)
    await page.getByRole("button", { name: /Amit Worker/ }).click();
    const sheet = page.getByRole("dialog", { name: "Member details" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Amit Worker")).toBeVisible();
    await expect(sheet.getByText("AGRI-WRKR9012")).toBeVisible();
    await expect(sheet.getByText("Manage member")).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Remove member" })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Member details" })).toHaveCount(0);

    // Verify no console errors
    expect(realErrors(errors)).toEqual([]);
  });
});
