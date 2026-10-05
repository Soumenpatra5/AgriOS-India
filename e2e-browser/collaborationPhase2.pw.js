import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "./helpers.js";

test.describe("Farm Space Collaboration Phase 2 — Browser E2E Suite", () => {
  let spaceA;
  let chatMessages;
  let dmMessages;
  let dmConversations;
  let typingChatMembers = [];
  let otherIsDmTyping = false;
  let tasksList = [];
  let lastSentMessage = null;

  test.beforeEach(async ({ context, page }) => {
    await blockExternal(context);
    await seedSignedIn(page);

    typingChatMembers = [];
    otherIsDmTyping = false;
    lastSentMessage = null;

    await page.addInitScript(() => {
      localStorage.setItem("agrios:farm:activeSpace", JSON.stringify("space-phase2-001"));
    });

    spaceA = {
      id: "space-phase2-001",
      name: "AgriOS Phase 2 Farm",
      description: "Phase 2 Collaboration test farm",
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

    tasksList = [
      {
        id: "task-001",
        space_id: spaceA.id,
        title: "Irrigate Block C",
        category: "field",
        status: "open",
        created_at: new Date().toISOString(),
        deleted_at: null,
      },
      {
        id: "task-002",
        space_id: spaceA.id,
        title: "Inspect feeder lines",
        category: "maintenance",
        status: "in_progress",
        created_at: new Date().toISOString(),
        deleted_at: null,
      },
    ];

    chatMessages = [
      {
        id: "msg-p2-001",
        space_id: spaceA.id,
        sender_user_id: "user-peer-002",
        sender_name: "Priya",
        body: "Welcome to our farm chat",
        attachments: [],
        mentions: [],
        reactions: [],
        created_at: new Date(Date.now() - 60000).toISOString(),
        updated_at: new Date(Date.now() - 60000).toISOString(),
        deleted: false,
      },
    ];

    dmConversations = [
      {
        id: "conv-p2-001",
        space_id: spaceA.id,
        other_user_id: "user-peer-002",
        other_name: "Priya",
        other_display_name: "Priya",
        other_is_online: true,
        other_is_typing: false,
        other_last_seen_at: new Date().toISOString(),
        unread_count: 0,
        created_at: new Date(Date.now() - 60000).toISOString(),
        updated_at: new Date().toISOString(),
        last_message: {
          body: "Direct conversation message",
          attachments: [],
          created_at: new Date().toISOString(),
          mine: false,
          deleted: false,
        },
      },
    ];

    dmMessages = [
      {
        id: "dm-msg-001",
        conversation_id: "conv-p2-001",
        sender_user_id: "user-peer-002",
        body: "Hello from Priya in DM",
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
              { module_id: "farmSpaceTasks", enabled: true, sort_order: 2 },
            ],
          }),
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
                messages: chatMessages,
                typing_members: typingChatMembers,
              },
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: chatMessages }),
        });
      }

      if (action === "chat.typing") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { success: true } }),
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
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { success: true } }),
        });
      }

      if (action === "chat.send") {
        lastSentMessage = {
          id: `msg-${Date.now()}`,
          space_id: spaceId,
          sender_user_id: "PW-TEST-UID-001",
          sender_name: "Me",
          body: payload.body,
          task_id: payload.taskId || null,
          task_title: payload.taskId ? tasksList.find((t) => t.id === payload.taskId)?.title : null,
          attachments: payload.attachments || [],
          mentions: payload.mentions || [],
          reactions: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted: false,
        };
        chatMessages.push(lastSentMessage);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: lastSentMessage }),
        });
      }

      if (action === "tasks.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: tasksList }),
        });
      }

      if (action === "dm.conversations") {
        const mapped = dmConversations.map((c) => ({
          ...c,
          other_is_typing: otherIsDmTyping,
        }));
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: mapped }),
        });
      }

      if (action === "dm.open") {
        const conv = dmConversations[0];
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              ...conv,
              other_is_typing: otherIsDmTyping,
            },
          }),
        });
      }

      if (action === "dm.list") {
        if (payload?.includeTyping) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                messages: dmMessages,
                other_is_typing: otherIsDmTyping,
              },
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: dmMessages }),
        });
      }

      if (action === "dm.typing") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { success: true } }),
        });
      }

      if (action === "dm.markRead") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { success: true } }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });
  });

  test("Chat Typing Indicator: shows peer typing indicator and clears when absent", async ({ page }) => {
    const errs = collectErrors(page);

    // Initial load: Priya is typing
    typingChatMembers = [{ user_id: "user-peer-002", name: "Priya" }];

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Phase 2 Farm")).toBeVisible();

    // Open Farm Chat
    await page.getByText("Farm chat").first().click();
    await expect(page.getByText("Welcome to our farm chat")).toBeVisible();

    // Typing indicator should appear
    await expect(page.locator("text=Priya is typing…")).toBeVisible({ timeout: 5000 });

    // Next poll: Priya stops typing
    typingChatMembers = [];
    // Fast-forward or wait for next poll (poll interval is 4s)
    await expect(page.locator("text=Priya is typing…")).not.toBeVisible({ timeout: 10000 });

    expect(realErrors(errs)).toEqual([]);
  });

  test("DM Typing Indicator: displays 'typing…' in AppBar subtitle when peer is typing in DM", async ({ page }) => {
    const errs = collectErrors(page);

    // Initial load: other is typing in DM
    otherIsDmTyping = true;

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Phase 2 Farm")).toBeVisible();

    // Open Direct Messages Inbox
    await page.getByText("Direct messages").click();
    await expect(page.getByText("Priya")).toBeVisible();

    // Click on Priya's conversation
    await page.getByText("Priya").click();
    await expect(page.getByText("Hello from Priya in DM")).toBeVisible();

    // Check AppBar subtitle displays "typing…"
    await expect(page.locator("text=typing…")).toBeVisible({ timeout: 5000 });

    // Peer stops typing
    otherIsDmTyping = false;
    await expect(page.locator("text=typing…")).not.toBeVisible({ timeout: 10000 });
    // Online indicator should now be displayed
    await expect(page.locator("text=Online")).toBeVisible({ timeout: 5000 });

    expect(realErrors(errs)).toEqual([]);
  });

  test("Task Linking: links task from picker, displays preview chip, sends message with task link", async ({ page }) => {
    const errs = collectErrors(page);

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Phase 2 Farm")).toBeVisible();

    // Open Farm Chat
    await page.getByText("Farm chat").first().click();
    await expect(page.getByText("Welcome to our farm chat")).toBeVisible();

    // Click attachment button (paperclip)
    await page.click("button[aria-label='Attach']");
    await page.waitForSelector("text=Link a task");

    // Click "Link a task"
    await page.click("button:has-text('Link a task')");
    await page.waitForSelector("text=Irrigate Block C");

    // Select the task
    await page.click("button:has-text('Irrigate Block C')");

    // Task preview chip appears above composer
    await expect(page.locator("text=Irrigate Block C").first()).toBeVisible();

    // Type a message in composer
    await page.fill("textarea[aria-label='Message']", "Assigned this task to team");

    // Send the message
    await page.click("button[aria-label='Send']");

    // Verify lastSentMessage payload included taskId
    await page.waitForTimeout(1000);
    expect(lastSentMessage).not.toBeNull();
    expect(lastSentMessage.task_id).toBe("task-001");
    expect(lastSentMessage.body).toBe("Assigned this task to team");

    // Task card renders in bubble
    await expect(page.locator("text=Linked Task").first()).toBeVisible();

    expect(realErrors(errs)).toEqual([]);
  });

  test("Interactive Task Card: renders linked task card in message bubble and navigates to tasks view on click", async ({ page }) => {
    const errs = collectErrors(page);

    // Pre-populate chat with a message that has a linked task
    chatMessages.push({
      id: "msg-p2-task-002",
      space_id: spaceA.id,
      sender_user_id: "user-peer-002",
      sender_name: "Priya",
      body: "Please review this irrigation task",
      task_id: "task-001",
      task_title: "Irrigate Block C",
      attachments: [],
      mentions: [],
      reactions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted: false,
    });

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Phase 2 Farm")).toBeVisible();

    // Open Farm Chat
    await page.getByText("Farm chat").first().click();
    await expect(page.getByText("Please review this irrigation task")).toBeVisible();

    // Linked task card should be rendered
    const taskCard = page.locator("button:has-text('Irrigate Block C')").first();
    await expect(taskCard).toBeVisible();

    // Clicking the task card navigates to farm tasks
    await taskCard.click();
    await expect(page.getByText("Farm tasks")).toBeVisible({ timeout: 5000 });

    expect(realErrors(errs)).toEqual([]);
  });

  test("Mention UX: displays '@ Mentioned you' badge and highlighted bubble for mentioned user", async ({ page }) => {
    const errs = collectErrors(page);

    // Pre-populate chat with a message mentioning the current user
    chatMessages.push({
      id: "msg-p2-mention-001",
      space_id: spaceA.id,
      sender_user_id: "user-peer-002",
      sender_name: "Priya",
      body: "Hey @Me please check the pump",
      task_id: null,
      task_title: null,
      attachments: [],
      mentions: ["PW-TEST-UID-001"], // current user's ID
      reactions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted: false,
    });

    await bootToHome(page);
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("AgriOS Phase 2 Farm")).toBeVisible();

    // Open Farm Chat
    await page.getByText("Farm chat").first().click();
    await expect(page.getByText("Hey @Me please check the pump")).toBeVisible();

    // Mention badge should be rendered
    await expect(page.locator("text=Mentioned you")).toBeVisible();

    expect(realErrors(errs)).toEqual([]);
  });
});
