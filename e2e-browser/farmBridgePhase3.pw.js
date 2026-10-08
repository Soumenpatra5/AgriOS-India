import { test, expect } from "@playwright/test";
import { blockExternal, collectErrors, realErrors, seedSignedIn, bootToHome } from "./helpers.js";

test.describe("Farm Space Bridge Phase 3 — Flocks, Ponds & Apiaries Publishing E2E", () => {
  let mockSpace1;
  let activeSpace;
  let availableSpaces;
  let cloudRecords;

  test.beforeEach(async ({ context, page }) => {
    await blockExternal(context);
    await seedSignedIn(page);

    mockSpace1 = {
      id: "space-phase3-001",
      name: "Sunrise Agro Farm",
      description: "Primary enterprise collaborative space",
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
        "farm.poultry.manage",
        "farm.fish.manage",
        "farm.bee.manage",
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
        { module_id: "poultryDashboard", enabled: true },
        { module_id: "fishDashboard", enabled: true },
        { module_id: "beeDashboard", enabled: true },
      ],
    };

    activeSpace = mockSpace1;
    availableSpaces = [mockSpace1];
    cloudRecords = [];

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
                name: "Phase 3 Tester",
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
        const enterprise = payload?.enterprise || "poultry";
        const animals = payload?.animals || [];

        const items = animals.map((a) => {
          const clientUuid = String(a.id);
          const existing = cloudRecords.find(
            (cr) => cr.client_uuid === clientUuid && cr.space_id === targetId && cr.enterprise === enterprise
          );

          if (!existing) {
            return {
              clientUuid,
              name: a.name,
              status: "NEW",
              local: {
                placedQty: a.count,
                count: a.count,
                poultryType: a.breed === "Desi/Country" ? "country" : (a.purpose === "layer" ? "layer" : "broiler"),
                purpose: a.purpose === "layer" ? "eggs" : "meat",
                breed: a.breed,
                species: a.species,
                areaSqm: a.sizeAcres ? Math.round(a.sizeAcres * 4046.86 * 100) / 100 : null,
                sizeAcres: a.sizeAcres,
                stockingCount: a.stockingCount,
                hiveType: "langstroth",
                currentStatus: a.colonyStrength === "weak" ? "weak" : "active",
                colonyStrength: a.colonyStrength,
                installationDate: a.installedDate,
                installedDate: a.installedDate,
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
                placedQty: a.count,
                count: a.count,
                poultryType: "broiler",
                purpose: "meat",
                breed: a.breed,
                species: a.species,
                areaSqm: a.sizeAcres ? Math.round(a.sizeAcres * 4046.86 * 100) / 100 : null,
                hiveType: "langstroth",
                currentStatus: "active",
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
              placedQty: a.count,
              count: a.count,
              poultryType: "broiler",
              purpose: "meat",
              breed: a.breed,
              species: a.species,
              areaSqm: a.sizeAcres ? Math.round(a.sizeAcres * 4046.86 * 100) / 100 : null,
              hiveType: "langstroth",
              currentStatus: "active",
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
        const conflictCount = 0;

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
        const enterprise = payload?.enterprise || "poultry";
        const animals = payload?.animals || [];
        const overwrite = !!payload?.overwrite;

        const created = [];
        const updated = [];
        const skipped = [];

        for (const a of animals) {
          const clientUuid = String(a.id);
          const existing = cloudRecords.find(
            (cr) => cr.client_uuid === clientUuid && cr.space_id === targetId && cr.enterprise === enterprise
          );

          if (!existing) {
            const newRecord = {
              id: `cr-${clientUuid}`,
              space_id: targetId,
              client_uuid: clientUuid,
              name: a.name,
              enterprise,
            };
            cloudRecords.push(newRecord);
            created.push({ id: newRecord.id, clientUuid, name: a.name });
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

  test("Phase 3 bridge flow: tabs for poultry, fish, bee with preview, publish, and idempotency", async ({ page }) => {
    const errors = collectErrors(page);

    await bootToHome(page);

    // 1. Seed local ERP poultry, fish, and bee records in IndexedDB
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
            id: "poultry-pw-1",
            name: "Alpha Broiler Batch",
            enterprise: "poultry",
            count: 600,
            breed: "Vencobb",
            purpose: "meat",
            ageWeeks: 2,
            createdAt: new Date().toISOString(),
          });
          store.put({
            id: "fish-pw-1",
            name: "Main Carp Pond",
            enterprise: "fish",
            species: "Rohu & Catla",
            sizeAcres: 1.2,
            stockingCount: 2500,
            stockingDate: "2026-03-01",
            createdAt: new Date().toISOString(),
          });
          store.put({
            id: "bee-pw-1",
            name: "Hive Box 1",
            enterprise: "bee",
            colonyStrength: "strong",
            installedDate: "2026-02-15",
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

    // 4. Verify all 7 Domain Tabs are present
    const tabsContainer = page.getByTestId("bridge-domain-tabs");
    await expect(tabsContainer).toBeVisible();
    await expect(page.getByTestId("bridge-tab-parcels")).toBeVisible();
    await expect(page.getByTestId("bridge-tab-dairy")).toBeVisible();
    await expect(page.getByTestId("bridge-tab-goat")).toBeVisible();
    await expect(page.getByTestId("bridge-tab-pig")).toBeVisible();
    await expect(page.getByTestId("bridge-tab-poultry")).toBeVisible();
    await expect(page.getByTestId("bridge-tab-fish")).toBeVisible();
    await expect(page.getByTestId("bridge-tab-bee")).toBeVisible();

    // 5. Test Poultry Flocks tab
    await page.getByTestId("bridge-tab-poultry").click();
    await expect(page.getByTestId("parcel-item-poultry-pw-1")).toBeVisible();
    await expect(page.getByText("Alpha Broiler Batch")).toBeVisible();
    await expect(page.getByText(/600 birds/i)).toBeVisible();

    const publishBtn = page.getByRole("button", { name: /Publish Selected/ });
    await expect(publishBtn).toBeVisible();
    await expect(publishBtn).toHaveText(/Publish Selected \(1\)/);
    await publishBtn.click();

    const confirmView = page.getByTestId("bridge-confirm-view");
    await expect(confirmView).toBeVisible();
    await expect(page.getByText(/You are about to publish 1 selected local batch\(es\)/i)).toBeVisible();

    const confirmBtn = page.getByRole("button", { name: /Confirm & Publish/ });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    const resultView = page.getByTestId("bridge-result-view");
    await expect(resultView).toBeVisible();
    await expect(page.getByText(/Bridge Complete/i)).toBeVisible();

    const doneBtn = page.getByRole("button", { name: /Done/ });
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();
    await expect(dialog).not.toBeVisible();

    // Reopen and verify UNCHANGED for poultry
    await bridgeBtn.click();
    await expect(dialog).toBeVisible();
    await page.getByTestId("bridge-tab-poultry").click();
    const poultryItem = page.getByTestId("parcel-item-poultry-pw-1");
    await expect(poultryItem).toBeVisible();
    await expect(poultryItem.getByText("UNCHANGED")).toBeVisible();

    // 6. Test Aquaculture Ponds tab
    await page.getByTestId("bridge-tab-fish").click();
    await expect(page.getByTestId("parcel-item-fish-pw-1")).toBeVisible();
    await expect(page.getByText("Main Carp Pond")).toBeVisible();
    await expect(page.getByText(/Rohu & Catla/i)).toBeVisible();
    await publishBtn.click();
    await expect(confirmView).toBeVisible();
    await expect(page.getByText(/You are about to publish 1 selected local pond\(s\)/i)).toBeVisible();
    await page.getByRole("button", { name: /Confirm & Publish/ }).click();
    await expect(resultView).toBeVisible();
    await page.getByRole("button", { name: /Done/ }).click();

    // 7. Test Apiary Hives tab
    await bridgeBtn.click();
    await expect(dialog).toBeVisible();
    await page.getByTestId("bridge-tab-bee").click();
    await expect(page.getByTestId("parcel-item-bee-pw-1")).toBeVisible();
    await expect(page.getByText("Hive Box 1")).toBeVisible();
    await publishBtn.click();
    await expect(confirmView).toBeVisible();
    await expect(page.getByText(/You are about to publish 1 selected local hive\(s\)/i)).toBeVisible();
    await page.getByRole("button", { name: /Confirm & Publish/ }).click();
    await expect(resultView).toBeVisible();
    await page.getByRole("button", { name: /Done/ }).click();

    expect(realErrors(errors)).toHaveLength(0);
  });
});
