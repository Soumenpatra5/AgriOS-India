import { describe, it, expect, beforeEach, vi } from "vitest";

/* costAnalysis composes three services; mock them via mutable holders so each
   test drives the arithmetic with controlled inputs (no ledger/IndexedDB). */
const H = vi.hoisted(() => ({ pl: [], snapshot: [], flow: [] }));

vi.mock("../../business/plService.js", () => ({ plService: { byEnterprise: async () => H.pl } }));
vi.mock("../../business/cashFlowService.js", () => ({ cashFlowService: { monthlyFlow: async () => H.flow } }));
vi.mock("../../production/productionAggregator.js", () => ({ productionAggregator: { monthSnapshot: async () => H.snapshot } }));

const { costAnalysis } = await import("../costAnalysis.js");

const ent = (id) => ({ id, label: id });
const snapRow = (id, allTime) => ({ enterprise: ent(id), metric: { key: "x", label: "X", unit: "u" }, total: 0, entries: 1, allTime });
const plRow = (id, income, expense) => ({ id, label: id, income, expense, net: income - expense });

describe("costAnalysis.costPerUnit", () => {
  beforeEach(() => { H.pl = []; H.snapshot = []; });

  it("computes cost and price per unit from matched ledger + production", async () => {
    H.snapshot = [snapRow("poultry", 1000)];
    H.pl = [plRow("poultry", 5000, 2000)];
    const [row] = await costAnalysis.costPerUnit(2026);
    expect(row.output).toBe(1000);
    expect(row.expense).toBe(2000);
    expect(row.revenue).toBe(5000);
    expect(row.costPerUnit).toBe(2);   // 2000 / 1000
    expect(row.pricePerUnit).toBe(5);  // 5000 / 1000
  });

  it("rounds per-unit figures to 2 decimals", async () => {
    H.snapshot = [snapRow("poultry", 700)];
    H.pl = [plRow("poultry", 3500, 2000)];
    const [row] = await costAnalysis.costPerUnit(2026);
    expect(row.costPerUnit).toBe(2.86); // 2000 / 700 = 2.857…
    expect(row.pricePerUnit).toBe(5);   // 3500 / 700
  });

  it("returns null per-unit figures when there is no output", async () => {
    H.snapshot = [snapRow("dairy", 0)];
    H.pl = [plRow("dairy", 0, 100)];
    const [row] = await costAnalysis.costPerUnit(2026);
    expect(row.costPerUnit).toBeNull();
    expect(row.pricePerUnit).toBeNull();
  });

  it("treats an enterprise with production but no ledger row as zero-cost", async () => {
    H.snapshot = [snapRow("goat", 50)];
    H.pl = []; // no matching P&L row
    const [row] = await costAnalysis.costPerUnit(2026);
    expect(row.expense).toBe(0);
    expect(row.revenue).toBe(0);
    expect(row.costPerUnit).toBe(0);      // 0 / 50
    expect(row.pricePerUnit).toBeNull();  // no income → null
  });
});

describe("costAnalysis.breakEven", () => {
  beforeEach(() => { H.pl = []; H.snapshot = []; });

  it("keeps only priced rows and computes break-even units + achieved %", async () => {
    H.snapshot = [snapRow("poultry", 1000), snapRow("dairy", 0)];
    H.pl = [plRow("poultry", 5000, 2000), plRow("dairy", 0, 100)];
    const rows = await costAnalysis.breakEven(2026);
    expect(rows).toHaveLength(1); // dairy has no pricePerUnit → filtered out
    expect(rows[0].enterprise.id).toBe("poultry");
    expect(rows[0].breakEvenUnits).toBe(400);  // ceil(2000 / 5)
    expect(rows[0].achievedPct).toBe(250);     // round(5000 / 2000 * 100)
  });
});

describe("costAnalysis.forecast", () => {
  beforeEach(() => { H.flow = []; });

  const zeroMonth = (month) => ({ month, label: "M", income: 0, expense: 0, net: 0, opening: 0, closing: 0, negative: false });

  it("projects 3 months from the trailing 3-month average", async () => {
    const flow = Array.from({ length: 12 }, (_, i) => zeroMonth(i + 1));
    flow[9]  = { ...flow[9],  income: 100, expense: 50, net: 50 };
    flow[10] = { ...flow[10], income: 200, expense: 50, net: 150 };
    flow[11] = { ...flow[11], income: 300, expense: 50, net: 250, closing: 1000 };
    H.flow = flow;

    const out = await costAnalysis.forecast(2026);
    expect(out).toHaveLength(3);
    // avgIn = (100+200+300)/3 = 200 ; avgOut = 50 ; delta = +150 from closing 1000
    expect(out.map((m) => m.income)).toEqual([200, 200, 200]);
    expect(out.map((m) => m.expense)).toEqual([50, 50, 50]);
    expect(out.map((m) => m.projectedBalance)).toEqual([1150, 1300, 1450]);
    expect(out.every((m) => typeof m.label === "string" && m.label.length > 0)).toBe(true);
  });

  it("returns [] when there is no active cash-flow month", async () => {
    H.flow = Array.from({ length: 12 }, (_, i) => zeroMonth(i + 1));
    expect(await costAnalysis.forecast(2026)).toEqual([]);
  });
});
