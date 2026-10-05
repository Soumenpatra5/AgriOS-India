import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "./helpers.js";

test.describe("Farm Space Collaboration State Layer — E2E Suite", () => {
  let spaceA, spaceB;
  let chatMessagesSpaceA;
  let dmMessagesSpaceA;
  let conversationsSpaceA;
  let chatUnreadCount;
  let dmUnreadCount;
  let chatMarkedThroughId = null;
  let dmMarkedThroughId = null;

  test.beforeEach(async ({ context, page }) => {
    await blockExternal(context);
    await seedSignedIn(page);

    chatMarkedThroughId = null;
    dmMarkedThroughId = null;
    chatUnreadCount = 2;
    dmUnreadCount = 1;

    await page.addInitScript(() => {
      localStorage.setItem("agrios:farm:activeSpace", JSON.stringify("space-collab-001"));
    });

    spaceA = {
      id: "space-collab-001",
      name: "AgriOS Collab Farm A",
      description: "Collaboration state farm A",
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
      member_count: 2,
    };

    spaceB = {
      id: "space-collab-002",
      name: "AgriOS Collab Farm B",
      description: "Collaboration state farm B",
      photo_url: null,
      location: "Mysuru, KA",
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

    chatMessagesSpaceA = [
      {
        id: "msg-chat-001",
        space_id: spaceA.id,
        sender_user_id: "user-peer-002",
        sender_name: "Priya",
        body: "First team message",
        attachments: [],
        mentions: [],
        reactions: [],
        created_at: new Date(Date.now() - 60000).toISOString(),
        updated_at: new Date(Date.now() - 60000).toISOString(),
        deleted: false,
      },
      {
        id: "msg-chat-002",
        space_id: spaceA.id,
        sender_user_id: "user-peer-002",
        sender_name: "Priya",
        body: "Second team message",
        attachments: [],
        mentions: [],
        reactions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: false,
      },
    ];

    conversationsSpaceA = [
      {
        id: "conv-dm-001",
        space_id: spaceA.id,
        other_user_id: "user-peer-002",
        other_name: "Priya",
        other_display_name: "Priya",
        other_is_online: true,
        other_last_seen_at: new Date().toISOString(),
        unread_count: 1,
        created_at: new Date(Date.now() - 60000).toISOString(),
        updated_at: new Date().toISOString(),
        last_message: {
          body: "Direct question for you",
          attachments: [],
          created_at: new Date().toISOString(),
          mine: false,
          deleted: false,
        },
      },
    ];

    dmMessagesSpaceA = [
      {
        id: "msg-dm-001",
        conversation_id: "conv-dm-001",
        sender_user_id: "user-peer-002",
        body: "Direct question for you",
        attachments: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: false,
      },
    ];

    await page.route("**/api/farm", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") return route.continue();

      let body;
      try {
        body = JSON.parse(request.postData() || "{}");
      } catch {
        body = {};
      }

      const { action, spaceId, payload } = body;

      if (action === "spaces.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [spaceA, spaceB] }),
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
              { module_id: "farmSpaceTasks", enabled: true, sort_order: 2 },
            ],
          }),
        });
      }

      if (action === "farm.unreadCounts") {
        if (spaceId === spaceB.id) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: { chatUnread: 0, dmUnread: 0 } }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { chatUnread: chatUnreadCount, dmUnread: dmUnreadCount } }),
        });
      }

      if (action === "chat.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: chatMessagesSpaceA }),
        });
      }

      if (action === "chat.pinned") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        });
      }

      if (action === "chat.markRead") {
        chatMarkedThroughId = payload?.throughMessageId;
        chatUnreadCount = 0;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { success: true } }),
        });
      }

      if (action === "dm.conversations") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: conversationsSpaceA }),
        });
      }

      if (action === "dm.open") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: conversationsSpaceA[0] }),
        });
      }

      if (action === "dm.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: dmMessagesSpaceA }),
        });
      }

      if (action === "dm.markRead") {
        dmMarkedThroughId = payload?.throughMessageId;
        dmUnreadCount = 0;
        conversationsSpaceA[0].unread_count = 0;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { success: true } }),
        });
      }

      if (action === "members.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              { user_id: "PW-TEST-UID-001", name: "Tester", role: "owner", status: "active" },
              { user_id: "user-peer-002", name: "Priya", role: "worker", status: "active", last_seen_at: new Date().toISOString() },
            ],
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });
  });

  test("1. Hub unread badges for Chat and DM clear on thread render, with DM conversation badges and presence", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Collab Farm A")).toBeVisible();

    // 1. Hub shows Chat and DM unread badges
    const chatBadge = page.getByTestId("unread-badge-farmSpaceChat");
    await expect(chatBadge).toBeVisible();
    await expect(chatBadge).toHaveText("2");

    const dmBadge = page.getByTestId("unread-badge-farmSpaceDmInbox");
    await expect(dmBadge).toBeVisible();
    await expect(dmBadge).toHaveText("1");

    // 2. Open Chat -> rendered messages -> chatMarkRead is sent with latest message ID
    await page.getByText("Farm chat").click();
    await expect(page.getByText("Second team message")).toBeVisible();

    // Verify chat.markRead was called with the latest rendered message ID
    await expect.poll(() => chatMarkedThroughId).toBe("msg-chat-002");

    // Return to Hub -> Chat badge is now cleared
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("unread-badge-farmSpaceChat")).toHaveCount(0);
    // DM badge is still visible
    await expect(page.getByTestId("unread-badge-farmSpaceDmInbox")).toBeVisible();

    // 3. Open DM Inbox -> Shows per-conversation unread badge & presence indicator
    await page.getByText("Direct messages").click();
    await expect(page.getByText("Priya")).toBeVisible();
    const convBadge = page.getByTestId("dm-unread-badge-conv-dm-001");
    await expect(convBadge).toBeVisible();
    await expect(convBadge).toHaveText("1");
    await expect(page.getByTestId("presence-online-indicator")).toBeVisible();

    // 4. Open DM conversation -> renders messages -> dmMarkRead is called
    await page.getByText("Priya").click();
    await expect(page.getByText("Direct question for you")).toBeVisible();
    await expect.poll(() => dmMarkedThroughId).toBe("msg-dm-001");
    await expect(page.getByText("Online")).toBeVisible();

    // Return to DM Inbox -> per-conversation badge is cleared
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("dm-unread-badge-conv-dm-001")).toHaveCount(0);

    // Return to Hub -> DM badge is also cleared
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("unread-badge-farmSpaceDmInbox")).toHaveCount(0);

    // Zero console errors
    expect(realErrors(errors)).toHaveLength(0);
  });

  test("2. New message arriving after rendered/read message remains unread", async ({ page }) => {
    const errors = collectErrors(page);

    // Initially 1 unread message
    chatUnreadCount = 1;
    chatMessagesSpaceA = [chatMessagesSpaceA[0]]; // Only msg-chat-001

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Collab Farm A")).toBeVisible();

    // Hub shows 1 unread
    const chatBadge = page.getByTestId("unread-badge-farmSpaceChat");
    await expect(chatBadge).toBeVisible();
    await expect(chatBadge).toHaveText("1");

    // Open Chat -> msg-chat-001 rendered and marked read
    await page.getByText("Farm chat").click();
    await expect(page.getByText("First team message")).toBeVisible();
    await expect.poll(() => chatMarkedThroughId).toBe("msg-chat-001");

    // A new message arrives while viewer is in chat or returning to hub
    const msg3 = {
      id: "msg-chat-003",
      space_id: spaceA.id,
      sender_user_id: "user-peer-002",
      sender_name: "Priya",
      body: "Unread follow-up message",
      attachments: [],
      mentions: [],
      reactions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted: false,
    };
    chatMessagesSpaceA.push(msg3);
    // Server now reports 1 new unread message arriving after msg-chat-001 cursor
    chatUnreadCount = 1;

    // Return to Hub -> new message arriving after cursor is reflected as 1 unread badge
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("unread-badge-farmSpaceChat")).toBeVisible();
    await expect(page.getByTestId("unread-badge-farmSpaceChat")).toHaveText("1");

    expect(realErrors(errors)).toHaveLength(0);
  });

  test("3. Switching Farm Spaces keeps unread counts strictly isolated", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Collab Farm A")).toBeVisible();

    // Space A has unreads: Chat (2), DM (1)
    await expect(page.getByTestId("unread-badge-farmSpaceChat")).toHaveText("2");
    await expect(page.getByTestId("unread-badge-farmSpaceDmInbox")).toHaveText("1");

    // Open Switcher by clicking the Space A card header button
    await page.getByText("AgriOS Collab Farm A").click();

    // Switch to Space B
    await expect(page.getByText("Select Farm Space")).toBeVisible();
    await page.getByText("AgriOS Collab Farm B").click();

    // Space B is now active and has 0 unreads -> badges are not rendered
    await expect(page.getByText("AgriOS Collab Farm B")).toBeVisible();
    await expect(page.getByTestId("unread-badge-farmSpaceChat")).toHaveCount(0);
    await expect(page.getByTestId("unread-badge-farmSpaceDmInbox")).toHaveCount(0);

    // Switch back to Space A
    await page.getByText("AgriOS Collab Farm B").click();
    await expect(page.getByText("Select Farm Space")).toBeVisible();
    await page.getByText("AgriOS Collab Farm A").click();

    // Space A is active again -> unreads reappear
    await expect(page.getByText("AgriOS Collab Farm A")).toBeVisible();
    await expect(page.getByTestId("unread-badge-farmSpaceChat")).toHaveText("2");
    await expect(page.getByTestId("unread-badge-farmSpaceDmInbox")).toHaveText("1");

    expect(realErrors(errors)).toHaveLength(0);
  });
});
