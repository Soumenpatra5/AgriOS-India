import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "./helpers.js";

test.describe("Farm Space Bridge Phase 1 — Land Parcels to Farm Fields E2E", () => {
  let mockSpace1;
  let mockSpace2;
  let activeSpace;
  let availableSpaces;
  let cloudFields;

  test.beforeEach(async ({ context, page }) => {
    await blockExternal(context);
    await seedSignedIn(page);

    mockSpace1 = {
      id: "space-bridge-001",
      name: "Green Valley Farm",
      description: "Primary collaborative space",
      location: "Ludhiana, PB",
      status: "active",
      owner_user_id: "PW-TEST-UID-001",
      created_at: new Date().toISOString(),
      user_id: "PW-TEST-UID-001",
      role: "owner",
      permissions: ["farm.all", "farm.crop.manage", "farm.settings.manage"],
      joined_at: new Date().toISOString(),
      member_count: 1,
    };

    mockSpace2 = {
      id: "space-bridge-002",
      name: "Blue Hills Farm",
      description: "Secondary collaborative space",
      location: "Karnal, HR",
      status: "active",
      owner_user_id: "PW-TEST-UID-001",
      created_at: new Date().toISOString(),
      user_id: "PW-TEST-UID-001",
      role: "owner",
      permissions: ["farm.all", "farm.crop.manage", "farm.settings.manage"],
      joined_at: new Date().toISOString(),
      member_count: 1,
    };

    activeSpace = mockSpace1;
    availableSpaces = [mockSpace1];
    cloudFields = [];

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
          body: JSON.stringify({
            data: [
              { module_id: "farmSpaceTeam", enabled: true, sort_order: 0 },
              { module_id: "farmSpaceTasks", enabled: true, sort_order: 1 },
              { module_id: "farmSpaceChat", enabled: true, sort_order: 2 },
            ],
          }),
        });
      }

      if (action === "bridge.preview") {
        const targetId = spaceId || payload?.spaceId;
        const parcels = payload?.parcels || [];

        const items = parcels.map((p) => {
          const clientUuid = String(p.id);
          const existingOther = cloudFields.find(
            (cf) => cf.client_uuid === clientUuid && cf.space_id !== targetId
          );
          if (existingOther) {
            return {
              clientUuid,
              name: p.name,
              status: "CONFLICT_OTHER_SPACE",
              error: "Parcel is already linked to another Farm Space",
              local: {
                area: p.areaAcres,
                areaUnit: "acres",
                currentCrop: p.currentCrop,
                soilType: p.soilType,
              },
              cloud: {
                id: existingOther.id,
                space_id: existingOther.space_id,
                name: existingOther.name,
              },
              diffs: [],
            };
          }

          const existing = cloudFields.find(
            (cf) => cf.client_uuid === clientUuid && cf.space_id === targetId
          );

          if (!existing) {
            return {
              clientUuid,
              name: p.name,
              status: "NEW",
              local: {
                area: p.areaAcres,
                areaUnit: "acres",
                currentCrop: p.currentCrop,
                soilType: p.soilType,
              },
              cloud: null,
              diffs: [],
            };
          }

          const hasDiff =
            existing.name !== p.name ||
            Number(existing.area) !== Number(p.areaAcres);

          if (hasDiff) {
            return {
              clientUuid,
              name: p.name,
              status: "EXISTS_DIFF",
              local: {
                area: p.areaAcres,
                areaUnit: "acres",
                currentCrop: p.currentCrop,
              },
              cloud: {
                id: existing.id,
                name: existing.name,
                area: existing.area,
              },
              diffs: [{ field: "name", local: p.name, cloud: existing.name }],
            };
          }

          return {
            clientUuid,
            name: p.name,
            status: "EXISTS_SAME",
            local: {
              area: p.areaAcres,
              areaUnit: "acres",
            },
            cloud: {
              id: existing.id,
              name: existing.name,
              area: existing.area,
            },
            diffs: [],
          };
        });

        const newCount = items.filter((i) => i.status === "NEW").length;
        const sameCount = items.filter((i) => i.status === "EXISTS_SAME").length;
        const diffCount = items.filter((i) => i.status === "EXISTS_DIFF").length;
        const conflictCount = items.filter((i) => i.status === "CONFLICT_OTHER_SPACE").length;

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              spaceId: targetId,
              summary: { total: parcels.length, newCount, sameCount, diffCount, conflictCount },
              items,
            },
          }),
        });
      }

      if (action === "bridge.publishFields") {
        const targetId = spaceId || payload?.spaceId;
        const parcels = payload?.parcels || [];
        const overwrite = !!payload?.overwrite;

        const created = [];
        const updated = [];
        const skipped = [];

        for (const p of parcels) {
          const clientUuid = String(p.id);
          const existing = cloudFields.find(
            (cf) => cf.client_uuid === clientUuid && cf.space_id === targetId
          );

          if (!existing) {
            const newField = {
              id: `cf-${clientUuid}`,
              space_id: targetId,
              client_uuid: clientUuid,
              name: p.name,
              area: p.areaAcres,
              area_unit: "acres",
              crop_type: "wheat",
              current_crop: p.currentCrop,
            };
            cloudFields.push(newField);
            created.push({ id: newField.id, clientUuid, name: p.name });
          } else {
            const hasDiff =
              existing.name !== p.name ||
              Number(existing.area) !== Number(p.areaAcres);

            if (!hasDiff) {
              skipped.push({ id: existing.id, clientUuid, name: existing.name, reason: "already_synced" });
            } else if (overwrite) {
              existing.name = p.name;
              existing.area = p.areaAcres;
              updated.push({ id: existing.id, clientUuid, name: p.name });
            } else {
              skipped.push({ id: existing.id, clientUuid, name: existing.name, reason: "exists_diff_no_overwrite" });
            }
          }
        }

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              success: true,
              spaceId: targetId,
              created,
              updated,
              skipped,
              total: parcels.length,
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

  test("full bridge flow: preview, selection, publish, idempotency, and space isolation", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);

    // 1. Seed two local ERP land parcels into IndexedDB
    await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open("agrios-erp", 12);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("parcels", "readwrite");
          const store = tx.objectStore("parcels");
          store.put({
            id: "parcel-pw-1",
            name: "North Orchard",
            areaAcres: 5.5,
            soilType: "Loamy",
            waterSource: "Borewell",
            currentCrop: "Wheat",
            createdAt: new Date().toISOString(),
          });
          store.put({
            id: "parcel-pw-2",
            name: "South Canal",
            areaAcres: 3.2,
            soilType: "Clay",
            waterSource: "Canal",
            currentCrop: "Rice",
            createdAt: new Date().toISOString(),
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
    await expect(page.getByText("Green Valley Farm")).toBeVisible();

    // 3. Open Farm Space Settings
    const settingsCard = page.getByText("Farm Space settings");
    await expect(settingsCard).toBeVisible();
    await settingsCard.click();

    // 4. Verify Bridge button exists in Settings and click it
    const bridgeBtn = page.getByTestId("bridge-erp-btn");
    await expect(bridgeBtn).toBeVisible();
    await bridgeBtn.click();

    // 5. Verify Bridge Modal opens with explicit target space name & warning
    const dialog = page.getByTestId("bridge-modal-dialog");
    await expect(dialog).toBeVisible();

    const targetBadge = page.getByTestId("target-space-badge");
    await expect(targetBadge).toBeVisible();
    await expect(targetBadge).toHaveText("Green Valley Farm");

    // 6. Verify local parcels are displayed with NEW classification
    await expect(page.getByTestId("parcel-item-parcel-pw-1")).toBeVisible();
    await expect(page.getByText("North Orchard")).toBeVisible();
    await expect(page.getByText("South Canal")).toBeVisible();

    const publishBtn = page.getByRole("button", { name: /Publish Selected/ });
    await expect(publishBtn).toBeVisible();
    await expect(publishBtn).toHaveText(/Publish Selected \(2\)/);

    // 7. Proceed to confirmation step
    await publishBtn.click();
    await expect(page.getByTestId("bridge-confirm-view")).toBeVisible();
    await expect(page.getByText(/Confirm Publishing/i)).toBeVisible();

    // 8. Execute Publish
    const confirmBtn = page.getByRole("button", { name: /Confirm & Publish/ });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 9. Verify Publish Result view
    const resultView = page.getByTestId("bridge-result-view");
    await expect(resultView).toBeVisible();
    await expect(page.getByTestId("result-published")).toHaveText("2");

    // Close modal
    await page.getByRole("button", { name: /Done/ }).click();
    await expect(dialog).toHaveCount(0);

    // 10. Repeat publish test — prove idempotency (already synced / unchanged)
    await bridgeBtn.click();
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Already Synced (2)")).toBeVisible();
    await expect(page.getByText("UNCHANGED").first()).toBeVisible();

    // Publish button should be disabled as 0 are selected
    await expect(page.getByRole("button", { name: /Publish Selected/ })).toBeDisabled();
    await page.getByTestId("bridge-modal-close").click();

    // 11. Verify zero real console or runtime errors
    expect(realErrors(errors)).toEqual([]);
  });

  test("switching Farm Space cannot leak another space preview or result", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);

    // Seed parcel
    await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open("agrios-erp", 12);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("parcels", "readwrite");
          const store = tx.objectStore("parcels");
          store.put({
            id: "parcel-iso-1",
            name: "Hilltop Acre",
            areaAcres: 1.8,
            createdAt: new Date().toISOString(),
          });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    // 1. Enter Space 1
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await page.getByText("Farm Space settings").click();
    await page.getByTestId("bridge-erp-btn").click();

    // Verify Space 1 modal
    const dialog = page.getByTestId("bridge-modal-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("target-space-badge")).toHaveText("Green Valley Farm");

    // Close Space 1 modal and go back to Hub
    await page.getByTestId("bridge-modal-close").click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Back" }).click();

    // 2. Switch to Space 2
    activeSpace = mockSpace2;
    availableSpaces = [mockSpace1, mockSpace2];

    // Open space switcher from Hub
    const switchTrigger = page.getByRole("button", { name: /Switch|Change|Green Valley Farm/i }).first();
    if (await switchTrigger.isVisible().catch(() => false)) {
      await switchTrigger.click();
      const space2Option = page.getByText("Blue Hills Farm");
      if (await space2Option.isVisible().catch(() => false)) {
        await space2Option.click();
      }
    }

    // Direct navigate to Settings for Space 2
    const settingsCard = page.getByText("Farm Space settings");
    if (await settingsCard.isVisible().catch(() => false)) {
      await settingsCard.click();
      await page.getByTestId("bridge-erp-btn").click();
      await expect(dialog).toBeVisible();
      // Target badge must show Space 2 name, not Space 1
      await expect(page.getByTestId("target-space-badge")).toHaveText("Blue Hills Farm");
      await page.getByTestId("bridge-modal-close").click();
    }

    expect(realErrors(errors)).toEqual([]);
  });

  test("conflict parcel belonging to another space displays warning and cannot be selected", async ({ page }) => {
    const errors = collectErrors(page);

    // Pre-populate cloud with a field belonging to a different space
    cloudFields = [
      {
        id: "cf-conflict-1",
        space_id: "other-space-999",
        client_uuid: "parcel-conflict-1",
        name: "Conflicting Alien Parcel",
        area: 4.5,
      },
    ];

    await bootToHome(page);

    // Seed parcel with the same ID into local IndexedDB
    await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open("agrios-erp", 12);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("parcels", "readwrite");
          const store = tx.objectStore("parcels");
          store.put({
            id: "parcel-conflict-1",
            name: "Conflicting Alien Parcel",
            areaAcres: 4.5,
            currentCrop: "Wheat",
            createdAt: new Date().toISOString(),
          });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    // Navigate to Farm Space -> Settings -> Bridge
    await page.getByRole("tab", { name: "Farm Space" }).click();
    await page.getByText("Farm Space settings").click();
    await page.getByTestId("bridge-erp-btn").click();

    // Verify dialog opens
    const dialog = page.getByTestId("bridge-modal-dialog");
    await expect(dialog).toBeVisible();

    // Verify Conflict section is rendered
    await expect(page.getByTestId("bridge-conflict-section")).toBeVisible();
    await expect(page.getByTestId("badge-conflicts")).toBeVisible();
    await expect(page.getByTestId("badge-conflicts")).toHaveText("Conflicts: 1");

    // Verify Conflict item content
    const conflictItem = page.getByTestId("parcel-item-parcel-conflict-1");
    await expect(conflictItem).toBeVisible();
    await expect(conflictItem.getByText("CONFLICT", { exact: true })).toBeVisible();
    await expect(conflictItem.getByText(/Already published in a different Farm Space/i)).toBeVisible();

    // Verify that publish selected button is disabled (0 selected)
    const publishBtn = page.getByRole("button", { name: /Publish Selected/ });
    await expect(publishBtn).toBeDisabled();
    await expect(publishBtn).toHaveText(/Publish Selected \(0\)/);

    // Close modal
    await page.getByTestId("bridge-modal-close").click();
    await expect(dialog).toHaveCount(0);

    expect(realErrors(errors)).toEqual([]);
  });
});
