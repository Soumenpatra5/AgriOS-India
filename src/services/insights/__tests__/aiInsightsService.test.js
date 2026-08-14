import { describe, it, expect, beforeEach, vi } from "vitest";

/* All collaborators are mocked so the module imports cleanly and gather()/
   generate() are driven with controlled inputs. score() is pure. */
const H = vi.hoisted(() => {
  const complete = vi.fn();
  return {
    complete,
    kpi: { netProfit: 0, profitMargin: 0 },
    snapshot: [],
    vax: { missed: 0 },
    alerts: { lowStock: [], expired: [], expiring: [] },
    buckets: { overdue: [], today: [], upcoming: [] },
    mortality: 0,
  };
});

vi.mock("../../../ai/services/llmClient.js", () => ({ llmClient: { complete: H.complete } }));
vi.mock("../../../ai/config.js", () => ({ MODELS: { answer: "claude-test" }, LIMITS: { maxTokens: 500 } }));
vi.mock("../../business/kpiService.js", () => ({ kpiService: { summary: () => H.kpi } }));
vi.mock("../../production/productionAggregator.js", () => ({
  productionAggregator: { monthSnapshot: async () => H.snapshot, monthMortality: async () => H.mortality },
}));
vi.mock("../../livestock/vaccinationService.js", () => ({ vaccinationService: { counts: async () => H.vax } }));
vi.mock("../../inventory/inventoryService.js", () => ({ inventoryService: { alerts: async () => H.alerts } }));
vi.mock("../../tasks/taskService.js", () => ({ taskService: { buckets: async () => H.buckets } }));

const { aiInsightsService } = await import("../aiInsightsService.js");

/* Fully-healthy baseline; each test overrides only the signal it exercises. */
const healthy = () => ({
  kpi: { netProfit: 100000, profitMargin: 30 },
  vaccinations: { missed: 0 },
  inventoryAlerts: { expired: 0, lowStock: 0, expiring: 0 },
  tasks: { overdue: 0, today: 0, upcoming: 0 },
  monthMortality: 0,
});

describe("aiInsightsService.score", () => {
  it("is 100 with no notes when everything is healthy", () => {
    const r = aiInsightsService.score(healthy());
    expect(r.score).toBe(100);
    expect(r.notes).toEqual([]);
  });

  it("deducts 20 for a loss-making year", () => {
    expect(aiInsightsService.score({ ...healthy(), kpi: { netProfit: -1, profitMargin: 5 } }).score).toBe(80);
  });

  it("deducts 8 for a thin margin (profit still positive)", () => {
    expect(aiInsightsService.score({ ...healthy(), kpi: { netProfit: 1000, profitMargin: 10 } }).score).toBe(92);
  });

  it("caps the missed-vaccination penalty at 20", () => {
    expect(aiInsightsService.score({ ...healthy(), vaccinations: { missed: 2 } }).score).toBe(90);  // 2×5
    expect(aiInsightsService.score({ ...healthy(), vaccinations: { missed: 9 } }).score).toBe(80);  // capped
  });

  it("caps the overdue-task penalty at 15", () => {
    expect(aiInsightsService.score({ ...healthy(), tasks: { overdue: 2, today: 0, upcoming: 0 } }).score).toBe(94); // 2×3
    expect(aiInsightsService.score({ ...healthy(), tasks: { overdue: 9, today: 0, upcoming: 0 } }).score).toBe(85); // capped
  });

  it("caps the mortality penalty at 15", () => {
    expect(aiInsightsService.score({ ...healthy(), monthMortality: 3 }).score).toBe(97);
    expect(aiInsightsService.score({ ...healthy(), monthMortality: 40 }).score).toBe(85); // capped
  });

  it("stacks every penalty and records a note for each", () => {
    const r = aiInsightsService.score({
      kpi: { netProfit: -1, profitMargin: 5 },      // −20
      vaccinations: { missed: 4 },                   // −20
      inventoryAlerts: { expired: 2, lowStock: 3, expiring: 1 }, // −10, −5
      tasks: { overdue: 5, today: 0, upcoming: 0 },  // −15
      monthMortality: 20,                            // −15
    });
    expect(r.score).toBe(15); // 100 − 85
    expect(r.notes).toHaveLength(6);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe("aiInsightsService.gather", () => {
  beforeEach(() => {
    H.kpi = { netProfit: 5000, profitMargin: 20 };
    H.snapshot = [{ enterprise: { label: "Poultry" }, metric: { label: "Eggs", unit: "pcs" }, total: 50, entries: 2 }];
    H.vax = { missed: 1, done: 5 };
    H.alerts = { lowStock: [1, 2], expired: [3], expiring: [] };
    H.buckets = { overdue: [1], today: [1, 2], upcoming: [] };
    H.mortality = 2;
  });

  it("assembles a summary from every module", async () => {
    const data = await aiInsightsService.gather();
    expect(data.kpi).toEqual({ netProfit: 5000, profitMargin: 20 });
    expect(data.production).toEqual([{ enterprise: "Poultry", metric: "Eggs", thisMonth: "50 pcs", entries: 2 }]);
    expect(data.vaccinations).toEqual({ missed: 1, done: 5 });
    expect(data.inventoryAlerts).toEqual({ lowStock: 2, expired: 1, expiring: 0 });
    expect(data.tasks).toEqual({ overdue: 1, today: 2, upcoming: 0 });
    expect(data.monthMortality).toBe(2);
  });
});

describe("aiInsightsService.generate", () => {
  beforeEach(() => { H.complete.mockReset(); });

  it("parses the model's bullet list into trimmed strings", async () => {
    H.complete.mockResolvedValue("Here you go:\n- First insight\n-Second\n  - Third  \nnot a bullet");
    const bullets = await aiInsightsService.generate({ any: "data" });
    expect(bullets).toEqual(["First insight", "Second", "Third"]);
  });

  it("passes the system prompt, model and data to the LLM client", async () => {
    H.complete.mockResolvedValue("- ok");
    await aiInsightsService.generate({ kpi: { netProfit: 5000 } });
    const args = H.complete.mock.calls[0][0];
    expect(args.model).toBe("claude-test");
    expect(args.system).toMatch(/farm business advisor/i);
    expect(args.messages[0].content).toContain("netProfit");
  });

  it("returns [] when the model produces no bullets", async () => {
    H.complete.mockResolvedValue("No suggestions available.");
    expect(await aiInsightsService.generate({})).toEqual([]);
  });
});
