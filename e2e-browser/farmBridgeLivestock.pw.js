import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "./helpers.js";

test.describe("Farm Space Bridge Phase 2 — Livestock Herd Publishing E2E", () => {
  let mockSpace1;
  let mockSpace2;
  let activeSpace;
  let availableSpaces;
  let cloudAnimals;

  test.beforeEach(async ({ context, page }) => {
    await blockExternal(context);
    await seedSignedIn(page);

    mockSpace1 = {
      id: "space-livestock-001",
      name: "Sunrise Agro Farm",
      description: "Primary livestock collaborative space",
      location: "Anand, GJ",
      status: "active",
      owner_user_id: "PW-TEST-UID-001",
      created_at: new Date().toISOString(),
      user_id: "PW-TEST-UID-001",
      role: "owner",
      permissions: [
        "farm.all",
        "farm.crop.manage",
        "farm.dairy.manage",
        "farm.goat.manage",
        "farm.pig.manage",
        "farm.settings.manage",
      ],
      joined_at: new Date().toISOString(),
      member_count: 1,
      modules: [
        { module_id: "farmSpaceTeam", enabled: true },
        { module_id: "cropDashboard", enabled: true },
        { module_id: "dairyDashboard", enabled: true },
        { module_id: "goatDashboard", enabled: true },
        { module_id: "pigDashboard", enabled: true },
      ],
    };

    mockSpace2 = {
      id: "space-livestock-002",
      name: "Western Pastures",
      description: "Secondary collaborative space",
      location: "Pune, MH",
      status: "active",
      owner_user_id: "PW-TEST-UID-001",
      created_at: new Date().toISOString(),
      user_id: "PW-TEST-UID-001",
      role: "owner",
      permissions: [
        "farm.all",
        "farm.dairy.manage",
        "farm.goat.manage",
        "farm.pig.manage",
      ],
      joined_at: new Date().toISOString(),
      member_count: 1,
      modules: [
        { module_id: "dairyDashboard", enabled: true },
        { module_id: "goatDashboard", enabled: true },
        { module_id: "pigDashboard", enabled: true },
      ],
    };

    activeSpace = mockSpace1;
    availableSpaces = [mockSpace1];
    cloudAnimals = [];

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
                name: "Livestock Tester",
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
            data: activeSpace.modules || [],
          }),
        });
      }

      if (action === "bridge.preview") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              spaceId: spaceId || payload?.spaceId,
              summary: { total: 0, newCount: 0, sameCount: 0, diffCount: 0, conflictCount: 0 },
              items: [],
            },
          }),
        });
      }

      if (action === "bridge.previewLivestock") {
        const targetId = spaceId || payload?.spaceId;
        const enterprise = payload?.enterprise || "dairy";
        const animals = payload?.animals || [];

        const items = animals.map((a) => {
          const clientUuid = String(a.id);
          const existingOther = cloudAnimals.find(
            (ca) => ca.client_uuid === clientUuid && ca.space_id !== targetId
          );
          if (existingOther) {
            return {
              clientUuid,
              name: a.name,
              status: "CONFLICT_OTHER_SPACE",
              error: "Animal is already linked to another Farm Space",
              local: {
                species: a.type || a.species || enterprise,
                breed: a.breed,
                tagId: a.tagNo,
                currentStatus: a.lactationStatus || "milking",
              },
              cloud: {
                id: existingOther.id,
                space_id: existingOther.space_id,
                name: existingOther.name,
              },
              diffs: [],
            };
          }

          const existing = cloudAnimals.find(
            (ca) => ca.client_uuid === clientUuid && ca.space_id === targetId
          );

          if (!existing) {
            return {
              clientUuid,
              name: a.name,
              status: "NEW",
              local: {
                species: a.type || a.species || enterprise,
                breed: a.breed,
                tagId: a.tagNo,
                currentStatus: a.lactationStatus || "milking",
              },
              cloud: null,
              diffs: [],
            };
          }

          const hasDiff = existing.name !== a.name;
          if (hasDiff) {
            return {
              clientUuid,
              name: a.name,
              status: "EXISTS_DIFF",
              local: {
                species: a.type || a.species || enterprise,
                breed: a.breed,
                tagId: a.tagNo,
                currentStatus: a.lactationStatus || "milking",
              },
              cloud: {
                id: existing.id,
                name: existing.name,
              },
              diffs: [{ field: "name", local: a.name, cloud: existing.name }],
            };
          }

          return {
            clientUuid,
            name: a.name,
            status: "EXISTS_SAME",
            local: {
              species: a.type || a.species || enterprise,
              breed: a.breed,
              tagId: a.tagNo,
              currentStatus: a.lactationStatus || "milking",
            },
            cloud: {
              id: existing.id,
              name: existing.name,
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
              enterprise,
              summary: { total: animals.length, newCount, sameCount, diffCount, conflictCount },
              items,
            },
          }),
        });
      }

      if (action === "bridge.publishLivestock") {
        const targetId = spaceId || payload?.spaceId;
        const enterprise = payload?.enterprise || "dairy";
        const animals = payload?.animals || [];
        const overwrite = !!payload?.overwrite;

        const created = [];
        const updated = [];
        const skipped = [];

        for (const a of animals) {
          const clientUuid = String(a.id);
          const existing = cloudAnimals.find(
            (ca) => ca.client_uuid === clientUuid && ca.space_id === targetId
          );

          if (!existing) {
            const newAnimal = {
              id: `ca-${clientUuid}`,
              space_id: targetId,
              client_uuid: clientUuid,
              name: a.name,
              enterprise,
              breed: a.breed,
              tag_id: a.tagNo,
            };
            cloudAnimals.push(newAnimal);
            created.push({ id: newAnimal.id, clientUuid, name: a.name });
          } else {
            const hasDiff = existing.name !== a.name;
            if (!hasDiff) {
              skipped.push({ id: existing.id, clientUuid, name: existing.name, reason: "already_synced" });
            } else if (overwrite) {
              existing.name = a.name;
              updated.push({ id: existing.id, clientUuid, name: a.name });
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
              enterprise,
              created,
              updated,
              skipped,
              total: animals.length,
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

  test("livestock bridge flow: domain tabs, preview, publish, and idempotency", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);

    // 1. Seed local ERP livestock records in IndexedDB
    await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open("agrios-livestock", 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("animals")) {
            const s = db.createObjectStore("animals", { keyPath: "id" });
            s.createIndex("enterprise", "enterprise", { unique: false });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("animals", "readwrite");
          const store = tx.objectStore("animals");
          store.put({
            id: "dairy-pw-1",
            name: "Gauri",
            enterprise: "dairy",
            type: "cow",
            breed: "Gir",
            tagNo: "TAG-G1",
            lactationStatus: "lactating",
            createdAt: new Date().toISOString(),
          });
          store.put({
            id: "goat-pw-1",
            name: "Champa",
            enterprise: "goat",
            gender: "female",
            ageMonths: 14,
            tagNo: "TAG-C1",
            createdAt: new Date().toISOString(),
          });
          store.put({
            id: "pig-pw-1",
            name: "Napoleon",
            enterprise: "pig",
            gender: "male",
            ageMonths: 10,
            tagNo: "TAG-N1",
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
    await expect(page.getByText("Sunrise Agro Farm")).toBeVisible();

    // 3. Open Farm Space Settings & Bridge Local Data modal
    const settingsCard = page.getByText("Farm Space settings");
    await expect(settingsCard).toBeVisible();
    await settingsCard.click();

    const bridgeBtn = page.getByTestId("bridge-erp-btn");
    await expect(bridgeBtn).toBeVisible();
    await bridgeBtn.click();

    const dialog = page.getByTestId("bridge-modal-dialog");
    await expect(dialog).toBeVisible();

    // 4. Verify Domain Tabs exist
    const tabsContainer = page.getByTestId("bridge-domain-tabs");
    await expect(tabsContainer).toBeVisible();
    await expect(page.getByTestId("bridge-tab-parcels")).toBeVisible();
    await expect(page.getByTestId("bridge-tab-dairy")).toBeVisible();
    await expect(page.getByTestId("bridge-tab-goat")).toBeVisible();
    await expect(page.getByTestId("bridge-tab-pig")).toBeVisible();

    // 5. Switch to Dairy Herd tab
    await page.getByTestId("bridge-tab-dairy").click();

    // Verify Dairy animal "Gauri" is displayed with NEW badge
    await expect(page.getByTestId("parcel-item-dairy-pw-1")).toBeVisible();
    await expect(page.getByText("Gauri")).toBeVisible();
    await expect(page.getByText("#TAG-G1")).toBeVisible();

    // 6. Click Publish Selected (1)
    const publishBtn = page.getByRole("button", { name: /Publish Selected/ });
    await expect(publishBtn).toBeVisible();
    await expect(publishBtn).toHaveText(/Publish Selected \(1\)/);
    await publishBtn.click();

    // 7. Verify Confirmation view
    const confirmView = page.getByTestId("bridge-confirm-view");
    await expect(confirmView).toBeVisible();
    await expect(page.getByText(/You are about to publish 1 selected local animal\(s\)/i)).toBeVisible();

    // 8. Confirm Publish
    const confirmBtn = page.getByRole("button", { name: /Confirm & Publish/ });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 9. Verify Success Result view
    const resultView = page.getByTestId("bridge-result-view");
    await expect(resultView).toBeVisible();
    await expect(page.getByText(/Bridge Complete/i)).toBeVisible();

    // 10. Click Done and reopen modal to test idempotency
    const doneBtn = page.getByRole("button", { name: /Done/ });
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();
    await expect(dialog).not.toBeVisible();

    // Reopen modal and switch back to Dairy tab
    await bridgeBtn.click();
    await expect(dialog).toBeVisible();
    await page.getByTestId("bridge-tab-dairy").click();

    // Gauri should now be classified as UNCHANGED
    const gauriItem = page.getByTestId("parcel-item-dairy-pw-1");
    await expect(gauriItem).toBeVisible();
    await expect(gauriItem.getByText("UNCHANGED")).toBeVisible();

    // 11. Switch to Goats & Sheep tab and publish Champa
    await page.getByTestId("bridge-tab-goat").click();
    await expect(page.getByTestId("parcel-item-goat-pw-1")).toBeVisible();
    await expect(page.getByText("Champa")).toBeVisible();
    await publishBtn.click();
    await expect(confirmView).toBeVisible();
    await page.getByRole("button", { name: /Confirm & Publish/ }).click();
    await expect(resultView).toBeVisible();
    await page.getByRole("button", { name: /Done/ }).click();

    // 12. Switch to Swine / Pigs tab and publish Napoleon
    await bridgeBtn.click();
    await expect(dialog).toBeVisible();
    await page.getByTestId("bridge-tab-pig").click();
    await expect(page.getByTestId("parcel-item-pig-pw-1")).toBeVisible();
    await expect(page.getByText("Napoleon")).toBeVisible();
    await publishBtn.click();
    await expect(confirmView).toBeVisible();
    await page.getByRole("button", { name: /Confirm & Publish/ }).click();
    await expect(resultView).toBeVisible();
    await page.getByRole("button", { name: /Done/ }).click();

    expect(realErrors(errors)).toHaveLength(0);
  });
});
