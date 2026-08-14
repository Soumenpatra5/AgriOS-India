import { describe, it, expect } from "vitest";
import { escalationEngine } from "../escalationEngine.js";

const types = (res) => res.flags.map((f) => f.type);

/* A confident, low-risk, non-critical diagnosis — the baseline "all clear". */
const clean = {
  confidence: { isLow: false, isMedium: false },
  needsMoreImages: false,
  needsExpertReview: false,
  primaryDiagnosis: "Leaf Blight",
  risk: { isHighRisk: false, urgency: { key: "routine" } },
  severity: { level: "Moderate" },
};

describe("escalationEngine.evaluate", () => {
  it("raises no escalation for a clean, confident result", () => {
    const res = escalationEngine.evaluate(clean);
    expect(res.flags).toEqual([]);
    expect(res.hasEmergency).toBe(false);
    expect(res.needsExpert).toBe(false);
    expect(res.needsMoreImages).toBe(false);
    expect(res.referralSummary).toBeNull();
  });

  it("low confidence triggers more-images, symptoms, ai-chat and expert", () => {
    const res = escalationEngine.evaluate({ ...clean, confidence: { isLow: true } });
    expect(types(res)).toEqual(["more_images", "symptoms", "ai_chat", "expert"]);
    expect(res.needsExpert).toBe(true);
    expect(res.needsMoreImages).toBe(true);
    expect(res.hasEmergency).toBe(false);
  });

  it("a Critical severity escalates to emergency (and counts as needing an expert)", () => {
    const res = escalationEngine.evaluate({ ...clean, severity: { level: "Critical" } });
    expect(res.hasEmergency).toBe(true);
    expect(res.needsExpert).toBe(true);
    expect(types(res)).toContain("emergency");
  });

  it("an emergency risk urgency escalates to emergency", () => {
    const res = escalationEngine.evaluate({ ...clean, risk: { isHighRisk: true, urgency: { key: "emergency" } } });
    expect(res.hasEmergency).toBe(true);
    expect(types(res)).toEqual(expect.arrayContaining(["expert", "emergency"]));
  });

  it("strips the internal test function from returned flags", () => {
    const res = escalationEngine.evaluate({ ...clean, confidence: { isLow: true } });
    expect(res.flags.every((f) => !("test" in f) && f.label && f.cta)).toBe(true);
  });

  it("builds a referral summary when expert review is needed", () => {
    const res = escalationEngine.evaluate({
      ...clean,
      needsExpertReview: true,
      domainId: "plant",
      primaryDiagnosis: "Blight",
      severity: { label: "Severe" },
      confidence: { label: "low" },
      observations: ["dark spots"],
      riskFactors: ["high humidity"],
      disclaimer: "Consult an expert.",
    });
    expect(res.referralSummary).toContain("Diagnostic Referral Summary");
    expect(res.referralSummary).toContain("Domain: plant");
    expect(res.referralSummary).toContain("AI Diagnosis: Blight");
    expect(res.referralSummary).toContain("• dark spots");
    expect(res.referralSummary).toContain("• high humidity");
    expect(res.referralSummary).toContain("DISCLAIMER: Consult an expert.");
  });
});
