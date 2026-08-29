import { describe, it, expect, beforeEach } from "vitest";
import { suggestFrom } from "../geoService.js";
import { repo } from "../../erp/erpDb.js";
import { storage } from "../../../utils/storage.js";
import { farmService, _resetGeoUpgradeForTests } from "../../farm/farmService.js";

/* GPS reports OpenStreetMap's names, which do not always equal this dataset's.
   These pin how much disagreement is tolerated — and, more importantly, where
   the line is: a suggestion the farmer confirms, never a silent write. */
describe("suggestFrom — GPS → administrative suggestion", () => {
  const IN = (state, district) => suggestFrom({ state, district, countryCode: "IN" });

  it("matches an exact pair and says so", () => {
    expect(IN("West Bengal", "Jhargram")).toMatchObject({
      stateId: "IN-WB", districtName: "Jhargram", exact: true,
    });
  });

  it("resolves transliteration differences, flagged as inexact", () => {
    /* Every one of these is a real spelling OSM uses. */
    expect(IN("West Bengal", "Puruliya")).toMatchObject({ districtName: "Purulia", exact: false });
    expect(IN("West Bengal", "Hugli")).toMatchObject({ districtName: "Hooghly", exact: false });
    expect(IN("Tamil Nadu", "Thiruvallur")).toMatchObject({ districtName: "Tiruvallur", exact: false });
    expect(IN("Karnataka", "Bangalore Urban")).toMatchObject({ districtName: "Bengaluru Urban", exact: false });
  });

  it("strips the administrative noise words OSM appends", () => {
    expect(IN("West Bengal", "Purba Bardhaman District"))
      .toMatchObject({ districtName: "Purba Bardhaman", exact: true });
  });

  it("suggests the state alone when the district cannot be resolved", () => {
    const r = IN("Bihar", "Somewhere Else");
    expect(r).toMatchObject({ stateId: "IN-BR", districtId: "", exact: false });
  });

  it("returns nothing for an unknown state", () => {
    expect(IN("Atlantis", "Anywhere")).toBe(null);
  });

  it("returns nothing outside India, rather than folding a foreign name in", () => {
    expect(suggestFrom({ state: "Bavaria", district: "Munich", countryCode: "DE" })).toBe(null);
    /* West Bengal exists in the dataset, but the position is not in India. */
    expect(suggestFrom({ state: "West Bengal", district: "Jhargram", countryCode: "BD" })).toBe(null);
  });

  it("never returns a district from the wrong state", () => {
    /* Cuttack is in Odisha; asked under West Bengal it must not be offered. */
    expect(IN("West Bengal", "Cuttack")).toMatchObject({ stateId: "IN-WB", districtId: "" });
  });

  it("tolerates missing input", () => {
    expect(suggestFrom({})).toBe(null);
    expect(IN("West Bengal", "")).toMatchObject({ stateId: "IN-WB", districtId: "", exact: true });
  });
});

describe("farm records upgrade to ids once", () => {
  const farms = repo("farms");
  const FLAG = "erp:farms:geoUpgraded:v1";

  beforeEach(async () => {
    for (const f of await farms.getAll()) await farms.purge(f.id);
    storage.remove(FLAG);
    _resetGeoUpgradeForTests();
  });

  it("fills ids for a farm that only had text", async () => {
    const f = await farms.add({ name: "Patra Agro", state: "West Bengal", district: "Hooghly" });
    const [after] = (await farmService.getAll()).filter((x) => x.id === f.id);
    expect(after).toMatchObject({
      stateId: "IN-WB", districtId: "IN-WB-hooghly",
      state: "West Bengal", district: "Hooghly",
    });
  });

  it("leaves an unmatchable district as text with no id, rather than guessing", async () => {
    const f = await farms.add({ name: "X", state: "West Bengal", district: "Hoogly" }); // typo
    const [after] = (await farmService.getAll()).filter((x) => x.id === f.id);
    expect(after.stateId).toBe("IN-WB");
    expect(after.districtId).toBe("");
    expect(after.district).toBe("Hoogly"); // preserved verbatim
  });

  it("does not touch a farm with no location at all", async () => {
    const f = await farms.add({ name: "No location" });
    const [after] = (await farmService.getAll()).filter((x) => x.id === f.id);
    expect(after.stateId).toBeUndefined();
  });

  it("does not re-run, and leaves already-structured rows alone", async () => {
    const f = await farms.add({ name: "Already", stateId: "IN-OR", districtId: "IN-OR-puri", state: "Odisha", district: "Puri" });
    await farmService.getAll();
    const [after] = (await farmService.getAll()).filter((x) => x.id === f.id);
    expect(after).toMatchObject({ stateId: "IN-OR", districtId: "IN-OR-puri" });
    expect(storage.get(FLAG)).toBe(true);
  });
});
