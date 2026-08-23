/* DPR project models — indicative unit economics for the enterprises Indian
   banks and NABARD most often finance.

   IMPORTANT — these are PLANNING DEFAULTS, not quoted rates. They exist so a
   farmer starts from a sane draft instead of a blank form; every figure is
   editable in the wizard and the generated document says so on its face. The
   app must never present them as a bank's sanctioned unit cost (see the data
   honesty risk in ROADMAP.md).

   Cost/revenue heads are "per unit per year at FULL capacity". The ramps then
   scale them: revenueRamp is capacity utilisation of income, opexRamp of
   running cost. The two differ on purpose — an orchard pays upkeep for years
   before it fruits, which is exactly what the loan moratorium is for. The
   last value of each ramp repeats for the rest of the horizon. */

export const DPR_MODELS = [
  {
    id: "dairy",
    label: "Dairy — crossbred milch cattle",
    enterprise: "dairy",
    unitLabel: "milch animal",
    unitHint: "Number of crossbred cows/buffaloes in the unit",
    defaultUnits: 5,
    horizonYears: 7,
    capital: [
      { id: "animals",   label: "Milch animals",                perUnit: 70000 },
      { id: "shed",      label: "Cattle shed (civil work)",     perUnit: 25000, lifeYears: 20, civil: true },
      { id: "equipment", label: "Chaff cutter, cans, utensils", perUnit: 6000,  lifeYears: 10 },
    ],
    recurring: [
      { id: "concentrate", label: "Concentrate feed",      perUnit: 30000 },
      { id: "fodder",      label: "Green & dry fodder",    perUnit: 18000 },
      { id: "vet",         label: "Veterinary & breeding", perUnit: 2000 },
      { id: "insurance",   label: "Cattle insurance",      perUnit: 2800 },
      { id: "labour",      label: "Labour",                perUnit: 7000 },
      { id: "misc",        label: "Electricity & misc.",   perUnit: 1700 },
    ],
    revenue: [
      /* 10 litres/day over a 300-day lactation — the mid-range for the
         crossbred cattle these schemes finance. */
      { id: "milk",   label: "Milk sales",     perUnit: 105000 },
      { id: "manure", label: "Manure / gobar", perUnit: 2500 },
    ],
    output: { metric: "Milk", unit: "litre", perUnit: 3000, pricePerUnit: 35 },
    revenueRamp: [0.75, 0.95, 1],
    opexRamp:    [0.85, 0.98, 1],
    finance: { marginPct: 10, ratePct: 11, tenureYears: 7, moratoriumMonths: 6 },
  },
  {
    id: "broiler",
    label: "Poultry — broiler (batch shed)",
    enterprise: "poultry",
    unitLabel: "1000-bird capacity",
    unitHint: "Shed capacity in thousands of birds per batch",
    defaultUnits: 1,
    horizonYears: 7,
    capital: [
      { id: "shed",      label: "Poultry shed (civil work)",   perUnit: 250000, lifeYears: 20, civil: true },
      { id: "equipment", label: "Feeders, drinkers, brooders", perUnit: 60000,  lifeYears: 10 },
    ],
    recurring: [
      { id: "chicks",   label: "Day-old chicks (6 cycles)", perUnit: 270000 },
      { id: "feed",     label: "Broiler feed",              perUnit: 777480 },
      { id: "medicine", label: "Vaccination & medicine",    perUnit: 30000 },
      { id: "labour",   label: "Labour",                    perUnit: 66000 },
      { id: "power",    label: "Power, litter & fuel",      perUnit: 42000 },
      { id: "misc",     label: "Misc. & marketing",         perUnit: 18000 },
    ],
    revenue: [
      /* 6 cycles × 950 birds saleable (5% mortality) × 2.2 kg at ₹110/kg. */
      { id: "birds",  label: "Live bird sales (6 cycles)", perUnit: 1379400 },
      { id: "byprod", label: "Manure & gunny bags",        perUnit: 18000 },
    ],
    output: { metric: "Live weight", unit: "kg", perUnit: 12540, pricePerUnit: 110 },
    revenueRamp: [0.7, 0.9, 1],
    opexRamp:    [0.75, 0.92, 1],
    finance: { marginPct: 15, ratePct: 11, tenureYears: 7, moratoriumMonths: 6 },
  },
  {
    id: "goat",
    label: "Goat rearing — 20 does + 1 buck",
    enterprise: "goat",
    unitLabel: "20+1 goat unit",
    unitHint: "Each unit is 20 breeding does with 1 buck",
    defaultUnits: 1,
    horizonYears: 7,
    capital: [
      { id: "animals",   label: "Breeding does & buck",      perUnit: 172000 },
      { id: "shed",      label: "Goat shed (civil work)",    perUnit: 120000, lifeYears: 20, civil: true },
      { id: "equipment", label: "Feeders, troughs, fencing", perUnit: 15000,  lifeYears: 10 },
    ],
    recurring: [
      /* Largely grazing-based, with supplementary concentrate. */
      { id: "feed",      label: "Feed & fodder",       perUnit: 84000 },
      { id: "vet",       label: "Veterinary care",     perUnit: 12000 },
      { id: "insurance", label: "Livestock insurance", perUnit: 8600 },
      { id: "labour",    label: "Labour",              perUnit: 36000 },
      { id: "misc",      label: "Misc.",               perUnit: 7000 },
    ],
    revenue: [
      /* 20 does at ~1.5 kiddings a year and 1.4 kids a kidding, less
         mortality, gives ~36 kids for sale. */
      { id: "kids",   label: "Kid sales",          perUnit: 234000 },
      { id: "culled", label: "Culled adult sales", perUnit: 20000 },
      { id: "manure", label: "Manure",             perUnit: 7000 },
    ],
    output: { metric: "Kids sold", unit: "kid", perUnit: 36, pricePerUnit: 6500 },
    revenueRamp: [0.5, 0.85, 1],
    opexRamp:    [0.8, 0.95, 1],
    finance: { marginPct: 10, ratePct: 11, tenureYears: 7, moratoriumMonths: 12 },
  },
  {
    id: "fishery",
    label: "Fish — composite carp culture",
    enterprise: "fish",
    unitLabel: "hectare of pond",
    unitHint: "Water-spread area under culture, in hectares",
    defaultUnits: 1,
    horizonYears: 9,
    capital: [
      { id: "pond",  label: "Pond construction / renovation", perUnit: 400000, lifeYears: 20, civil: true },
      { id: "inlet", label: "Inlet-outlet & pump set",        perUnit: 70000,  lifeYears: 10 },
      { id: "nets",  label: "Nets & equipment",               perUnit: 40000,  lifeYears: 5 },
    ],
    recurring: [
      { id: "seed",    label: "Fingerlings / seed",        perUnit: 45000 },
      /* Composite carp leans on the pond's natural productivity, so feed is
         supplementary rather than the whole ration. */
      { id: "feed",    label: "Supplementary feed",        perUnit: 170000 },
      { id: "lime",    label: "Lime, manure & fertiliser", perUnit: 28000 },
      { id: "labour",  label: "Labour & watch-and-ward",   perUnit: 66000 },
      { id: "harvest", label: "Harvesting & marketing",    perUnit: 26000 },
    ],
    revenue: [
      { id: "fish", label: "Table fish sales", perUnit: 520000 },
    ],
    output: { metric: "Fish", unit: "kg", perUnit: 4000, pricePerUnit: 130 },
    revenueRamp: [0.6, 0.9, 1],
    opexRamp:    [0.8, 0.95, 1],
    finance: { marginPct: 10, ratePct: 11, tenureYears: 9, moratoriumMonths: 12 },
  },
  {
    id: "orchard",
    label: "Horticulture — mango orchard",
    enterprise: "horti",
    unitLabel: "acre",
    unitHint: "Area to be brought under the orchard, in acres",
    defaultUnits: 2,
    horizonYears: 12,
    capital: [
      { id: "landdev",    label: "Land development & layout",     perUnit: 45000, lifeYears: 20 },
      { id: "planting",   label: "Planting material & planting",  perUnit: 16000, lifeYears: 20 },
      { id: "irrigation", label: "Drip irrigation system",        perUnit: 85000, lifeYears: 10 },
      { id: "fencing",    label: "Fencing",                       perUnit: 35000, lifeYears: 15, civil: true },
      { id: "water",      label: "Borewell / water source share", perUnit: 40000, lifeYears: 15, civil: true },
    ],
    recurring: [
      { id: "nutrition", label: "Manure & fertiliser", perUnit: 14000 },
      { id: "ppc",       label: "Plant protection",    perUnit: 8000 },
      { id: "water",     label: "Irrigation & power",  perUnit: 6000 },
      { id: "labour",    label: "Labour & upkeep",     perUnit: 22000 },
      { id: "misc",      label: "Harvest & misc.",     perUnit: 4000 },
    ],
    revenue: [
      { id: "fruit", label: "Fruit sales", perUnit: 210000 },
    ],
    output: { metric: "Fruit", unit: "kg", perUnit: 6000, pricePerUnit: 35 },
    /* Gestation: no fruit for three years, full bearing from year 7. Upkeep,
       however, starts immediately — hence the very different opex ramp. */
    revenueRamp: [0, 0, 0, 0.25, 0.5, 0.8, 1],
    opexRamp:    [0.45, 0.55, 0.7, 0.85, 1],
    finance: { marginPct: 10, ratePct: 10.5, tenureYears: 12, moratoriumMonths: 48 },
  },
  {
    id: "custom",
    label: "Custom project",
    enterprise: "other",
    unitLabel: "unit",
    unitHint: "Whatever one unit of your project is",
    defaultUnits: 1,
    horizonYears: 7,
    capital:   [{ id: "c1", label: "Capital item", perUnit: 0, lifeYears: 10 }],
    recurring: [{ id: "r1", label: "Running cost", perUnit: 0 }],
    revenue:   [{ id: "v1", label: "Sales",        perUnit: 0 }],
    output: { metric: "Output", unit: "unit", perUnit: 0, pricePerUnit: 0 },
    revenueRamp: [1],
    opexRamp:    [1],
    finance: { marginPct: 10, ratePct: 11, tenureYears: 7, moratoriumMonths: 6 },
  },
];

export const getModel = (id) => DPR_MODELS.find((m) => m.id === id) || DPR_MODELS[0];

/* NABARD appraisal conventionally discounts at 15% for BCR/NPV. */
export const DISCOUNT_RATE_PCT = 15;

/* Thresholds a lending officer reads the summary against. Drawn from common
   NABARD/bank appraisal norms; shown as guidance, never as a sanction.

   The BCR band is deliberately lower than the 1.5 often quoted, because BCR
   here is computed GROSS — discounted revenue over discounted capital *plus*
   operating cost. On that basis even a healthy livestock unit lands near
   1.1-1.3, since feed alone is most of turnover; the 1.5-style figures come
   from ratios taken on incremental net benefit. Judging a gross ratio against
   a net-basis threshold would mark sound proposals as unviable. */
export const VIABILITY = {
  dscr: { good: 1.75, ok: 1.5,  label: "Debt service coverage" },
  bcr:  { good: 1.2,  ok: 1.05, label: "Benefit-cost ratio" },
  irr:  { good: 20,   ok: 15,   label: "Internal rate of return" },
};

/* Applied to every generated document. The DPR is a planning aid the farmer
   takes to a bank — it is not an appraisal and not a sanction. */
export const DPR_DISCLAIMER =
  "This Detailed Project Report is prepared from figures entered by the applicant and " +
  "indicative planning norms built into AgriOS India. It is a planning aid, not a bank " +
  "appraisal or a sanction. Unit costs, yields and prices must be verified against current " +
  "local rates and the financing bank's or NABARD's applicable unit-cost schedule before submission.";
