import { describe, it, expect } from "vitest";
import { diagnosisParser } from "../diagnosisParser.js";

const goodJson = {
  primaryDiagnosis: { name: "Late Blight", score: 0.9, confidence: "high" },
  possibleDiseases: [{ name: "Late Blight", probability: 0.9 }, { name: "" }],
  severity: "Severe",
  risk: { spread: "high", urgency: "urgent" },
  recommendations: { immediate: ["Remove infected leaves"], chemical: [{ action: "Spray fungicide", cost: "200" }] },
  observations: ["Dark lesions on leaves"],
  followUp: { days: 5, checkPoints: ["Recheck in 5 days"] },
  needsExpertReview: true,
};

describe("diagnosisParser.parse — success", () => {
  const r = diagnosisParser.parse(JSON.stringify(goodJson), "plant");

  it("extracts and normalises the structured diagnosis", () => {
    expect(r.ok).toBe(true);
    expect(r.domainId).toBe("plant");
    expect(r.primaryDiagnosis).toBe("Late Blight");
    expect(r.possibleDiseases).toHaveLength(1); // the blank-name entry is dropped
    expect(r.severity.level).toBe("Severe");
    expect(r.observations).toEqual(["Dark lesions on leaves"]);
    expect(r.followUp.days).toBe(5);
    expect(r.needsExpertReview).toBe(true);
  });

  it("derives confidence from a numeric score", () => {
    expect(r.confidence.score).toBe(0.9);
    expect(r.confidence.isHigh).toBe(true);
  });

  it("flattens object-form recommendations to strings", () => {
    expect(r.recommendations.immediate).toEqual(["Remove infected leaves"]);
    expect(r.recommendations.chemical).toEqual(["Spray fungicide"]);
  });

  it("threads the risk assessment through", () => {
    expect(r.risk.overallScore).toBe(2); // spread high
    expect(r.risk.isHighRisk).toBe(true);
  });

  it("supplies the default disclaimer when none is given", () => {
    expect(r.disclaimer).toContain("AI-based prediction only");
  });
});

describe("diagnosisParser.parse — confidence from label", () => {
  it("maps a medium confidence label to ~0.6", () => {
    const r = diagnosisParser.parse(JSON.stringify({ primaryDiagnosis: { name: "X", confidence: "medium" } }), "plant");
    expect(r.confidence.score).toBe(0.6);
    expect(r.confidence.isMedium).toBe(true);
  });
});

describe("diagnosisParser.parse — JSON extraction", () => {
  it("reads JSON from a markdown code fence", () => {
    const text = "Here you go:\n```json\n" + JSON.stringify({ disease: "Rust" }) + "\n```";
    expect(diagnosisParser.parse(text, "plant").primaryDiagnosis).toBe("Rust");
  });
  it("reads JSON embedded in surrounding prose", () => {
    const text = 'The result is ' + JSON.stringify({ diagnosis: "Wilt" }) + ' — hope it helps.';
    expect(diagnosisParser.parse(text, "plant").primaryDiagnosis).toBe("Wilt");
  });
});

describe("diagnosisParser.parse — failure", () => {
  it("returns a clearly-marked, safe failure record on unparseable output", () => {
    const r = diagnosisParser.parse("Sorry, I could not tell.", "plant");
    expect(r.ok).toBe(false);
    expect(r.primaryDiagnosis).toBe("Unable to Detect");
    expect(r.needsMoreImages).toBe(true);
    expect(r.needsExpertReview).toBe(true);
    expect(r.confidence.isLow).toBe(true);
    expect(r.parseError).toBeTruthy();
    expect(r.disclaimer).toContain("AI-based prediction only");
  });
  it("defaults domainId to 'unknown' when absent from args and JSON", () => {
    expect(diagnosisParser.parse("not json").domainId).toBe("unknown");
  });
});
