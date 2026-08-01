import { describe, it, expect } from "vitest";
import dpr from "../definitions/dprGenerator.js";

describe("dprGenerator agent", () => {
  it("has required fields", () => {
    expect(dpr.id).toBe("dprGenerator");
    expect(dpr.name).toMatch(/DPR/i);
    expect(dpr.icon).toBe("FileText");
    expect(dpr.tools).toContain("calculator");
  });

  it("triggers on DPR keywords in en/hi/bn", () => {
    expect(dpr.triggers).toContain("dpr");
    expect(dpr.triggers).toContain("project report");
    expect(dpr.triggers).toContain("प्रोजेक्ट रिपोर्ट");
    expect(dpr.triggers).toContain("প্রকল্প রিপোর্ট");
  });

  it("includes suggested prompts", () => {
    expect(dpr.suggested.length).toBeGreaterThanOrEqual(3);
  });

  it("persona mentions NABARD/bank format", () => {
    expect(dpr.persona).toMatch(/NABARD/);
    expect(dpr.persona).toMatch(/bank/i);
  });
});
