import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "./helpers.js";

test.describe("Farm Space Bridge Phase 5 — Dairy Operational Records Publishing E2E", () => {
  let mockSpace1;
  let activeSpace;
  let availableSpaces;
  let cloudMilkRecords;
  let cloudHealthEvents;

  test.beforeEach(async ({ context, page }) => {
    await blockExternal(context);
    await seedSignedIn(page);

    mockSpace1 = {
      id: "space-dairy-001",
      name: "Gauri Dairy Farm",
      description: "Collaborative dairy space",
      location: "Karnal, HR",
      status: "active",
      owner_user_id: "PW-TEST-UID-001",
      created_at: new Date().toISOString(),
      user_id: "PW-TEST-UID-001",
      role: "owner",
      permissions: [
        "farm.all",
        "farm.dairy.manage",
        "farm.dairy.record",
        "farm.settings.manage",
      ],
      joined_at: new Date().toISOString(),
      member_count: 1,
      modules: [
        { module_id: "farmSpaceTeam", enabled: true },
        { module_id: "dairyDashboard", enabled: true },
      ],
    };

    activeSpace = mockSpace1;
    availableSpaces = [mockSpace1];
    cloudMilkRecords = [];
    cloudHealthEvents = [];

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

      const { action, spaceId, payload } = body;

      if (action === "spaces.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: availableSpaces }),
        });
      }

      if (action === "spaces.get") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: activeSpace }),
        });
      }

      if (action === "members.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                id: "mem-001",
                space_id: activeSpace.id,
                user_id: "PW-TEST-UID-001",
                role: "owner",
                status: "active",
                name: "Farmer",
              },
            ],
          }),
        });
      }

      if (action === "modules.list") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: activeSpace.modules }),
        });
      }

      if (action === "bridge.previewDairyOps") {
        const targetId = spaceId || payload?.spaceId;
        const productions = payload?.productions || [];
        const events = payload?.events || [];

        const milkItems = productions.map((p) => {
          const clientUuid = String(p.id);
          const existing = cloudMilkRecords.find(
            (r) => r.client_uuid === clientUuid && r.space_id === targetId
          );

          if (!p.animalId) {
            return {
              clientUuid,
              animalId: "",
              animalName: "All Animals (Herd)",
              date: p.date,
              amYieldLitres: Number(p.amLitres || 0),
              pmYieldLitres: Number(p.pmLitres || 0),
              totalYieldLitres: Number(p.amLitres || 0) + Number(p.pmLitres || 0),
              status: "UNASSIGNED_ANIMAL",
              publishable: false,
              error: "Milk record has no assigned animal. Cloud Farm Space requires individual animal assignment.",
            };
          }

          if (existing) {
            return {
              clientUuid,
              animalId: p.animalId,
              animalName: "Kamdhenu",
              date: p.date,
              amYieldLitres: Number(p.amLitres || 0),
              pmYieldLitres: Number(p.pmLitres || 0),
              totalYieldLitres: Number(p.amLitres || 0) + Number(p.pmLitres || 0),
              status: "EXISTS_SAME",
              publishable: true,
            };
          }

          return {
            clientUuid,
            animalId: p.animalId,
            animalName: "Kamdhenu",
            date: p.date,
            amYieldLitres: Number(p.amLitres || 0),
            pmYieldLitres: Number(p.pmLitres || 0),
            totalYieldLitres: Number(p.amLitres || 0) + Number(p.pmLitres || 0),
            status: "NEW",
            publishable: true,
          };
        });

        const eventItems = events.map((ev) => {
          const clientUuid = String(ev.id);
          const existing = cloudHealthEvents.find(
            (e) => e.client_uuid === clientUuid && e.space_id === targetId
          );

          if (!ev.animalId) {
            return {
              clientUuid,
              animalId: "",
              animalName: "All Animals (Herd)",
              date: ev.date,
              type: ev.type,
              title: ev.note || ev.type,
              notes: ev.note,
              dueDate: ev.dueDate,
              status: "UNASSIGNED_ANIMAL",
              publishable: false,
              error: "Event has no assigned animal. Cloud health register requires individual animal assignment.",
            };
          }

          if (existing) {
            return {
              clientUuid,
              animalId: ev.animalId,
              animalName: "Kamdhenu",
              date: ev.date,
              type: ev.type,
              title: ev.note || ev.type,
              notes: ev.note,
              dueDate: ev.dueDate,
              status: "EXISTS_SAME",
              publishable: true,
            };
          }

          return {
            clientUuid,
            animalId: ev.animalId,
            animalName: "Kamdhenu",
            date: ev.date,
            type: ev.type,
            title: ev.note || ev.type,
            notes: ev.note,
            dueDate: ev.dueDate,
            status: "NEW",
            publishable: true,
          };
        });

        const milkNew = milkItems.filter((i) => i.status === "NEW").length;
        const milkSame = milkItems.filter((i) => i.status === "EXISTS_SAME").length;
        const milkBlocked = milkItems.filter((i) => !i.publishable).length;

        const eventNew = eventItems.filter((i) => i.status === "NEW").length;
        const eventSame = eventItems.filter((i) => i.status === "EXISTS_SAME").length;
        const eventBlocked = eventItems.filter((i) => !i.publishable).length;

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              spaceId: targetId,
              enterprise: "dairy",
              summary: {
                milk: {
                  total: productions.length,
                  newCount: milkNew,
                  sameCount: milkSame,
                  diffCount: 0,
                  conflictCount: 0,
                  blockedCount: milkBlocked,
                },
                events: {
                  total: events.length,
                  newCount: eventNew,
                  sameCount: eventSame,
                  diffCount: 0,
                  conflictCount: 0,
                  blockedCount: eventBlocked,
                },
              },
              milkItems,
              eventItems,
            },
          }),
        });
      }

      if (action === "bridge.publishDairyOps") {
        const targetId = spaceId || payload?.spaceId;
        const productions = payload?.productions || [];
        const events = payload?.events || [];

        const createdMilk = [];
        const skippedMilk = [];
        for (const p of productions) {
          const clientUuid = String(p.id);
          const existing = cloudMilkRecords.find((r) => r.client_uuid === clientUuid);
          if (!existing) {
            cloudMilkRecords.push({
              id: `cm-${clientUuid}`,
              space_id: targetId,
              client_uuid: clientUuid,
              record_date: p.date,
              unit: "L",
              total_yield_litres: Number(p.amLitres || 0) + Number(p.pmLitres || 0),
            });
            createdMilk.push({
              id: `cm-${clientUuid}`,
              clientUuid,
              date: p.date,
              unit: "L",
              yield: Number(p.amLitres || 0) + Number(p.pmLitres || 0),
            });
          } else {
            skippedMilk.push({ clientUuid, date: p.date, reason: "already_synced" });
          }
        }

        const createdEvents = [];
        const skippedEvents = [];
        for (const ev of events) {
          const clientUuid = String(ev.id);
          const existing = cloudHealthEvents.find((e) => e.client_uuid === clientUuid);
          if (!existing) {
            cloudHealthEvents.push({
              id: `ce-${clientUuid}`,
              space_id: targetId,
              client_uuid: clientUuid,
              event_date: ev.date,
              event_type: ev.type,
              title: ev.note || ev.type,
            });
            createdEvents.push({
              id: `ce-${clientUuid}`,
              clientUuid,
              date: ev.date,
              type: ev.type,
              title: ev.note || ev.type,
            });
          } else {
            skippedEvents.push({ clientUuid, type: ev.type, reason: "already_synced" });
          }
        }

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              success: true,
              spaceId: targetId,
              enterprise: "dairy",
              milk: { created: createdMilk, updated: [], skipped: skippedMilk },
              events: { created: createdEvents, updated: [], skipped: skippedEvents },
            },
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

  test("dairy operations bridge flow: domain tab, unit banner, preview reconciliation, publish, and idempotency", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);

    // 1. Seed local ERP dairy operational records in IndexedDB database "agrios-livestock"
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        const req = indexedDB.open("agrios-livestock", 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("animals")) {
            const s = db.createObjectStore("animals", { keyPath: "id" });
            s.createIndex("enterprise", "enterprise", { unique: false });
          }
          if (!db.objectStoreNames.contains("productions")) {
            const s = db.createObjectStore("productions", { keyPath: "id" });
            s.createIndex("animalId", "animalId", { unique: false });
            s.createIndex("enterprise", "enterprise", { unique: false });
            s.createIndex("date", "date", { unique: false });
          }
          if (!db.objectStoreNames.contains("events")) {
            const s = db.createObjectStore("events", { keyPath: "id" });
            s.createIndex("animalId", "animalId", { unique: false });
            s.createIndex("enterprise", "enterprise", { unique: false });
            s.createIndex("date", "date", { unique: false });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(["animals", "productions", "events"], "readwrite");

          // Seed animal
          tx.objectStore("animals").put({
            id: "dairy-cow-1",
            name: "Kamdhenu",
            enterprise: "dairy",
            type: "cow",
            tagNo: "TAG-K1",
            createdAt: new Date().toISOString(),
          });

          // Seed productions
          const prodStore = tx.objectStore("productions");
          prodStore.put({
            id: "milk-local-1",
            animalId: "dairy-cow-1",
            enterprise: "dairy",
            date: "2026-10-01",
            amLitres: 12.5,
            pmLitres: 8.5,
          });
          prodStore.put({
            id: "milk-local-2",
            animalId: "dairy-cow-1",
            enterprise: "dairy",
            date: "2026-10-02",
            amLitres: 10.0,
            pmLitres: 6.0,
          });

          // Seed events
          const evStore = tx.objectStore("events");
          evStore.put({
            id: "ev-local-1",
            animalId: "dairy-cow-1",
            enterprise: "dairy",
            date: "2026-10-01",
            type: "vaccination",
            note: "Anthrax booster",
            dueDate: "2027-10-01",
          });
          evStore.put({
            id: "ev-local-2",
            animalId: "",
            enterprise: "dairy",
            date: "2026-10-02",
            type: "treatment",
            note: "Unassigned herd treatment",
          });

          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    // 2. Navigate to Farm Space Hub
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await expect(page.getByText("My Farm Space")).toBeVisible();
    await expect(page.getByText("Gauri Dairy Farm")).toBeVisible();

    // 3. Open Farm Space Settings & Bridge Local Data modal
    const settingsCard = page.getByText("Farm Space settings");
    await expect(settingsCard).toBeVisible();
    await settingsCard.click();

    const bridgeBtn = page.getByTestId("bridge-erp-btn");
    await expect(bridgeBtn).toBeVisible();
    await bridgeBtn.click();

    const dialog = page.getByTestId("bridge-modal-dialog");
    await expect(dialog).toBeVisible();

    // 4. Verify Domain Tabs exist and switch to Dairy Operations
    const tabsContainer = page.getByTestId("bridge-domain-tabs");
    await expect(tabsContainer).toBeVisible();
    const dairyOpsTab = page.getByTestId("bridge-tab-dairy_ops");
    await expect(dairyOpsTab).toBeVisible();
    await dairyOpsTab.click();

    // 5. Verify Unit Disclosure Banner
    await expect(
      page.getByText(/Milk quantities preserved in Litres \(L\)/i)
    ).toBeVisible();

    // 6. Verify Milk Logs and Veterinary Health Events sections
    await expect(page.getByTestId("milk-item-milk-local-1")).toBeVisible();
    await expect(page.getByTestId("milk-item-milk-local-2")).toBeVisible();
    await expect(page.getByTestId("event-item-ev-local-1")).toBeVisible();
    await expect(page.getByTestId("event-item-ev-local-2")).toBeVisible();

    // Verify unassigned event is marked as UNASSIGNED ANIMAL
    const unassignedEvent = page.getByTestId("event-item-ev-local-2");
    await expect(unassignedEvent.getByText(/UNASSIGNED ANIMAL/i)).toBeVisible();

    // 7. Verify Publish Selected button reflects valid publishable selections
    // 2 milk items + 1 valid event = 3 publishable items selected by default
    const publishBtn = page.getByRole("button", { name: /Publish Selected/ });
    await expect(publishBtn).toBeVisible();
    await expect(publishBtn).toHaveText(/Publish Selected \(3\)/);
    await publishBtn.click();

    // 8. Verify Confirmation view
    const confirmView = page.getByTestId("bridge-confirm-view");
    await expect(confirmView).toBeVisible();
    await expect(
      page.getByText(/You are about to publish 3 selected local operational record\(s\)/i)
    ).toBeVisible();

    // 9. Confirm & Publish
    const confirmBtn = page.getByRole("button", { name: /Confirm & Publish/ });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 10. Verify Success Result view
    const resultView = page.getByTestId("bridge-result-view");
    await expect(resultView).toBeVisible();
    await expect(page.getByText(/Bridge Complete/i)).toBeVisible();

    // 11. Click Done and reopen modal to test idempotency
    const doneBtn = page.getByRole("button", { name: /Done/ });
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();
    await expect(dialog).not.toBeVisible();

    // Reopen modal and switch back to Dairy Operations tab
    await bridgeBtn.click();
    await expect(dialog).toBeVisible();
    await page.getByTestId("bridge-tab-dairy_ops").click();

    // The previously published records should now be classified as UNCHANGED
    const milkItem1 = page.getByTestId("milk-item-milk-local-1");
    await expect(milkItem1).toBeVisible();
    await expect(milkItem1.getByText("UNCHANGED")).toBeVisible();

    const evItem1 = page.getByTestId("event-item-ev-local-1");
    await expect(evItem1).toBeVisible();
    await expect(evItem1.getByText("UNCHANGED")).toBeVisible();

    // Close modal
    await page.getByRole("button", { name: /Close/i }).click();
    await expect(dialog).not.toBeVisible();

    expect(realErrors(errors)).toHaveLength(0);
  });
});
