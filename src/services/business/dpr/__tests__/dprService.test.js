import { describe, it, expect, beforeEach, vi } from "vitest";

const held = vi.hoisted(() => {
  const stores = {};
  const make = () => {
    let rows = [];
    let seq = 0;
    return {
      add: async (data) => { const r = { id: `d${++seq}`, ...data }; rows.push(r); return r; },
      getAll: async () => rows.slice(),
      getBy: async (f, v) => rows.filter((r) => r[f] === v),
      getById: async (id) => rows.find((r) => r.id === id) || null,
      update: async (id, patch) => { const r = rows.find((x) => x.id === id); if (!r) return null; Object.assign(r, patch); return r; },
      remove: async (id) => { const i = rows.findIndex((x) => x.id === id); if (i < 0) return null; return rows.splice(i, 1)[0]; },
      reset: () => { rows = []; seq = 0; },
    };
  };
  const repo = (name) => (stores[name] ||= make());
  const resetAll = () => Object.values(stores).forEach((s) => s.reset());
  return { repo, resetAll };
});

vi.mock("../../../erp/erpDb.js", () => ({ repo: held.repo, uid: () => "uid" }));

const { dprService, project, draftFrom, verdictFor } = await import("../dprService.js");
const { DPR_MODELS } = await import("../dprConstants.js");

/* A deliberately small project whose every figure can be checked by hand:
   capital ₹3,00,000 · loan ₹2,70,000 @10% over 3 years · half capacity in
   year 1 · depreciation ₹20,000 (only the shed has a useful life). */
const INPUT = {
  units: 2,
  horizonYears: 3,
  capital: [
    { id: "shed",    label: "Shed",    perUnit: 100000, lifeYears: 10 },
    { id: "animals", label: "Animals", perUnit: 50000 },
  ],
  recurring: [{ id: "feed", label: "Feed", perUnit: 40000 }],
  revenue:   [{ id: "milk", label: "Milk", perUnit: 140000 }],
  output: { metric: "Milk", unit: "litre", perUnit: 2000, pricePerUnit: 35 },
  revenueRamp: [0.5, 1],
  opexRamp:    [1],
  finance: { marginPct: 10, subsidyPct: 0, ratePct: 10, tenureYears: 3, moratoriumMonths: 0 },
};

const averageOf = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;

describe("dprService", () => {
  beforeEach(() => held.resetAll());

  describe("project — cost of project", () => {
    it("scales every capital head by the number of units", () => {
      const p = project(INPUT);
      expect(p.capitalRows.map((r) => r.amount)).toEqual([200000, 100000]);
      expect(p.totalCapital).toBe(300000);
    });

    it("depreciates only the heads that carry a useful life", () => {
      expect(project(INPUT).depreciation).toBe(20000); // shed only: 200000/10
    });
  });

  describe("project — means of finance", () => {
    it("splits capital into margin, subsidy and bank loan", () => {
      const p = project(INPUT);
      expect(p.means).toMatchObject({ totalCapital: 300000, margin: 30000, subsidy: 0, loan: 270000 });
    });

    it("takes a subsidy off the loan, not off the promoter's margin", () => {
      const p = project({ ...INPUT, finance: { ...INPUT.finance, subsidyPct: 25 } });
      expect(p.means).toMatchObject({ margin: 30000, subsidy: 75000, loan: 195000 });
    });

    it("never produces a negative loan when margin and subsidy cover everything", () => {
      const p = project({ ...INPUT, finance: { ...INPUT.finance, marginPct: 60, subsidyPct: 60 } });
      expect(p.means.loan).toBe(0);
      expect(p.loanRows).toEqual([]);
    });
  });

  describe("project — year-wise projection", () => {
    it("ramps revenue and running cost on their own separate curves", () => {
      const { years } = project(INPUT);
      expect(years).toHaveLength(3);
      // Year 1 sells at half capacity but already pays full running cost.
      expect(years[0]).toMatchObject({ year: 1, capacityPct: 50, revenue: 140000, opex: 80000, grossSurplus: 60000 });
      // The ramp's last value repeats for the rest of the horizon.
      expect(years[1]).toMatchObject({ year: 2, capacityPct: 100, revenue: 280000, opex: 80000 });
      expect(years[2]).toMatchObject({ year: 3, capacityPct: 100, revenue: 280000, opex: 80000 });
    });

    it("charges falling interest as the loan amortises", () => {
      const { years } = project(INPUT);
      expect(years.map((y) => y.interest)).toEqual([27000, 18000, 9000]);
      expect(years.map((y) => y.principalRepaid)).toEqual([90000, 90000, 90000]);
    });

    it("nets depreciation and interest out of the gross surplus", () => {
      const { years } = project(INPUT);
      expect(years.map((y) => y.netSurplus)).toEqual([13000, 162000, 171000]);
      // Cash accrual adds the non-cash depreciation back.
      expect(years.map((y) => y.netCashAccrual)).toEqual([33000, 182000, 191000]);
    });

    it("computes a DSCR for every year that carries debt service", () => {
      const { years } = project(INPUT);
      expect(years.map((y) => y.dscr)).toEqual([0.51, 1.85, 2.02]);
    });

    it("shows zero principal during a moratorium year", () => {
      const p = project({ ...INPUT, finance: { ...INPUT.finance, moratoriumMonths: 12 } });
      expect(p.years[0].principalRepaid).toBe(0);
      expect(p.years[0].interest).toBe(27000);
      expect(p.years[1].principalRepaid).toBe(135000); // 2 repayment years left
    });
  });

  describe("project — viability", () => {
    it("reports the ratios a lending officer checks", () => {
      const { viability } = project(INPUT);
      expect(viability.avgDscr).toBe(1.46);
      expect(viability.minDscr).toBe(0.51);
      expect(viability.bcr).toBeCloseTo(1.07, 2);
      expect(viability.payback).toBeCloseTo(2.2, 2);
      expect(viability.discountRatePct).toBe(15);
    });

    it("derives break-even from contribution per output unit", () => {
      const { viability } = project(INPUT);
      // fixed = depreciation 20000 + average interest 18000 = 38000
      // contribution = ₹35 price - ₹20 variable = ₹15/litre
      expect(viability.capacityUnits).toBe(4000);
      expect(viability.breakEvenUnits).toBe(2534);
      expect(viability.breakEvenPct).toBeCloseTo(63.35, 1);
      expect(viability.outputUnit).toBe("litre");
    });

    it("reads DSCR over the repayment years only, ignoring moratorium years", () => {
      const p = project({ ...INPUT, finance: { ...INPUT.finance, moratoriumMonths: 12 } });
      // Year 1 owes interest but no principal, so its ratio is measured against
      // a much smaller denominator and comes out flattering — not comparable
      // with the years that carry a full instalment.
      expect(p.years[0].principalRepaid).toBe(0);
      expect(p.years[0].dscr).toBeGreaterThan(2);
      // The summary therefore reads only the repayment years.
      expect(p.viability.minDscr).toBe(Math.min(p.years[1].dscr, p.years[2].dscr));
      expect(p.viability.avgDscr).toBeCloseTo((p.years[1].dscr + p.years[2].dscr) / 2, 2);
      expect(p.viability.avgDscr).not.toBe(averageOf([p.years[0].dscr, p.years[1].dscr, p.years[2].dscr]));
    });

    it("reports no DSCR at all when the project takes no loan", () => {
      const p = project({ ...INPUT, finance: { ...INPUT.finance, marginPct: 100 } });
      expect(p.means.loan).toBe(0);
      expect(p.viability.avgDscr).toBeNull();
      expect(p.viability.minDscr).toBeNull();
    });

    it("survives a project with no units without dividing by zero", () => {
      const p = project({ ...INPUT, units: 0 });
      expect(p.totalCapital).toBe(0);
      expect(p.viability.breakEvenUnits).toBeNull();
      expect(p.viability.capacityUnits).toBe(0);
      expect(p.years).toHaveLength(3);
      // An empty project has no return to report — not a spectacular one.
      expect(p.viability.irr).toBeNull();
      expect(p.verdict.level).toBe("incomplete");
    });

    it("keeps every shipped template out of loss-making territory", () => {
      // Guards the built-in unit economics: a template that models a project a
      // bank would refuse is worse than no template at all.
      DPR_MODELS.filter((m) => m.id !== "custom").forEach((m) => {
        const p = project(draftFrom(m.id));
        expect(p.revenueFull, `${m.id} revenue`).toBeGreaterThan(p.opexFull);
        expect(p.viability.avgDscr, `${m.id} DSCR`).toBeGreaterThan(1);
        expect(p.viability.bcr, `${m.id} BCR`).toBeGreaterThan(1);
      });
    });
  });

  describe("verdictFor", () => {
    it("calls a project strong only when every ratio clears the good mark", () => {
      const v = verdictFor({ avgDscr: 2, bcr: 1.8, irr: 25 });
      expect(v.level).toBe("strong");
      expect(v.checks.every((c) => c.status === "good")).toBe(true);
    });

    it("calls it viable when the ratios pass but do not excel", () => {
      expect(verdictFor({ avgDscr: 1.6, bcr: 1.3, irr: 17 }).level).toBe("viable");
    });

    it("calls it weak as soon as one ratio falls below the acceptable mark", () => {
      const v = verdictFor({ avgDscr: 1.2, bcr: 1.8, irr: 25 });
      expect(v.level).toBe("weak");
      expect(v.checks.find((c) => c.key === "dscr").status).toBe("weak");
    });

    it("treats a ratio it could not compute as incomplete, never as a pass", () => {
      const v = verdictFor({ avgDscr: 2, bcr: 1.8, irr: null });
      expect(v.level).toBe("incomplete");
      expect(v.checks.find((c) => c.key === "irr").status).toBe("unknown");
    });
  });

  describe("draftFrom", () => {
    it("seeds a fully editable draft from the model template", () => {
      const d = draftFrom("dairy");
      expect(d.modelId).toBe("dairy");
      expect(d.units).toBe(5);
      expect(d.capital.length).toBeGreaterThan(0);
      expect(d.finance).toMatchObject({ ratePct: 11, subsidyPct: 0 });
    });

    it("pre-fills promoter and location details the app already knows", () => {
      const d = draftFrom("goat", {
        farm: { ownerName: "Sita Devi", village: "Rampur", district: "Nadia", state: "West Bengal", sizeAcres: 3 },
        user: { name: "Sita Devi", phone: "9800000000" },
      });
      expect(d.promoter).toMatchObject({ name: "Sita Devi", village: "Rampur", district: "Nadia", landAcres: 3 });
      expect(d.project.location).toBe("Rampur, Nadia, West Bengal");
    });

    it("copies template rows rather than sharing them, so edits stay local to the draft", () => {
      const a = draftFrom("dairy");
      const b = draftFrom("dairy");
      a.capital[0].perUnit = 1;
      expect(b.capital[0].perUnit).not.toBe(1);
    });

    it("falls back to the first model for an unknown id", () => {
      expect(draftFrom("nonsense").modelId).toBe("dairy");
    });
  });

  describe("persistence", () => {
    it("stores, lists, updates and removes drafts", async () => {
      const created = await dprService.create(draftFrom("dairy"));
      expect(created.id).toBe("d1");
      expect(await dprService.list()).toHaveLength(1);

      await dprService.update(created.id, { name: "My dairy unit" });
      expect((await dprService.get(created.id)).name).toBe("My dairy unit");

      await dprService.remove(created.id);
      expect(await dprService.list()).toHaveLength(0);
    });
  });
});
