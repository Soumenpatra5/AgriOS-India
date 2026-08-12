import { describe, it, expect, afterEach } from "vitest";
import { computeSettlement, commissionBps } from "../settlement.js";

describe("computeSettlement", () => {
  it("splits total into commission + seller share at the given bps", () => {
    // 2.5% of ₹4800 (480000 paise) = 12000 paise commission
    expect(computeSettlement(480000, { bps: 250 })).toEqual({
      totalPaise: 480000, commissionPaise: 12000, sellerPaise: 468000, bps: 250,
    });
  });

  it("is zero-commission by default (bps 0)", () => {
    expect(computeSettlement(100000, { bps: 0 })).toMatchObject({ commissionPaise: 0, sellerPaise: 100000 });
  });

  it("rounds the commission and clamps negatives", () => {
    expect(computeSettlement(9999, { bps: 250 }).commissionPaise).toBe(250); // 249.975 -> 250
    expect(computeSettlement(-5, { bps: 250 })).toMatchObject({ totalPaise: 0, commissionPaise: 0, sellerPaise: 0 });
  });
});

describe("commissionBps", () => {
  const save = process.env.PLATFORM_COMMISSION_BPS;
  afterEach(() => { if (save === undefined) delete process.env.PLATFORM_COMMISSION_BPS; else process.env.PLATFORM_COMMISSION_BPS = save; });

  it("reads the env, defaults to 0, and clamps to [0,10000]", () => {
    delete process.env.PLATFORM_COMMISSION_BPS;
    expect(commissionBps()).toBe(0);
    process.env.PLATFORM_COMMISSION_BPS = "250";
    expect(commissionBps()).toBe(250);
    process.env.PLATFORM_COMMISSION_BPS = "50000";
    expect(commissionBps()).toBe(10000);
    process.env.PLATFORM_COMMISSION_BPS = "-10";
    expect(commissionBps()).toBe(0);
  });
});
