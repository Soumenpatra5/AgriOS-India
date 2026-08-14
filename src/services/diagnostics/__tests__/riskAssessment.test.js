import { describe, it, expect } from "vitest";
import { riskAssessment } from "../riskAssessment.js";

describe("riskAssessment.parse", () => {
  it("normalises each risk field and scores the overall risk", () => {
    const r = riskAssessment.parse({ spread: "high", economicImpact: "very high", mortality: "moderate", urgency: "emergency" });
    expect(r.spread).toEqual({ level: "high", label: "High" });
    expect(r.economicImpact).toEqual({ level: "critical", label: "Critical" }); // "very high" → critical
    expect(r.mortalityRisk).toEqual({ level: "medium", label: "Medium" });      // via the `mortality` alias
    expect(r.yieldLoss).toEqual({ level: "low", label: "Low" });                // absent → low
    expect(r.overallScore).toBe(3); // max(high=2, critical=3, medium=1)
    expect(r.isHighRisk).toBe(true);
    expect(r.urgency).toMatchObject({ key: "emergency", label: "Emergency", days: 0 });
  });

  it("reads the yield_loss snake_case alias", () => {
    expect(riskAssessment.parse({ yieldLoss: undefined, yield_loss: "high" }).yieldLoss.level).toBe("high");
  });

  it("defaults urgency to routine and excludes yieldLoss from the score", () => {
    const r = riskAssessment.parse({ yieldLoss: "critical" }); // yieldLoss must not drive overallScore
    expect(r.urgency).toMatchObject({ key: "routine", days: 7 });
    expect(r.overallScore).toBe(0);
    expect(r.isHighRisk).toBe(false);
  });

  it("marks high risk once the score reaches 2 but not at 1", () => {
    expect(riskAssessment.parse({ spread: "high" }).isHighRisk).toBe(true);    // 2
    expect(riskAssessment.parse({ spread: "medium" }).isHighRisk).toBe(false); // 1
  });

  it("empty() is a fully-low, routine assessment", () => {
    const e = riskAssessment.empty();
    expect(e.overallScore).toBe(0);
    expect(e.isHighRisk).toBe(false);
    expect(e.urgency.key).toBe("routine");
    expect(e.spread.level).toBe("low");
  });
});
