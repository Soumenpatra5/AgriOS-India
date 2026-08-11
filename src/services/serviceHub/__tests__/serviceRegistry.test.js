import { describe, it, expect } from "vitest";
import { SERVICE_CATEGORIES, SERVICE_REGISTRY, serviceById, servicesByCategory } from "../serviceRegistry.js";

/* The set of screen kinds ScreenRouter.jsx actually routes. Keeping this list
   here means a typo'd or removed kind in the registry fails a test instead of
   silently dead-ending a tile at runtime. Update alongside ScreenRouter. */
const ROUTABLE_KINDS = new Set([
  "settings", "personalize", "farmDetails", "support", "privacy", "subscription", "payments",
  "documents", "security", "permissions", "about", "feature", "chat", "weather", "farmLocations",
  "nearby", "mandiPrices", "schemeExplorer", "farmLedger", "cropCalendar", "diagnosticsHome",
  "diagnosticFlow", "diagnosticResult", "diagnosticHistory", "diagnosticConsent", "farmErp",
  "farmProfiles", "landManager", "erpTasks", "erpInventory", "erpAssets", "erpEmployees",
  "employeeDetail", "erpCrm", "erpProduction", "erpReports", "erpAnalytics", "erpInsights",
  "erpDevices", "pigManager", "sheepManager", "vaccinationCalendar", "livestockHub",
  "poultryManager", "dairyManager", "goatManager", "fishManager", "beeManager",
  "businessDashboard", "plReport", "cashFlow", "marketplace", "mpProduct", "mpStore", "mpCart",
  "mpCheckout", "mpOrders", "mpWishlist", "mpSeller", "svcMarketplace", "svcDetail", "svcProvider",
  "svcBooking", "svcMyBookings", "svcProviderDash", "logisticsHub", "logShipments",
  "logShipmentDetail", "logFleet", "logWarehouse", "logContracts", "logAuctions", "logProcurement",
  "logExport", "logAnalytics", "aiCommerceHub", "aiRecs", "aiPricing", "aiForecast", "aiMatch",
  "aiFraud", "aiBI", "mlopsHub", "datasetBrowser", "datasetDetail", "annotationWorkspace",
  "modelRegistryPage", "experimentList", "trainingDashboard", "monitoringDashboard",
  "apiKeyManager", "storage", "calculator", "cropPlanner", "cropPlanList", "cropPlanDetail",
  "cropPlanCompare", "feedHub", "feedCalculator", "feedInventory", "feedPurchase", "feedBatchList",
  "feedBatchDetail", "feedWastage", "feedDashboard", "feedReports", "alertsCenter",
]);

const CATEGORY_IDS = new Set(SERVICE_CATEGORIES.map((c) => c.id));

describe("serviceRegistry — structural integrity", () => {
  it("has unique service ids", () => {
    const ids = SERVICE_REGISTRY.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique category ids", () => {
    const ids = SERVICE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every service belongs to a defined category", () => {
    for (const s of SERVICE_REGISTRY) {
      expect(CATEGORY_IDS.has(s.category), `service ${s.id} has unknown category ${s.category}`).toBe(true);
    }
  });

  it("every non-coming service routes to a real, routable screen kind", () => {
    for (const s of SERVICE_REGISTRY) {
      if (s.coming) continue;
      expect(s.kind, `service ${s.id} is missing a kind`).toBeTruthy();
      expect(ROUTABLE_KINDS.has(s.kind), `service ${s.id} → unknown kind "${s.kind}"`).toBe(true);
    }
  });

  it("coming-soon services do not claim a kind (they route to the stub)", () => {
    for (const s of SERVICE_REGISTRY) {
      if (s.coming) expect(s.kind).toBeUndefined();
    }
  });

  it("every service has en/hi/bn title and description", () => {
    for (const s of SERVICE_REGISTRY) {
      for (const field of ["title", "desc"]) {
        expect(s[field], `${s.id}.${field} missing`).toBeTruthy();
        for (const locale of ["en", "hi", "bn"]) {
          expect(typeof s[field][locale], `${s.id}.${field}.${locale}`).toBe("string");
          expect(s[field][locale].length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("every service type references a known farmer-profile type", () => {
    const KNOWN = new Set(["crop", "poultry", "dairy", "fish", "goat", "pig", "bee"]);
    for (const s of SERVICE_REGISTRY) {
      if (!s.types) continue;
      for (const ty of s.types) expect(KNOWN.has(ty), `service ${s.id} type "${ty}"`).toBe(true);
    }
  });

  it("badges are one of the known kinds", () => {
    const KNOWN = new Set(["new", "ai", "premium"]);
    for (const s of SERVICE_REGISTRY) {
      if (s.badge) expect(KNOWN.has(s.badge), `service ${s.id} badge "${s.badge}"`).toBe(true);
    }
  });
});

describe("serviceRegistry — lookups", () => {
  it("serviceById finds an existing service and returns null for a miss", () => {
    expect(serviceById("ledger")?.kind).toBe("farmLedger");
    expect(serviceById("does-not-exist")).toBeNull();
  });

  it("servicesByCategory returns only that category's services", () => {
    const livestock = servicesByCategory("livestock");
    expect(livestock.length).toBeGreaterThan(0);
    expect(livestock.every((s) => s.category === "livestock")).toBe(true);
  });

  it("covers the whole app — at least one service per category", () => {
    for (const c of SERVICE_CATEGORIES) {
      expect(servicesByCategory(c.id).length, `category ${c.id} is empty`).toBeGreaterThan(0);
    }
  });
});
