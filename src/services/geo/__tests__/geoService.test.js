import { describe, it, expect } from "vitest";
import {
  states, districtsOf, getState, getDistrict, searchStates, searchDistricts,
  validate, describe as describeLoc, matchState, matchDistrict, upgradeLegacy,
  stats, DATASET, DEFAULT_COUNTRY_ID,
} from "../geoService.js";

const WB = "IN-WB";
const OR = "IN-OR";

describe("dataset shape", () => {
  it("has all 36 states and union territories", () => {
    expect(states()).toHaveLength(36);
    expect(states().filter((s) => s.type === "state")).toHaveLength(28);
    expect(states().filter((s) => s.type === "ut")).toHaveLength(8);
  });

  it("is sorted alphabetically for the picker", () => {
    const names = states().map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("declares itself unverified, so the UI can say so", () => {
    expect(DATASET.verified).toBe(false);
    expect(stats().verified).toBe(false);
    expect(DATASET.version).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });

  it("gives every district a unique id scoped to its state", () => {
    const seen = new Set();
    for (const s of states()) {
      for (const d of districtsOf(s.id)) {
        expect(d.id.startsWith(s.id + "-"), d.id).toBe(true);
        expect(d.stateId).toBe(s.id);
        expect(seen.has(d.id), "duplicate " + d.id).toBe(false);
        seen.add(d.id);
      }
    }
    expect(seen.size).toBeGreaterThan(700);
  });

  it("gives every state at least one district", () => {
    for (const s of states()) expect(districtsOf(s.id).length, s.name).toBeGreaterThan(0);
  });
});

describe("state → district dependency", () => {
  it("returns only that state's districts", () => {
    const wb = districtsOf(WB).map((d) => d.name);
    expect(wb).toContain("Jhargram");
    expect(wb).toContain("Hooghly");
    expect(wb).toContain("Darjeeling");
    /* The exact leak the brief calls out: no Odisha, Jharkhand or Bihar. */
    expect(wb).not.toContain("Cuttack");
    expect(wb).not.toContain("Ranchi");
    expect(wb).not.toContain("Patna");
  });

  it("returns nothing for an unknown or empty state", () => {
    expect(districtsOf("IN-ZZ")).toEqual([]);
    expect(districtsOf("")).toEqual([]);
    expect(districtsOf(undefined)).toEqual([]);
  });
});

describe("search", () => {
  it("finds a state by partial name", () => {
    expect(searchStates("beng").map((s) => s.name)).toContain("West Bengal");
    expect(searchStates("").length).toBe(36);
  });

  it("finds Jhargram from \"Jhar\", within West Bengal only", () => {
    expect(searchDistricts(WB, "Jhar").map((d) => d.name)).toEqual(["Jhargram"]);
    /* Jharsuguda is in Odisha and must not surface under West Bengal. */
    expect(searchDistricts(WB, "Jhar").map((d) => d.name)).not.toContain("Jharsuguda");
    expect(searchDistricts(OR, "Jhar").map((d) => d.name)).toContain("Jharsuguda");
  });

  it("matches words in any order and ignores punctuation", () => {
    expect(searchDistricts(WB, "parganas 24").length).toBe(2);
    expect(searchDistricts(WB, "north 24").map((d) => d.name)).toEqual(["North 24 Parganas"]);
  });

  it("returns empty rather than guessing when nothing matches", () => {
    expect(searchDistricts(WB, "zzzz")).toEqual([]);
  });
});

describe("validate — the integrity rule", () => {
  const jhargram = districtsOf(WB).find((d) => d.name === "Jhargram").id;
  const patna = districtsOf("IN-BR").find((d) => d.name === "Patna").id;

  it("accepts a matching pair", () => {
    expect(validate({ stateId: WB, districtId: jhargram })).toMatchObject({ ok: true });
  });

  it("rejects West Bengal + Patna", () => {
    expect(validate({ stateId: WB, districtId: patna }))
      .toMatchObject({ ok: false, reason: "district_not_in_state" });
  });

  it("rejects unknown ids", () => {
    expect(validate({ stateId: "IN-ZZ" })).toMatchObject({ ok: false, reason: "unknown_state" });
    expect(validate({ stateId: WB, districtId: "IN-WB-nowhere" }))
      .toMatchObject({ ok: false, reason: "unknown_district" });
  });

  it("rejects a district with no state", () => {
    expect(validate({ districtId: jhargram }))
      .toMatchObject({ ok: false, reason: "district_without_state" });
  });

  it("allows state-only and fully empty, which onboarding may skip", () => {
    expect(validate({ stateId: WB })).toMatchObject({ ok: true, reason: "state_only" });
    expect(validate({})).toMatchObject({ ok: true, reason: "empty" });
  });
});

describe("renames resolve through aliases", () => {
  it("maps a saved pre-rename id to the current district", () => {
    expect(getDistrict("IN-MH-osmanabad")?.name).toBe("Dharashiv");
    expect(getDistrict("IN-UP-allahabad")?.name).toBe("Prayagraj");
    expect(getDistrict("IN-KA-bangalore-urban")?.name).toBe("Bengaluru Urban");
  });

  it("still validates against the state after following an alias", () => {
    expect(validate({ stateId: "IN-MH", districtId: "IN-MH-osmanabad" })).toMatchObject({ ok: true });
  });
});

describe("legacy text upgrade", () => {
  it("maps a clean pair to ids", () => {
    const r = upgradeLegacy({ state: "West Bengal", district: "Jhargram" });
    expect(r).toMatchObject({
      countryId: DEFAULT_COUNTRY_ID, stateId: WB,
      stateName: "West Bengal", districtName: "Jhargram", review: false,
    });
    expect(getDistrict(r.districtId).name).toBe("Jhargram");
  });

  it("is case- and spacing-insensitive", () => {
    expect(upgradeLegacy({ state: "  west bengal ", district: "JHARGRAM" }).stateId).toBe(WB);
  });

  it("flags for review rather than guessing, and never discards the text", () => {
    const r = upgradeLegacy({ state: "West Bengal", district: "Jhargam" }); // typo
    expect(r.stateId).toBe(WB);
    expect(r.districtId).toBe("");
    expect(r.districtName).toBe("Jhargam"); // preserved verbatim
    expect(r.review).toBe(true);
  });

  it("flags an unknown state and keeps the text", () => {
    const r = upgradeLegacy({ state: "Atlantis", district: "Nowhere" });
    expect(r).toMatchObject({ stateId: "", districtId: "", stateName: "Atlantis", review: true });
  });

  it("treats an empty record as nothing to review", () => {
    expect(upgradeLegacy({})).toMatchObject({ stateId: "", districtId: "", review: false });
  });

  it("does not map a district that belongs to a different state", () => {
    expect(matchDistrict(WB, "Cuttack")).toBe(null);
    expect(matchState("Odisha").id).toBe(OR);
  });
});

describe("describe", () => {
  it("renders names from ids", () => {
    const jhargram = districtsOf(WB).find((d) => d.name === "Jhargram").id;
    expect(describeLoc({ stateId: WB, districtId: jhargram }))
      .toEqual({ country: "India", state: "West Bengal", district: "Jhargram" });
  });

  it("falls back to stored names for a record with no ids yet", () => {
    expect(describeLoc({ stateName: "Bihar", districtName: "Patna" }))
      .toMatchObject({ state: "Bihar", district: "Patna" });
  });
});

describe("the brief's worked example", () => {
  it("West Bengal → Jhargram, then Odisha clears it", () => {
    /* The cascade itself is UI state; what the service guarantees is that the
       old district stops being valid the moment the state changes. */
    const jhargram = districtsOf(WB).find((d) => d.name === "Jhargram").id;
    expect(validate({ stateId: WB, districtId: jhargram }).ok).toBe(true);
    expect(validate({ stateId: OR, districtId: jhargram })).toMatchObject({
      ok: false, reason: "district_not_in_state",
    });
    const puri = districtsOf(OR).find((d) => d.name === "Puri").id;
    expect(validate({ stateId: OR, districtId: puri }).ok).toBe(true);
  });
});
