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

/* label stays English — it is the canonical head name the appraisal maths and
   the tests key on, and the fallback when a language has no translation.
   draftFrom() seeds the farmer's editable draft from i18n instead. */
export const DPR_MODELS = [
  {
    id: "dairy",
    label: "Dairy — crossbred milch cattle",
    i18n: { en: "Dairy — crossbred milch cattle", hi: "डेयरी — संकर दुधारू पशु", bn: "ডেয়ারি — সংকর দুগ্ধবতী গবাদি পশু" },
    enterprise: "dairy",
    unitLabel: "milch animal",
    unitLabelI18n: { en: "milch animal", hi: "दुधारू पशु", bn: "দুগ্ধবতী পশু" },
    unitHint: "Number of crossbred cows/buffaloes in the unit",
    unitHintI18n: { en: "Number of crossbred cows/buffaloes in the unit", hi: "इकाई में संकर गाय/भैंस की संख्या", bn: "ইউনিটে সংকর গরু/মহিষের সংখ্যা" },
    defaultUnits: 5,
    horizonYears: 7,
    capital: [
      { id: "animals",   label: "Milch animals",                perUnit: 70000, i18n: { en: "Milch animals", hi: "दुधारू पशु", bn: "দুগ্ধবতী পশু" } },
      { id: "shed",      label: "Cattle shed (civil work)",     perUnit: 25000, lifeYears: 20, civil: true, i18n: { en: "Cattle shed (civil work)", hi: "पशु शेड (निर्माण कार्य)", bn: "গোয়ালঘর (নির্মাণ কাজ)" } },
      { id: "equipment", label: "Chaff cutter, cans, utensils", perUnit: 6000,  lifeYears: 10, i18n: { en: "Chaff cutter, cans, utensils", hi: "चारा कटर, कैन, बर्तन", bn: "খড় কাটার যন্ত্র, ক্যান, বাসন" } },
    ],
    recurring: [
      { id: "concentrate", label: "Concentrate feed",      perUnit: 30000, i18n: { en: "Concentrate feed", hi: "दाना मिश्रण", bn: "দানাদার খাদ্য" } },
      { id: "fodder",      label: "Green & dry fodder",    perUnit: 18000, i18n: { en: "Green & dry fodder", hi: "हरा व सूखा चारा", bn: "সবুজ ও শুকনো খড়" } },
      { id: "vet",         label: "Veterinary & breeding", perUnit: 2000, i18n: { en: "Veterinary & breeding", hi: "पशु चिकित्सा व प्रजनन", bn: "পশুচিকিৎসা ও প্রজনন" } },
      { id: "insurance",   label: "Cattle insurance",      perUnit: 2800, i18n: { en: "Cattle insurance", hi: "पशु बीमा", bn: "গবাদি পশু বিমা" } },
      { id: "labour",      label: "Labour",                perUnit: 7000, i18n: { en: "Labour", hi: "श्रम", bn: "শ্রম" } },
      { id: "misc",        label: "Electricity & misc.",   perUnit: 1700, i18n: { en: "Electricity & misc.", hi: "बिजली व अन्य", bn: "বিদ্যুৎ ও অন্যান্য" } },
    ],
    revenue: [
      /* 10 litres/day over a 300-day lactation — the mid-range for the
         crossbred cattle these schemes finance. */
      { id: "milk",   label: "Milk sales",     perUnit: 105000, i18n: { en: "Milk sales", hi: "दूध बिक्री", bn: "দুধ বিক্রয়" } },
      { id: "manure", label: "Manure / gobar", perUnit: 2500, i18n: { en: "Manure / gobar", hi: "गोबर खाद", bn: "গোবর সার" } },
    ],
    output: { metric: "Milk", unit: "litre", perUnit: 3000, pricePerUnit: 35 },
    revenueRamp: [0.75, 0.95, 1],
    opexRamp:    [0.85, 0.98, 1],
    finance: { marginPct: 10, ratePct: 11, tenureYears: 7, moratoriumMonths: 6 },
  },
  {
    id: "broiler",
    label: "Poultry — broiler (batch shed)",
    i18n: { en: "Poultry — broiler (batch shed)", hi: "मुर्गी पालन — ब्रॉयलर (बैच शेड)", bn: "হাঁস-মুরগি — ব্রয়লার (ব্যাচ শেড)" },
    enterprise: "poultry",
    unitLabel: "1000-bird capacity",
    unitLabelI18n: { en: "1000-bird capacity", hi: "1000 पक्षी क्षमता", bn: "১০০০ পাখির ধারণক্ষমতা" },
    unitHint: "Shed capacity in thousands of birds per batch",
    unitHintI18n: { en: "Shed capacity in thousands of birds per batch", hi: "प्रति बैच हज़ार पक्षियों में शेड क्षमता", bn: "প্রতি ব্যাচে হাজার পাখিতে শেডের ধারণক্ষমতা" },
    defaultUnits: 1,
    horizonYears: 7,
    capital: [
      { id: "shed",      label: "Poultry shed (civil work)",   perUnit: 250000, lifeYears: 20, civil: true, i18n: { en: "Poultry shed (civil work)", hi: "मुर्गी शेड (निर्माण कार्य)", bn: "মুরগির শেড (নির্মাণ কাজ)" } },
      { id: "equipment", label: "Feeders, drinkers, brooders", perUnit: 60000,  lifeYears: 10, i18n: { en: "Feeders, drinkers, brooders", hi: "दाना-पानी पात्र, ब्रूडर", bn: "খাদ্য-জল পাত্র, ব্রুডার" } },
    ],
    recurring: [
      { id: "chicks",   label: "Day-old chicks (6 cycles)", perUnit: 270000, i18n: { en: "Day-old chicks (6 cycles)", hi: "एक दिन के चूज़े (6 चक्र)", bn: "একদিনের ছানা (৬ চক্র)" } },
      { id: "feed",     label: "Broiler feed",              perUnit: 777480, i18n: { en: "Broiler feed", hi: "ब्रॉयलर दाना", bn: "ব্রয়লার খাদ্য" } },
      { id: "medicine", label: "Vaccination & medicine",    perUnit: 30000, i18n: { en: "Vaccination & medicine", hi: "टीकाकरण व दवा", bn: "টিকা ও ওষুধ" } },
      { id: "labour",   label: "Labour",                    perUnit: 66000, i18n: { en: "Labour", hi: "श्रम", bn: "শ্রম" } },
      { id: "power",    label: "Power, litter & fuel",      perUnit: 42000, i18n: { en: "Power, litter & fuel", hi: "बिजली, बिछावन व ईंधन", bn: "বিদ্যুৎ, লিটার ও জ্বালানি" } },
      { id: "misc",     label: "Misc. & marketing",         perUnit: 18000, i18n: { en: "Misc. & marketing", hi: "अन्य व विपणन", bn: "অন্যান্য ও বিপণন" } },
    ],
    revenue: [
      /* 6 cycles × 950 birds saleable (5% mortality) × 2.2 kg at ₹110/kg. */
      { id: "birds",  label: "Live bird sales (6 cycles)", perUnit: 1379400, i18n: { en: "Live bird sales (6 cycles)", hi: "जीवित पक्षी बिक्री (6 चक्र)", bn: "জীবন্ত পাখি বিক্রয় (৬ চক্র)" } },
      { id: "byprod", label: "Manure & gunny bags",        perUnit: 18000, i18n: { en: "Manure & gunny bags", hi: "खाद व बोरे", bn: "সার ও চটের বস্তা" } },
    ],
    output: { metric: "Live weight", unit: "kg", perUnit: 12540, pricePerUnit: 110 },
    revenueRamp: [0.7, 0.9, 1],
    opexRamp:    [0.75, 0.92, 1],
    finance: { marginPct: 15, ratePct: 11, tenureYears: 7, moratoriumMonths: 6 },
  },
  {
    id: "goat",
    label: "Goat rearing — 20 does + 1 buck",
    i18n: { en: "Goat rearing — 20 does + 1 buck", hi: "बकरी पालन — 20 बकरी + 1 बकरा", bn: "ছাগল পালন — ২০টি ছাগী + ১টি পাঁঠা" },
    enterprise: "goat",
    unitLabel: "20+1 goat unit",
    unitLabelI18n: { en: "20+1 goat unit", hi: "20+1 बकरी इकाई", bn: "২০+১ ছাগল ইউনিট" },
    unitHint: "Each unit is 20 breeding does with 1 buck",
    unitHintI18n: { en: "Each unit is 20 breeding does with 1 buck", hi: "हर इकाई 20 प्रजनन बकरी + 1 बकरा", bn: "প্রতিটি ইউনিট ২০টি প্রজননক্ষম ছাগী ও ১টি পাঁঠা" },
    defaultUnits: 1,
    horizonYears: 7,
    capital: [
      { id: "animals",   label: "Breeding does & buck",      perUnit: 172000, i18n: { en: "Breeding does & buck", hi: "प्रजनन बकरी व बकरा", bn: "প্রজননক্ষম ছাগী ও পাঁঠা" } },
      { id: "shed",      label: "Goat shed (civil work)",    perUnit: 120000, lifeYears: 20, civil: true, i18n: { en: "Goat shed (civil work)", hi: "बकरी शेड (निर्माण कार्य)", bn: "ছাগলের ঘর (নির্মাণ কাজ)" } },
      { id: "equipment", label: "Feeders, troughs, fencing", perUnit: 15000,  lifeYears: 10, i18n: { en: "Feeders, troughs, fencing", hi: "दाना पात्र, नांद, बाड़", bn: "খাদ্য পাত্র, চাড়ি, বেড়া" } },
    ],
    recurring: [
      /* Largely grazing-based, with supplementary concentrate. */
      { id: "feed",      label: "Feed & fodder",       perUnit: 84000, i18n: { en: "Feed & fodder", hi: "दाना व चारा", bn: "খাদ্য ও খড়" } },
      { id: "vet",       label: "Veterinary care",     perUnit: 12000, i18n: { en: "Veterinary care", hi: "पशु चिकित्सा", bn: "পশুচিকিৎসা" } },
      { id: "insurance", label: "Livestock insurance", perUnit: 8600, i18n: { en: "Livestock insurance", hi: "पशुधन बीमा", bn: "পশুসম্পদ বিমা" } },
      { id: "labour",    label: "Labour",              perUnit: 36000, i18n: { en: "Labour", hi: "श्रम", bn: "শ্রম" } },
      { id: "misc",      label: "Misc.",               perUnit: 7000, i18n: { en: "Misc.", hi: "अन्य", bn: "অন্যান্য" } },
    ],
    revenue: [
      /* 20 does at ~1.5 kiddings a year and 1.4 kids a kidding, less
         mortality, gives ~36 kids for sale. */
      { id: "kids",   label: "Kid sales",          perUnit: 234000, i18n: { en: "Kid sales", hi: "मेमना बिक्री", bn: "ছাগলছানা বিক্রয়" } },
      { id: "culled", label: "Culled adult sales", perUnit: 20000, i18n: { en: "Culled adult sales", hi: "छँटे वयस्क पशु बिक्री", bn: "বাতিল প্রাপ্তবয়স্ক পশু বিক্রয়" } },
      { id: "manure", label: "Manure",             perUnit: 7000, i18n: { en: "Manure", hi: "खाद", bn: "সার" } },
    ],
    output: { metric: "Kids sold", unit: "kid", perUnit: 36, pricePerUnit: 6500 },
    revenueRamp: [0.5, 0.85, 1],
    opexRamp:    [0.8, 0.95, 1],
    finance: { marginPct: 10, ratePct: 11, tenureYears: 7, moratoriumMonths: 12 },
  },
  {
    id: "fishery",
    label: "Fish — composite carp culture",
    i18n: { en: "Fish — composite carp culture", hi: "मछली — मिश्रित कार्प पालन", bn: "মাছ — মিশ্র কার্প চাষ" },
    enterprise: "fish",
    unitLabel: "hectare of pond",
    unitLabelI18n: { en: "hectare of pond", hi: "हेक्टेयर तालाब", bn: "হেক্টর পুকুর" },
    unitHint: "Water-spread area under culture, in hectares",
    unitHintI18n: { en: "Water-spread area under culture, in hectares", hi: "पालन के अधीन जल क्षेत्र, हेक्टेयर में", bn: "চাষাধীন জলভাগের আয়তন, হেক্টরে" },
    defaultUnits: 1,
    horizonYears: 9,
    capital: [
      { id: "pond",  label: "Pond construction / renovation", perUnit: 400000, lifeYears: 20, civil: true, i18n: { en: "Pond construction / renovation", hi: "तालाब निर्माण / जीर्णोद्धार", bn: "পুকুর খনন / সংস্কার" } },
      { id: "inlet", label: "Inlet-outlet & pump set",        perUnit: 70000,  lifeYears: 10, i18n: { en: "Inlet-outlet & pump set", hi: "इनलेट-आउटलेट व पंप सेट", bn: "ইনলেট-আউটলেট ও পাম্প সেট" } },
      { id: "nets",  label: "Nets & equipment",               perUnit: 40000,  lifeYears: 5, i18n: { en: "Nets & equipment", hi: "जाल व उपकरण", bn: "জাল ও সরঞ্জাম" } },
    ],
    recurring: [
      { id: "seed",    label: "Fingerlings / seed",        perUnit: 45000, i18n: { en: "Fingerlings / seed", hi: "अंगुलिका / मत्स्य बीज", bn: "চারা মাছ / মৎস্য বীজ" } },
      /* Composite carp leans on the pond's natural productivity, so feed is
         supplementary rather than the whole ration. */
      { id: "feed",    label: "Supplementary feed",        perUnit: 170000, i18n: { en: "Supplementary feed", hi: "पूरक आहार", bn: "সম্পূরক খাদ্য" } },
      { id: "lime",    label: "Lime, manure & fertiliser", perUnit: 28000, i18n: { en: "Lime, manure & fertiliser", hi: "चूना, गोबर व उर्वरक", bn: "চুন, গোবর ও সার" } },
      { id: "labour",  label: "Labour & watch-and-ward",   perUnit: 66000, i18n: { en: "Labour & watch-and-ward", hi: "श्रम व रखवाली", bn: "শ্রম ও পাহারা" } },
      { id: "harvest", label: "Harvesting & marketing",    perUnit: 26000, i18n: { en: "Harvesting & marketing", hi: "कटाई व विपणन", bn: "ফসল সংগ্রহ ও বিপণন" } },
    ],
    revenue: [
      { id: "fish", label: "Table fish sales", perUnit: 520000, i18n: { en: "Table fish sales", hi: "खाद्य मछली बिक्री", bn: "খাবার মাছ বিক্রয়" } },
    ],
    output: { metric: "Fish", unit: "kg", perUnit: 4000, pricePerUnit: 130 },
    revenueRamp: [0.6, 0.9, 1],
    opexRamp:    [0.8, 0.95, 1],
    finance: { marginPct: 10, ratePct: 11, tenureYears: 9, moratoriumMonths: 12 },
  },
  {
    id: "orchard",
    label: "Horticulture — mango orchard",
    i18n: { en: "Horticulture — mango orchard", hi: "बागवानी — आम का बाग", bn: "উদ্যানপালন — আমের বাগান" },
    enterprise: "horti",
    unitLabel: "acre",
    unitLabelI18n: { en: "acre", hi: "एकड़", bn: "একর" },
    unitHint: "Area to be brought under the orchard, in acres",
    unitHintI18n: { en: "Area to be brought under the orchard, in acres", hi: "बाग के अंतर्गत क्षेत्र, एकड़ में", bn: "বাগানের আওতাধীন এলাকা, একরে" },
    defaultUnits: 2,
    horizonYears: 12,
    capital: [
      { id: "landdev",    label: "Land development & layout",     perUnit: 45000, lifeYears: 20, i18n: { en: "Land development & layout", hi: "भूमि विकास व लेआउट", bn: "জমি উন্নয়ন ও বিন্যাস" } },
      { id: "planting",   label: "Planting material & planting",  perUnit: 16000, lifeYears: 20, i18n: { en: "Planting material & planting", hi: "रोपण सामग्री व रोपाई", bn: "চারা ও রোপণ" } },
      { id: "irrigation", label: "Drip irrigation system",        perUnit: 85000, lifeYears: 10, i18n: { en: "Drip irrigation system", hi: "ड्रिप सिंचाई प्रणाली", bn: "ড্রিপ সেচ ব্যবস্থা" } },
      { id: "fencing",    label: "Fencing",                       perUnit: 35000, lifeYears: 15, civil: true, i18n: { en: "Fencing", hi: "बाड़", bn: "বেড়া" } },
      { id: "water",      label: "Borewell / water source share", perUnit: 40000, lifeYears: 15, civil: true, i18n: { en: "Borewell / water source share", hi: "बोरवेल / जल स्रोत हिस्सा", bn: "নলকূপ / জলের উৎসের অংশ" } },
    ],
    recurring: [
      { id: "nutrition", label: "Manure & fertiliser", perUnit: 14000, i18n: { en: "Manure & fertiliser", hi: "गोबर व उर्वरक", bn: "গোবর ও সার" } },
      { id: "ppc",       label: "Plant protection",    perUnit: 8000, i18n: { en: "Plant protection", hi: "पादप संरक्षण", bn: "উদ্ভিদ সুরক্ষা" } },
      { id: "water",     label: "Irrigation & power",  perUnit: 6000, i18n: { en: "Irrigation & power", hi: "सिंचाई व बिजली", bn: "সেচ ও বিদ্যুৎ" } },
      { id: "labour",    label: "Labour & upkeep",     perUnit: 22000, i18n: { en: "Labour & upkeep", hi: "श्रम व रखरखाव", bn: "শ্রম ও রক্ষণাবেক্ষণ" } },
      { id: "misc",      label: "Harvest & misc.",     perUnit: 4000, i18n: { en: "Harvest & misc.", hi: "कटाई व अन्य", bn: "আহরণ ও অন্যান্য" } },
    ],
    revenue: [
      { id: "fruit", label: "Fruit sales", perUnit: 210000, i18n: { en: "Fruit sales", hi: "फल बिक्री", bn: "ফল বিক্রয়" } },
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
    i18n: { en: "Custom project", hi: "स्वनिर्मित परियोजना", bn: "নিজস্ব প্রকল্প" },
    enterprise: "other",
    unitLabel: "unit",
    unitLabelI18n: { en: "unit", hi: "इकाई", bn: "ইউনিট" },
    unitHint: "Whatever one unit of your project is",
    unitHintI18n: { en: "Whatever one unit of your project is", hi: "आपकी परियोजना की एक इकाई जो भी हो", bn: "আপনার প্রকল্পের একটি ইউনিট যা-ই হোক" },
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
  dscr: { good: 1.75, ok: 1.5,  label: "Debt service coverage", i18n: { en: "Debt service coverage", hi: "ऋण चुकौती क्षमता", bn: "ঋণ পরিশোধ ক্ষমতা" } },
  bcr:  { good: 1.2,  ok: 1.05, label: "Benefit-cost ratio", i18n: { en: "Benefit-cost ratio", hi: "लाभ-लागत अनुपात", bn: "লাভ-ব্যয় অনুপাত" } },
  irr:  { good: 20,   ok: 15,   label: "Internal rate of return", i18n: { en: "Internal rate of return", hi: "आंतरिक प्रतिफल दर", bn: "অভ্যন্তরীণ আয়ের হার" } },
};

/* Applied to every generated document. The DPR is a planning aid the farmer
   takes to a bank — it is not an appraisal and not a sanction. */
export const DPR_DISCLAIMER =
  "This Detailed Project Report is prepared from figures entered by the applicant and " +
  "indicative planning norms built into AgriOS India. It is a planning aid, not a bank " +
  "appraisal or a sanction. Unit costs, yields and prices must be verified against current " +
  "local rates and the financing bank's or NABARD's applicable unit-cost schedule before submission.";
