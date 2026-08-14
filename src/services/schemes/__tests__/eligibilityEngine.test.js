import { describe, it, expect } from "vitest";
import { checkEligibility, ELIGIBILITY_LABELS, ELIGIBILITY_COLORS } from "../eligibilityEngine.js";

/* Build a scheme whose eligibility rules default to "no constraint", so each
   test overrides only the rule it exercises. */
function scheme(rules = {}) {
  return {
    eligibility: {
      landMin: null, landMax: null, categories: null, farmTypes: null,
      needsAadhar: false, needsBankAccount: false, needsLandRecord: false,
      states: null, ...rules,
    },
  };
}

describe("checkEligibility — happy path", () => {
  it("scores a fully-matching farmer as eligible (100)", () => {
    const profile = { landSize: "2 acre", farmType: ["crop"], location: "West Bengal" };
    const r = checkEligibility(profile, scheme({
      categories: ["small", "marginal"], farmTypes: ["crop", "dairy"],
      needsAadhar: true, needsBankAccount: true, states: ["West Bengal"],
    }));
    expect(r.status).toBe("eligible");
    expect(r.score).toBe(100);
    expect(r.reasons).toHaveLength(5);
    expect(r.missing).toEqual([]);
  });

  it("a maximally-permissive scheme with a full profile is eligible", () => {
    const profile = { landSize: "2 acre", farmType: ["crop"], location: "Odisha" };
    const r = checkEligibility(profile, scheme());
    expect(r.status).toBe("eligible");
    expect(r.score).toBe(100);
  });
});

describe("checkEligibility — hard disqualifiers (early return, status unlikely)", () => {
  it("land below landMin", () => {
    const r = checkEligibility({ landSize: "0.5 acre" }, scheme({ landMin: 1 }));
    expect(r.status).toBe("unlikely");
    expect(r.score).toBe(5);
    expect(r.note).toContain("at least 1 acre");
  });
  it("land above landMax", () => {
    const r = checkEligibility({ landSize: "10 acre" }, scheme({ landMax: 5 }));
    expect(r.status).toBe("unlikely");
    expect(r.note).toContain("Maximum land holding");
  });
  it("farmer category not covered", () => {
    const r = checkEligibility({ landSize: "10 acre" }, scheme({ categories: ["small", "marginal"] }));
    expect(r.status).toBe("unlikely");
    expect(r.score).toBe(10);
    expect(r.note).toContain("small/marginal");
  });
  it("farm type not covered", () => {
    const r = checkEligibility(
      { landSize: "2 acre", farmType: ["poultry"] },
      scheme({ categories: ["all"], farmTypes: ["crop"] }),
    );
    expect(r.status).toBe("unlikely");
    expect(r.note).toContain("crop");
  });
  it("state not covered", () => {
    const r = checkEligibility(
      { landSize: "2 acre", farmType: ["crop"], location: "Kerala" },
      scheme({ states: ["West Bengal", "Odisha"] }),
    );
    expect(r.status).toBe("unlikely");
    expect(r.note).toContain("West Bengal, Odisha");
  });
});

describe("checkEligibility — missing profile data surfaces guidance", () => {
  it("collects every 'missing' hint and returns unknown when little is known", () => {
    const r = checkEligibility({}, scheme({
      categories: ["small", "marginal"], farmTypes: ["crop"],
      needsAadhar: true, states: ["West Bengal"],
    }));
    expect(r.status).toBe("unknown");
    expect(r.score).toBe(15);
    expect(r.missing).toHaveLength(4);
    expect(r.reasons).toHaveLength(1);
  });
  it("one unknown but a strong score is 'partial'", () => {
    const r = checkEligibility(
      { landSize: "2 acre", farmType: ["crop"] }, // no location
      scheme({ categories: ["all"], farmTypes: ["crop"], states: ["West Bengal"] }),
    );
    expect(r.status).toBe("partial");
    expect(r.score).toBe(80);
    expect(r.missing).toHaveLength(1);
  });
});

describe("checkEligibility — land-unit parsing (via public behaviour)", () => {
  it("treats '1 hectare' as ~2.47 acres → small farmer", () => {
    const r = checkEligibility(
      { landSize: "1 hectare", farmType: ["crop"], location: "West Bengal" },
      scheme({ categories: ["small"] }),
    );
    expect(r.status).toBe("eligible"); // 2.47 acres = small
  });
  it("'1 hectare' exceeds a 2-acre landMax", () => {
    const r = checkEligibility({ landSize: "1 hectare" }, scheme({ landMax: 2 }));
    expect(r.status).toBe("unlikely");
    expect(r.note).toContain("Maximum land holding");
  });

  // Regression guard for a parser bug this QA pass surfaced: "bigha" contains
  // the substring "ha", so parseAcres used to hit the hectare branch first and
  // convert 2 bigha as ~4.94 acres (large) instead of ~1.24 acres (marginal).
  // Fixed by matching specific units before the loose "ha" check. Impacts
  // West Bengal farmers, who commonly measure land in bigha.
  it("treats '2 bigha' as ~1.24 acres → marginal farmer (not hectares)", () => {
    const r = checkEligibility(
      { landSize: "2 bigha", farmType: ["crop"], location: "West Bengal" },
      scheme({ categories: ["marginal"] }),
    );
    expect(r.status).toBe("eligible"); // 1.24 acres = marginal
  });
});

describe("eligibility label / colour maps", () => {
  it("labels cover all four statuses", () => {
    expect(Object.keys(ELIGIBILITY_LABELS).sort()).toEqual(
      ["eligible", "partial", "unknown", "unlikely"].sort(),
    );
  });
  it("ELIGIBILITY_COLORS maps statuses to theme tokens", () => {
    const T = {
      primarySoft: "a", primary: "b", orangeSoft: "c", orange: "d",
      redSoft: "e", red: "f", surface2: "g", inkSoft: "h",
    };
    const colors = ELIGIBILITY_COLORS(T);
    expect(colors.eligible).toEqual({ bg: "a", fg: "b" });
    expect(colors.unlikely).toEqual({ bg: "e", fg: "f" });
  });
});
