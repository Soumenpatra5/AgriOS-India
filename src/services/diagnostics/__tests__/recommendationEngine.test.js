import { describe, it, expect } from "vitest";
import { recommendationEngine } from "../recommendationEngine.js";

describe("recommendationEngine.structure", () => {
  it("builds priority-ordered categories from the raw recommendations", () => {
    const out = recommendationEngine.structure(
      {
        chemical: [{ action: "Spray X", cost: "100" }],
        immediate: ["Isolate plant"],
        organic: ["Neem oil"],
      },
      { knowledgeSource: "KVK", governmentAdvisory: "advisory note" },
    );
    expect(out.categories.map((c) => c.key)).toEqual(["immediate", "organic", "chemical"]); // by priority
    expect(out.categories[0].items[0].text).toBe("Isolate plant");
    const chem = out.categories.find((c) => c.key === "chemical");
    expect(chem.items[0]).toMatchObject({ text: "Spray X", cost: "100" });
    expect(out.hasImmediate).toBe(true);
    expect(out.hasChemical).toBe(true);
    expect(out.totalCount).toBe(3);
    expect(out.knowledgeSource).toBe("KVK");
    expect(out.governmentAdvisory).toBe("advisory note");
    expect(out.disclaimer).toContain("verify with a qualified expert");
  });

  it("skips empty or missing categories", () => {
    const out = recommendationEngine.structure({ organic: [], nutrition: ["Add compost"] });
    expect(out.categories.map((c) => c.key)).toEqual(["nutrition"]);
    expect(out.hasImmediate).toBe(false);
    expect(out.hasChemical).toBe(false);
    expect(out.totalCount).toBe(1);
  });

  it("returns an empty structure for no recommendations", () => {
    const out = recommendationEngine.structure({});
    expect(out.categories).toEqual([]);
    expect(out.totalCount).toBe(0);
  });

  it("assigns stable ids per item", () => {
    const out = recommendationEngine.structure({ organic: ["a", "b"] });
    expect(out.categories[0].items.map((i) => i.id)).toEqual(["organic-0", "organic-1"]);
  });
});
