/* Area unit conversion — the app's other modules (land parcels, crop calendar)
   only ever store areaAcres, so every unit here converts to/from acres as the
   single internal base unit.

   Bigha has no single legal definition in India — it varies by state (e.g.
   ~0.625 acre in UP/Bihar "pucca" bigha, ~0.333 acre in West Bengal). We use
   the widely-cited UP/Bihar pucca bigha factor and label it clearly as
   approximate so a farmer in a different state isn't misled by a silent
   assumption (see project rule: don't invent agricultural data).

   acresPerUnit = how many acres ONE unit of this type is worth. */

export const AREA_UNITS = {
  acre:    { label: { en: "Acre", hi: "एकड़", bn: "একর" }, acresPerUnit: 1, approx: false },
  hectare: { label: { en: "Hectare", hi: "हेक्टेयर", bn: "হেক্টর" }, acresPerUnit: 2.47105, approx: false },
  bigha:   { label: { en: "Bigha (approx.)", hi: "बीघा (लगभग)", bn: "বিঘা (আনুমানিক)" }, acresPerUnit: 0.625, approx: true },
  decimal: { label: { en: "Decimal", hi: "डेसिमल", bn: "ডেসিমল" }, acresPerUnit: 1 / 100, approx: false },
  sqm:     { label: { en: "Square metre", hi: "वर्ग मीटर", bn: "বর্গমিটার" }, acresPerUnit: 1 / 4046.86, approx: false },
  sqft:    { label: { en: "Square foot", hi: "वर्ग फुट", bn: "বর্গ ফুট" }, acresPerUnit: 1 / 43560, approx: false },
};

export const AREA_UNIT_OPTIONS = Object.keys(AREA_UNITS);

export function toAcres(value, unit) {
  const u = AREA_UNITS[unit];
  const n = Number(value);
  if (!u || !Number.isFinite(n) || n < 0) return 0;
  return n * u.acresPerUnit;
}

export function fromAcres(acres, unit) {
  const u = AREA_UNITS[unit];
  const n = Number(acres);
  if (!u || !Number.isFinite(n) || n < 0) return 0;
  return n / u.acresPerUnit;
}

export function acresToHectares(acres) {
  const n = Number(acres);
  return Number.isFinite(n) && n > 0 ? n / AREA_UNITS.hectare.acresPerUnit : 0;
}
