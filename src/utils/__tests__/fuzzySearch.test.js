import { describe, it, expect } from "vitest";
import { fuzzyMatch } from "../fuzzySearch.js";

const ITEMS = [
  { id: "a", title: { en: "Crop Doctor", hi: "फसल डॉक्टर", bn: "ফসল ডাক্তার" }, desc: { en: "Diagnose diseases", hi: "रोग पहचानें", bn: "রোগ চিহ্নিত করুন" } },
  { id: "b", title: { en: "Loan Advisor", hi: "ऋण सलाहकार", bn: "ঋণ পরামর্শদাতা" }, desc: { en: "EMI and eligibility", hi: "EMI और पात्रता", bn: "EMI ও যোগ্যতা" } },
  { id: "c", title: { en: "Weather", hi: "मौसम", bn: "আবহাওয়া" }, desc: { en: "Forecast", hi: "पूर्वानुमान", bn: "পূর্বাভাস" } },
];

describe("fuzzyMatch", () => {
  it("returns all items for empty query", () => {
    expect(fuzzyMatch(ITEMS, "")).toHaveLength(3);
    expect(fuzzyMatch(ITEMS, "  ")).toHaveLength(3);
  });

  it("matches English text", () => {
    const r = fuzzyMatch(ITEMS, "loan");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("b");
  });

  it("matches Hindi text", () => {
    const r = fuzzyMatch(ITEMS, "मौसम");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("c");
  });

  it("matches transliterated Hindi via TRANSLIT map", () => {
    const r = fuzzyMatch(ITEMS, "fasal");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("a");
  });

  it("matches transliterated loan keyword", () => {
    const r = fuzzyMatch(ITEMS, "rin");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("b");
  });

  it("matches weather via transliteration", () => {
    const r = fuzzyMatch(ITEMS, "mausam");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("c");
  });

  it("case insensitive", () => {
    expect(fuzzyMatch(ITEMS, "CROP")).toHaveLength(1);
  });
});
