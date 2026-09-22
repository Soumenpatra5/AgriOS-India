/* Escalation engine — decides when and how to escalate beyond AI diagnosis.
   Rules-based; new escalation types plug in via RULES array. */


const RULES = [
  {
    id:        "more_images",
    test:      (d) => d.needsMoreImages || d.confidence?.isLow,
    type:      "more_images",
    label:     "Take more photos for better accuracy",
    sublabel:  "Clearer photos from multiple angles improve diagnosis",
    icon:      "Camera",
    cta:       "retake",
    urgent:    false,
  },
  {
    id:        "symptom_detail",
    test:      (d) => d.confidence?.isLow || d.primaryDiagnosis === "Unable to Detect",
    type:      "symptoms",
    label:     "Fill in more symptom details",
    sublabel:  "More context helps the AI narrow down the diagnosis",
    icon:      "ClipboardList",
    cta:       "symptoms",
    urgent:    false,
  },
  {
    id:        "ai_chat",
    test:      (d) => d.confidence?.isMedium || d.confidence?.isLow,
    type:      "ai_chat",
    label:     "Ask AI Expert for more guidance",
    sublabel:  "Describe your problem in detail to our AI specialist",
    icon:      "Sparkles",
    cta:       "chat",
    urgent:    false,
  },
  {
    id:        "expert",
    test:      (d) => d.needsExpertReview || d.confidence?.isLow || d.risk?.isHighRisk,
    type:      "expert",
    label:     "Consult a local expert or veterinarian",
    sublabel:  "Find nearby agriculture officers and veterinary doctors",
    icon:      "Stethoscope",
    cta:       "nearby",
    urgent:    false,
  },
  {
    id:        "emergency",
    test:      (d) => d.risk?.urgency?.key === "emergency" || d.severity?.level === "Critical",
    type:      "emergency",
    label:     "EMERGENCY — Seek immediate expert help",
    sublabel:  "This condition requires urgent professional attention",
    icon:      "ShieldAlert",
    cta:       "emergency",
    urgent:    true,
  },
];

export const escalationEngine = {
  evaluate(parsed) {
    const flags = RULES.filter((r) => r.test(parsed)).map(({ test: _t, ...rest }) => rest);

    return {
      flags,
      hasEmergency:      flags.some((f) => f.type === "emergency"),
      needsExpert:       flags.some((f) => f.type === "expert" || f.type === "emergency"),
      needsMoreImages:   flags.some((f) => f.type === "more_images"),
      referralSummary:   parsed.needsExpertReview ? buildReferralSummary(parsed) : null,
    };
  },
};

function buildReferralSummary(parsed) {
  const lines = [
    `AgriOS India — Diagnostic Referral Summary`,
    `Date: ${new Date().toLocaleDateString("en-IN")}`,
    `Domain: ${parsed.domainId}`,
    `AI Diagnosis: ${parsed.primaryDiagnosis}`,
    `Severity: ${parsed.severity?.label || "Unknown"}`,
    `Confidence: ${parsed.confidence?.label || "low"}`,
    ``,
    `Observations:`,
    ...(parsed.observations || []).map((o) => `• ${o}`),
    ``,
    `Risk factors:`,
    ...(parsed.riskFactors || []).map((r) => `• ${r}`),
    ``,
    `DISCLAIMER: ${parsed.disclaimer}`,
  ];
  return lines.join("\n");
}
