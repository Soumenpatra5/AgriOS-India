import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* Mock the livestock source the aggregator reads from. */
const H = vi.hoisted(() => ({ prod: {}, events: {} }));

vi.mock("../../livestock/livestockService.js", () => ({
  ENTERPRISES: [
    { id: "poultry", label: "Poultry" },
    { id: "dairy", label: "Dairy" },
    { id: "fish", label: "Fish" },
  ],
  productionService: { getForEnterprise: async (id) => H.prod[id] || [] },
  eventService: { getForEnterprise: async (id) => H.events[id] || [] },
}));

const { productionAggregator } = await import("../productionAggregator.js");

beforeEach(() => {
  H.prod = {};
  H.events = {};
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-15T00:00:00Z")); // "this month" = 2026-05
});
afterEach(() => { vi.useRealTimers(); });

describe("productionAggregator.monthSnapshot", () => {
  it("totals current-month vs all-time per enterprise and drops empty ones", async () => {
    H.prod = {
      poultry: [
        { date: "2026-05-01", eggs: 30 },
        { date: "2026-05-10", eggs: 20 },
        { date: "2026-04-20", eggs: 100 }, // last month → all-time only
      ],
      dairy: [{ date: "2026-04-01", quantity: 10 }], // no current-month entries, but has all-time
      fish: [], // no data at all → excluded
    };
    const snap = await productionAggregator.monthSnapshot();
    expect(snap).toHaveLength(2);

    const poultry = snap.find((r) => r.enterprise.id === "poultry");
    expect(poultry).toMatchObject({ total: 50, entries: 2, allTime: 150 });
    expect(poultry.metric.label).toBe("Eggs");

    const dairy = snap.find((r) => r.enterprise.id === "dairy");
    expect(dairy).toMatchObject({ total: 0, entries: 0, allTime: 10 });
    expect(dairy.metric.label).toBe("Milk");

    expect(snap.find((r) => r.enterprise.id === "fish")).toBeUndefined();
  });

  it("returns [] when no enterprise has any records", async () => {
    expect(await productionAggregator.monthSnapshot()).toEqual([]);
  });
});

describe("productionAggregator.harvests", () => {
  it("collects harvest events with a weight, tags the enterprise, newest first", async () => {
    H.events = {
      fish: [
        { type: "harvest", weightKg: 50, date: "2026-03-01" },
        { type: "vaccination", date: "2026-03-05" }, // not a harvest
        { type: "harvest", weightKg: 0, date: "2026-03-10" }, // no weight → excluded
      ],
      poultry: [{ type: "harvest", weightKg: 20, date: "2026-04-01" }],
      dairy: [],
    };
    const h = await productionAggregator.harvests();
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({ date: "2026-04-01", enterpriseLabel: "Poultry", weightKg: 20 });
    expect(h[1].enterpriseLabel).toBe("Fish");
  });
});

describe("productionAggregator.monthMortality", () => {
  it("sums this month's mortality across enterprises", async () => {
    H.prod = {
      poultry: [
        { date: "2026-05-01", mortality: 2 },
        { date: "2026-05-03", mortality: 1 },
        { date: "2026-04-01", mortality: 10 }, // last month → ignored
      ],
      dairy: [{ date: "2026-05-01", mortality: 1 }],
      fish: [],
    };
    expect(await productionAggregator.monthMortality()).toBe(4);
  });
});
