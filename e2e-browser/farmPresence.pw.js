import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "./helpers.js";

test.describe("Farm Space Phase 4 — Collaboration & Team Presence E2E Suite", () => {
  let spaceA;
  let membersList;
  let activitiesList;
  let conversationsList;
  let dmConversation;

  test.beforeEach(async ({ context, page }) => {
    await blockExternal(context);
    await seedSignedIn(page);

    const now = Date.now();

    await page.addInitScript(() => {
      localStorage.setItem("agrios:farm:activeSpace", JSON.stringify("space-presence-001"));
    });

    spaceA = {
      id: "space-presence-001",
      name: "Presence Valley Farm",
      description: "Farm space for testing collaboration presence",
      photo_url: null,
      location: "Bengaluru, KA",
      status: "active",
      owner_user_id: "PW-TEST-UID-001",
      configuration_version: 1,
      created_at: new Date(now - 3600000).toISOString(),
      user_id: "PW-TEST-UID-001",
      role: "owner",
      permissions: ["farm.all"],
      joined_at: new Date(now - 3600000).toISOString(),
      member_count: 3,
    };

    membersList = [
      {
        id: "mem-001",
        user_id: "PW-TEST-UID-001",
        name: "Tester Owner",
        phone: "9876543210",
        agrios_user_id: "AGRI-OWNER-001",
        role: "owner",
        status: "active",
        joined_at: new Date(now - 86400000).toISOString(),
        last_seen_at: new Date(now - 10000).toISOString(), // Online (< 90s)
      },
      {
        id: "mem-002",
        user_id: "user-peer-002",
        name: "Priya Sharma",
        phone: "9876543211",
        agrios_user_id: "AGRI-WORKER-002",
        role: "worker",
        status: "active",
        joined_at: new Date(now - 86400000).toISOString(),
        last_seen_at: new Date(now - 10 * 60000).toISOString(), // Recent (~10m ago)
      },
      {
        id: "mem-003",
        user_id: "user-peer-003",
        name: "Amit Patel",
        phone: "9876543212",
        agrios_user_id: "AGRI-WORKER-003",
        role: "worker",
        status: "active",
        joined_at: new Date(now - 86400000).toISOString(),
        last_seen_at: null, // Offline
      },
    ];

    activitiesList = [
      {
        action: "task.completed",
        actor_name: "Priya Sharma",
        created_at: new Date(now - 5 * 60000).toISOString(),
        meta: { title: "Morning Feed" },
      },
      {
        action: "announcement.created",
        actor_name: "Tester Owner",
        created_at: new Date(now - 20 * 60000).toISOString(),
        meta: { title: "Heavy rain expected" },
      },
      {
        action: "attendance.marked",
        actor_name: "Amit Patel",
        created_at: new Date(now - 2 * 3600000).toISOString(),
      },
    ];

    conversationsList = [
      {
        id: "conv-dm-001",
        space_id: spaceA.id,
        other_user_id: "user-peer-002",
        other_name: "Priya Sharma",
        other_display_name: "Priya Sharma",
        other_is_online: true,
        other_last_seen_at: new Date(now - 20000).toISOString(),
        unread_count: 0,
        created_at: new Date(now - 60000).toISOString(),
        updated_at: new Date().toISOString(),
        last_message: {
          body: "Checked the nursery today",
          attachments: [],
          created_at: new Date(now - 60000).toISOString(),
          mine: false,
          deleted: false,
        },
      },
    ];

    dmConversation = {
      id: "conv-dm-001",
      space_id: spaceA.id,
      other_user_id: "user-peer-002",
      other_display_name: "Priya Sharma",
      other_is_online: true,
      other_is_typing: false,
      other_last_seen_at: new Date(now - 20000).toISOString(),
      created_at: new Date(now - 60000).toISOString(),
    };

    await page.route("**/api/farm", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") return route.continue();

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
          body: JSON.stringify({ data: [spaceA] }),
        });
      }

      if (action === "spaces.modules.get") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              { module_id: "farmSpaceChat", enabled: true, sort_order: 0 },
              { module_id: "farmSpaceDmInbox", enabled: true, sort_order: 1 },
            ],
          }),
        });
      }

      if (action === "members.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: membersList }),
        });
      }

      if (action === "activity.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: activitiesList }),
        });
      }

      if (action === "farm.unreadCounts") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { chatUnread: 0, dmUnread: 0 } }),
        });
      }

      if (action === "chat.list") {
        if (payload?.includeTyping) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                messages: [],
                typing_members: [],
              },
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        });
      }

      if (action === "chat.pinned") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        });
      }

      if (action === "dm.conversations") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: conversationsList }),
        });
      }

      if (action === "dm.open") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: dmConversation }),
        });
      }

      if (action === "dm.list") {
        if (payload?.includeTyping) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                messages: [],
                other_is_typing: false,
              },
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });
  });

  test("1. Farm Space Team roster displays presence dots, relative labels and details sheet", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("Presence Valley Farm")).toBeVisible();

    // Navigate to Team
    await page.getByRole("button", { name: "Team", exact: true }).click();
    await expect(page.getByText("Tester Owner").first()).toBeVisible();
    await expect(page.getByText("Priya Sharma").first()).toBeVisible();
    await expect(page.getByText("Amit Patel").first()).toBeVisible();

    // 1. Verify Online member has presence badge and dot
    const ownerBadge = page.getByTestId("presence-badge-PW-TEST-UID-001");
    await expect(ownerBadge).toBeVisible();
    await expect(ownerBadge).toContainText("Online");

    // 2. Verify Recently Active member has relative label
    const priyaBadge = page.getByTestId("presence-badge-user-peer-002");
    await expect(priyaBadge).toBeVisible();
    await expect(priyaBadge).toContainText("Active 10m ago");

    // 3. Verify Offline member has Offline label
    const amitBadge = page.getByTestId("presence-badge-user-peer-003");
    await expect(amitBadge).toBeVisible();
    await expect(amitBadge).toContainText("Offline");

    // 4. Open Member Details BottomSheet for Priya by clicking her roster row
    await page.getByRole("button", { name: /Priya Sharma/ }).first().click();
    await expect(page.getByTestId("member-details-presence-badge")).toBeVisible();
    await expect(page.getByTestId("member-details-presence-badge")).toContainText("Active 10m ago");
    await expect(page.getByTestId("member-details-last-seen")).toContainText("Active 10m ago");

    expect(realErrors(errors)).toEqual([]);
  });

  test("2. Farm Space Group Chat displays active member count indicator in header", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("Presence Valley Farm")).toBeVisible();

    // Navigate to Chat
    await page.getByText("Farm chat").first().click();
    await expect(page.getByTestId("chat-presence-indicator")).toBeVisible();
    // 1 member is currently online (< 90s)
    await expect(page.getByTestId("chat-online-count")).toContainText("1 active now");

    expect(realErrors(errors)).toEqual([]);
  });

  test("3. Farm Space Direct Message displays Online pill and resets on recipient change", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("Presence Valley Farm")).toBeVisible();

    // Open Direct Messages
    await page.getByText("Direct messages").first().click();
    await expect(page.getByText("Priya Sharma")).toBeVisible();

    // Click conversation with Priya
    await page.getByText("Priya Sharma").click();
    await expect(page.getByTestId("dm-online-pill")).toBeVisible();
    await expect(page.getByTestId("dm-online-pill")).toContainText("Online");

    expect(realErrors(errors)).toEqual([]);
  });

  test("4. Farm Space Hub surfaces Recent Team Activity Card in reverse chronological order", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("Presence Valley Farm")).toBeVisible();

    // Verify Recent Team Activity card
    await expect(page.getByText("Recent Team Activity")).toBeVisible();
    await expect(page.getByTestId("recent-team-activity-list")).toBeVisible();

    // Verify first event is most recent: task.completed by Priya Sharma
    const firstItem = page.getByTestId("activity-item-0");
    await expect(firstItem).toContainText("Priya Sharma");
    await expect(firstItem).toContainText("completed a task");
    await expect(firstItem).toContainText("Morning Feed");
    await expect(firstItem).toContainText("5m ago");

    // Click "View all" to navigate to full Activity screen
    await page.getByTestId("view-all-activity-btn").click();
    await expect(page.getByText("Activity").first()).toBeVisible();
    await expect(page.getByText("completed a task").first()).toBeVisible();

    expect(realErrors(errors)).toEqual([]);
  });
});
