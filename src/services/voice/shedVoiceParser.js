/* Parser for hands-free spoken shed operational logs.
 *
 * Extracts structured yield records from multilingual voice input
 * (e.g., "Ganga morning 12.5 litres", "গঙ্গা সকাল ১০ লিটার", "गाय १ सुबह ५ किलो"). */

const AM_REGEX = /\b(morning|am)\b|সকাল|সকালের|सुबह|प्रातः|काले|ఉదయం|காலை/i;
const PM_REGEX = /\b(evening|pm)\b|সন্ধ্যা|বিকাল|শাম|शाम|सायं|மாலை|సాయంత్రం/i;

const LITRE_REGEX = /\b(litres?|liters?|l)\b|লিটার|लीटर|லிட்டர்|లీటర్/i;
const KG_REGEX    = /\b(kgs?|kilos?|kilograms?)\b|কেজি|কিলো|किग्रा|किलो/i;

/* Normalizes Indic numerals (০-৯, ०-९) to ASCII 0-9 */
function normalizeDigits(str) {
  return str
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
}

export function parseShedVoiceCommand(transcript, knownAnimals = []) {
  if (!transcript || typeof transcript !== "string") return null;

  const normalized = normalizeDigits(transcript.trim().toLowerCase());

  // 1. Detect Animal first so tag numbers (e.g. tag-102) aren't mistaken for yields
  let matchedAnimal = null;
  let remainingText = normalized;

  if (Array.isArray(knownAnimals) && knownAnimals.length > 0) {
    for (const animal of knownAnimals) {
      const aName = (animal.name || "").toLowerCase();
      const aTag  = (animal.tag_id || "").toLowerCase();
      if (aTag && normalized.includes(aTag)) {
        matchedAnimal = animal;
        remainingText = remainingText.replace(aTag, " ");
        break;
      }
      if (aName && normalized.includes(aName)) {
        matchedAnimal = animal;
        remainingText = remainingText.replace(aName, " ");
        break;
      }
    }
  }

  // 2. Detect Session
  let session;
  const hasPm = PM_REGEX.test(normalized);
  const hasAm = AM_REGEX.test(normalized);
  if (hasPm && !hasAm) session = "pm";
  else if (hasAm) session = "am";
  else {
    const hour = new Date().getHours();
    session = hour >= 14 ? "pm" : "am";
  }

  // 3. Detect Unit
  let unit = "kg";
  const hasLitre = LITRE_REGEX.test(normalized);
  const hasKg    = KG_REGEX.test(normalized);
  if (hasLitre && !hasKg) unit = "L";

  // 4. Detect Quantity from remaining text
  const numMatch = remainingText.match(/(\d+(?:\.\d+)?)/);
  const yieldAmount = numMatch ? parseFloat(numMatch[1]) : null;

  const words = normalized.split(/\s+/);
  const candidateName = matchedAnimal?.name || words.find((w) => !/^\d/.test(w) && w.length > 1) || null;

  return {
    raw: transcript,
    animal: matchedAnimal,
    animalName: candidateName,
    session,
    yieldAmount,
    unit,
    confidence: yieldAmount !== null && (matchedAnimal || candidateName) ? "high" : "low",
  };
}
