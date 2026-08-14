/* Eligibility engine — pure function, no I/O, no side effects.
   Input: farmer profile (from profileMemory) + a scheme definition.
   Output: { status, score, reasons, missing }
     status: "eligible" | "partial" | "unlikely" | "unknown"
     score:  0–100 (higher = more confident match)
     reasons: string[] why they qualify
     missing: string[] what's needed to confirm */

/* Parse land size strings like "3 acre", "2.5 bigha", "1 hectare" → acres */
function parseAcres(landSize) {
  if (!landSize) return null;
  const s = String(landSize).toLowerCase().trim();
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  // Specific units first: "bigha" and "guntha" both contain the substring
  // "ha", so they must be matched before the loose hectare/"ha" check below.
  if (s.includes("bigha")) return n * 0.62; // Pucca bigha (approx)
  if (s.includes("gunta")) return n * 0.025; // matches gunta / guntha
  if (s.includes("hectare") || s.includes("ha")) return n * 2.47;
  return n; // assume acres
}

/* Derive farmer category from land holding */
function deriveCategory(acres) {
  if (acres === null) return null;
  if (acres < 1.25) return "marginal";
  if (acres <= 2.5) return "small";
  return "large";
}

export function checkEligibility(profile, scheme) {
  const rules = scheme.eligibility;
  const reasons = [];
  const missing = [];
  let score = 0;
  let unknownCount = 0;

  /* ---- Land size ---- */
  const acres = parseAcres(profile.landSize);
  const category = deriveCategory(acres);

  if (acres !== null) {
    if (rules.landMin !== null && acres < rules.landMin) {
      return { status: "unlikely", score: 5, reasons: [], missing: [],
        note: `Requires at least ${rules.landMin} acre land holding.` };
    }
    if (rules.landMax !== null && acres > rules.landMax) {
      return { status: "unlikely", score: 5, reasons: [], missing: [],
        note: `Maximum land holding for this scheme is ${rules.landMax} acres.` };
    }
    score += 25;
    reasons.push(`Land size (${profile.landSize}) is within scheme limits`);
  } else {
    unknownCount++;
    missing.push("Add your land size in your farm profile to check land eligibility");
  }

  /* ---- Farmer category (small / marginal / large) ---- */
  if (rules.categories && !rules.categories.includes("all")) {
    if (category) {
      if (rules.categories.includes(category)) {
        score += 20;
        reasons.push(`You qualify as a ${category} farmer (${rules.categories.join("/")} eligible)`);
      } else {
        return { status: "unlikely", score: 10, reasons: [],
          missing: [], note: `This scheme is for ${rules.categories.join("/")} farmers only.` };
      }
    } else {
      unknownCount++;
      missing.push("Add land size to determine your farmer category (marginal/small/large)");
    }
  } else {
    score += 20;
    reasons.push("All farmer categories are eligible");
  }

  /* ---- Farm type ---- */
  if (rules.farmTypes) {
    const profileTypes = profile.farmType || [];
    const matchedTypes = profileTypes.filter((t) => rules.farmTypes.includes(t));
    if (profileTypes.length === 0) {
      unknownCount++;
      missing.push(`Update your farm profile with your farm type — scheme is for ${rules.farmTypes.join(", ")}`);
    } else if (matchedTypes.length > 0) {
      score += 20;
      reasons.push(`Your farm type (${matchedTypes.join(", ")}) is covered`);
    } else {
      return { status: "unlikely", score: 5, reasons: [], missing: [],
        note: `This scheme is for ${rules.farmTypes.join("/")} farms only.` };
    }
  } else {
    score += 20;
    reasons.push("All farm types are eligible");
  }

  /* ---- Documents ---- */
  const docChecks = [];
  if (rules.needsAadhar) docChecks.push("Aadhaar card");
  if (rules.needsBankAccount) docChecks.push("bank account");
  if (rules.needsLandRecord) docChecks.push("land ownership record");
  if (docChecks.length > 0) {
    score += 15;
    reasons.push(`Key documents needed: ${docChecks.join(", ")}`);
  } else {
    score += 15;
    reasons.push("No documents required to apply");
  }

  /* ---- State-specific ---- */
  if (rules.states) {
    const profileState = (profile.location || "").toLowerCase();
    const matched = rules.states.some((s) => profileState.includes(s.toLowerCase()));
    if (!profileState) {
      unknownCount++;
      missing.push(`Add your location — this scheme is only available in: ${rules.states.join(", ")}`);
    } else if (matched) {
      score += 20;
      reasons.push(`Available in your state`);
    } else {
      return { status: "unlikely", score: 5, reasons: [], missing: [],
        note: `This scheme is only available in: ${rules.states.join(", ")}.` };
    }
  } else {
    score += 20;
  }

  /* ---- Final status ---- */
  let status;
  if (unknownCount === 0 && score >= 70) status = "eligible";
  else if (score >= 40 || unknownCount <= 1) status = "partial";
  else status = "unknown";

  return { status, score, reasons, missing };
}

export const ELIGIBILITY_LABELS = {
  eligible: "Likely eligible",
  partial: "May be eligible",
  unlikely: "Unlikely to qualify",
  unknown: "Need more info",
};

export const ELIGIBILITY_COLORS = (T) => ({
  eligible: { bg: T.primarySoft, fg: T.primary },
  partial:  { bg: T.orangeSoft,  fg: T.orange  },
  unlikely: { bg: T.redSoft,     fg: T.red     },
  unknown:  { bg: T.surface2,    fg: T.inkSoft },
});
