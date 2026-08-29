/* Curated crop price dataset.
   MSP = Government of India Minimum Support Price (latest declared rates).
   Seasonal bands = historical typical mandi price ranges by season — NOT today's price.
   All prices in ₹/quintal unless unit specified otherwise.
   Source: cacp.dacnet.nic.in / PIB press releases. Update each season announcement. */

export const CROP_CATEGORIES = [
  { id: "cereal",     label: { en: "Cereals", hi: "अनाज", bn: "শস্য" },       icon: "Wheat",      emoji: "🌾", accent: "primary" },
  { id: "pulse",      label: { en: "Pulses", hi: "दालें", bn: "ডাল" },        icon: "Leaf",       emoji: "🫘", accent: "orange" },
  { id: "oilseed",    label: { en: "Oilseeds", hi: "तिलहन", bn: "তৈলবীজ" },      icon: "Sprout",     emoji: "🌻", accent: "yellow" },
  { id: "vegetable",  label: { en: "Vegetables", hi: "सब्ज़ी", bn: "সবজি" },    icon: "Package",    emoji: "🥬", accent: "primary" },
  { id: "fruit",      label: { en: "Fruits", hi: "फल", bn: "ফল" },        icon: "Apple",      emoji: "🍎", accent: "red" },
  { id: "cash",       label: { en: "Cash crops", hi: "नकदी फसलें", bn: "অর্থকরী ফসল" },    icon: "Leaf",       emoji: "🏭", accent: "orange" },
  { id: "spice",      label: { en: "Spices", hi: "मसाले", bn: "মশলা" },        icon: "FlaskConical", emoji: "🌶️", accent: "red" },
  { id: "livestock",  label: { en: "Livestock", hi: "पशुपालन", bn: "পশুপালন" },     icon: "Milk",       emoji: "🐄", accent: "blue" },
];

/* season: kharif | rabi | zaid | year-round */
export const CROPS = [
  /* ── Cereals ── */
  { id: "paddy",       name: "Paddy (Common)", hindi: "धान", bengali: "ধান", category: "cereal", unit: "qtl", season: "kharif",
    msp: 2300, bandLow: 1900, bandHigh: 2800, icon: "Wheat", emoji: "🌾",
    note: "MSP for Common grade. A-grade fetches ₹50–100 more. Grade before sale." },
  { id: "paddy-fine",  name: "Paddy (Fine)",   hindi: "बासमती", bengali: "বাসমতি", category: "cereal", unit: "qtl", season: "kharif",
    msp: 2300, bandLow: 3500, bandHigh: 8000, icon: "Wheat", emoji: "🍚",
    note: "Fine/aromatic varieties command a large premium over MSP in export-linked mandis." },
  { id: "wheat",       name: "Wheat",          hindi: "गेहूँ", bengali: "গম", category: "cereal", unit: "qtl", season: "rabi",
    msp: 2275, bandLow: 2100, bandHigh: 2700, icon: "Wheat", emoji: "🌾",
    note: "MSP 2024-25. Mandi peaks Mar–Apr at harvest; rises Oct–Nov when stocks thin." },
  { id: "maize",       name: "Maize",          hindi: "मक्का", bengali: "ভুট্টা", category: "cereal", unit: "qtl", season: "kharif",
    msp: 2090, bandLow: 1700, bandHigh: 2400, icon: "Wheat", emoji: "🌽",
    note: "Poultry feed demand keeps prices firmer Jun–Sep. Moisture below 14% critical." },
  { id: "jowar",       name: "Jowar",          hindi: "ज्वार", bengali: "জোয়ার", category: "cereal", unit: "qtl", season: "kharif",
    msp: 3371, bandLow: 2800, bandHigh: 4000, icon: "Wheat", emoji: "🌾", note: "MSP for Hybrid variety." },
  { id: "bajra",       name: "Bajra",          hindi: "बाजरा", bengali: "বাজরা", category: "cereal", unit: "qtl", season: "kharif",
    msp: 2625, bandLow: 2200, bandHigh: 3000, icon: "Wheat", emoji: "🌾", note: "" },
  { id: "ragi",        name: "Ragi",           hindi: "रागी", bengali: "রাগি", category: "cereal", unit: "qtl", season: "kharif",
    msp: 3846, bandLow: 3200, bandHigh: 4500, icon: "Wheat", emoji: "🌾", note: "High MSP; demand from health food segment growing." },
  { id: "barley",      name: "Barley",         hindi: "जौ", bengali: "যব", category: "cereal", unit: "qtl", season: "rabi",
    msp: 1735, bandLow: 1600, bandHigh: 2200, icon: "Wheat", emoji: "🌾", note: "Malting quality commands ₹200–400 premium." },

  /* ── Pulses ── */
  { id: "arhar",       name: "Arhar (Tur Dal)",hindi: "अरहर/तूर", bengali: "অড়হর", category: "pulse", unit: "qtl", season: "kharif",
    msp: 7000, bandLow: 6000, bandHigh: 9500, icon: "Leaf", emoji: "🫘",
    note: "Large price swings depending on import policy. Monitor before selling." },
  { id: "moong",       name: "Moong",          hindi: "मूँग", bengali: "মুগ", category: "pulse", unit: "qtl", season: "kharif",
    msp: 8682, bandLow: 7500, bandHigh: 10000, icon: "Leaf", emoji: "🫛", note: "" },
  { id: "urad",        name: "Urad (Black gram)",hindi: "उड़द", bengali: "উড়দ", category: "pulse", unit: "qtl", season: "kharif",
    msp: 7400, bandLow: 6500, bandHigh: 9000, icon: "Leaf", emoji: "🫘", note: "" },
  { id: "chana",       name: "Chana (Chickpea)",hindi: "चना", bengali: "ছোলা", category: "pulse", unit: "qtl", season: "rabi",
    msp: 5440, bandLow: 5000, bandHigh: 7000, icon: "Leaf", emoji: "🫘", note: "Rabi crop; peaks May–Jun when demand rises in summer." },
  { id: "masur",       name: "Masur (Lentil)", hindi: "मसूर", bengali: "মসুর", category: "pulse", unit: "qtl", season: "rabi",
    msp: 6425, bandLow: 5800, bandHigh: 7500, icon: "Leaf", emoji: "🫘", note: "" },
  { id: "moong-rabi",  name: "Moong (Zaid)",   hindi: "मूँग (गर्मी)", bengali: "গ্রীষ্মকালীন মুগ", category: "pulse", unit: "qtl", season: "zaid",
    msp: 8682, bandLow: 7500, bandHigh: 10000, icon: "Leaf", emoji: "🫛", note: "Same MSP as kharif moong." },

  /* ── Oilseeds ── */
  { id: "mustard",     name: "Mustard (Rapeseed)",hindi: "सरसों", bengali: "সরিষা", category: "oilseed", unit: "qtl", season: "rabi",
    msp: 5650, bandLow: 5200, bandHigh: 6800, icon: "Sprout", emoji: "🌻",
    note: "Demand steady; edible oil imports affect ceiling. Grade for oil content." },
  { id: "groundnut",   name: "Groundnut",      hindi: "मूँगफली", bengali: "চিনাবাদাম", category: "oilseed", unit: "qtl", season: "kharif",
    msp: 6783, bandLow: 6000, bandHigh: 8500, icon: "Sprout", emoji: "🥜", note: "Bold variety commands premium." },
  { id: "soyabean",    name: "Soyabean",       hindi: "सोयाबीन", bengali: "সয়াবিন", category: "oilseed", unit: "qtl", season: "kharif",
    msp: 4892, bandLow: 4500, bandHigh: 5800, icon: "Sprout", emoji: "🫘", note: "" },
  { id: "sunflower",   name: "Sunflower",      hindi: "सूरजमुखी", bengali: "সূর্যমুখী", category: "oilseed", unit: "qtl", season: "rabi",
    msp: 6760, bandLow: 6200, bandHigh: 7800, icon: "Sprout", emoji: "🌻", note: "" },
  { id: "sesame",      name: "Sesame (Til)",   hindi: "तिल", bengali: "তিল", category: "oilseed", unit: "qtl", season: "kharif",
    msp: 8635, bandLow: 7500, bandHigh: 11000, icon: "Sprout", emoji: "🌰", note: "Export demand; black sesame fetches higher price." },
  { id: "linseed",     name: "Linseed",        hindi: "अलसी", bengali: "তিসি", category: "oilseed", unit: "qtl", season: "rabi",
    msp: 5783, bandLow: 5200, bandHigh: 6500, icon: "Sprout", emoji: "🌿", note: "" },

  /* ── Vegetables (no MSP; bands only) ── */
  { id: "potato",      name: "Potato",         hindi: "आलू", bengali: "আলু", category: "vegetable", unit: "qtl", season: "rabi",
    msp: null, bandLow: 600, bandHigh: 2200, icon: "Package", emoji: "🥔",
    note: "Cold storage can extend selling window by 3–4 months. Check storage charges vs expected price gain." },
  { id: "onion",       name: "Onion",          hindi: "प्याज", bengali: "পেঁয়াজ", category: "vegetable", unit: "qtl", season: "rabi",
    msp: null, bandLow: 500, bandHigh: 5000, icon: "Package", emoji: "🧅",
    note: "Very high price volatility. Kharif onion (Oct) often crashes; rabi (Apr–May) steadier." },
  { id: "tomato",      name: "Tomato",         hindi: "टमाटर", bengali: "টমেটো", category: "vegetable", unit: "qtl", season: "year-round",
    msp: null, bandLow: 200, bandHigh: 4000, icon: "Package", emoji: "🍅",
    note: "Extremely volatile. Peak prices Jun–Aug during monsoon short supply." },
  { id: "brinjal",     name: "Brinjal",        hindi: "बैंगन", bengali: "বেগুন", category: "vegetable", unit: "qtl", season: "year-round",
    msp: null, bandLow: 300, bandHigh: 1800, icon: "Package", emoji: "🍆", note: "" },
  { id: "cauliflower", name: "Cauliflower",    hindi: "फूलगोभी", bengali: "ফুলকপি", category: "vegetable", unit: "qtl", season: "rabi",
    msp: null, bandLow: 200, bandHigh: 1500, icon: "Package", emoji: "🥦", note: "" },
  { id: "cabbage",     name: "Cabbage",        hindi: "पत्तागोभी", bengali: "বাঁধাকপি", category: "vegetable", unit: "qtl", season: "rabi",
    msp: null, bandLow: 150, bandHigh: 1200, icon: "Package", emoji: "🥬", note: "" },

  /* ── Fruits ── */
  { id: "banana",      name: "Banana",         hindi: "केला", bengali: "কলা", category: "fruit", unit: "qtl", season: "year-round",
    msp: null, bandLow: 500, bandHigh: 2500, icon: "Apple", emoji: "🍌", note: "Grade A bunches command 30–50% premium." },
  { id: "mango",       name: "Mango",          hindi: "आम", bengali: "আম", category: "fruit", unit: "qtl", season: "kharif",
    msp: null, bandLow: 1000, bandHigh: 6000, icon: "Apple", emoji: "🥭", note: "Alphonso/Langra varieties fetch 3–5× commodity mango price." },
  { id: "papaya",      name: "Papaya",         hindi: "पपीता", bengali: "পেঁপে", category: "fruit", unit: "qtl", season: "year-round",
    msp: null, bandLow: 300, bandHigh: 1800, icon: "Apple", emoji: "🍈", note: "" },

  /* ── Cash crops ── */
  { id: "cotton",      name: "Cotton (Medium)",hindi: "कपास", bengali: "তুলো", category: "cash", unit: "qtl", season: "kharif",
    msp: 6620, bandLow: 6200, bandHigh: 8000, icon: "Leaf", emoji: "🏵️",
    note: "MSP for Medium Staple. Long Staple MSP ₹7,020. Moisture & contamination critical." },
  { id: "jute",        name: "Jute",           hindi: "जूट", bengali: "পাট", category: "cash", unit: "qtl", season: "kharif",
    msp: 5050, bandLow: 4800, bandHigh: 6000, icon: "Leaf", emoji: "🧶",
    note: "MSP for Whole. Quality (TD-3/TD-4) matters. Govt JCI procurement open in WB/Bihar." },
  { id: "sugarcane",   name: "Sugarcane (FRP)",hindi: "गन्ना", bengali: "আখ", category: "cash", unit: "tonne", season: "year-round",
    msp: 340, bandLow: 310, bandHigh: 380, icon: "Leaf", emoji: "🎋",
    note: "FRP = Fair & Remunerative Price per tonne. State govt may set higher SAP." },
  { id: "tobacco",     name: "Tobacco (FCV)",  hindi: "तम्बाकू", bengali: "তামাক", category: "cash", unit: "kg", season: "rabi",
    msp: null, bandLow: 175, bandHigh: 300, icon: "Leaf", emoji: "🍂",
    note: "Auction at Tobacco Board. Price depends heavily on grade. No MSP." },

  /* ── Spices ── */
  { id: "turmeric",    name: "Turmeric",       hindi: "हल्दी", bengali: "হলুদ", category: "spice", unit: "qtl", season: "kharif",
    msp: null, bandLow: 6000, bandHigh: 20000, icon: "FlaskConical", emoji: "🟡",
    note: "Dry fingers command premium. Polished vs unpolished — check buyer preference." },
  { id: "chilli",      name: "Chilli (Dry)",   hindi: "मिर्च", bengali: "মরিচ", category: "spice", unit: "qtl", season: "rabi",
    msp: null, bandLow: 8000, bandHigh: 25000, icon: "FlaskConical", emoji: "🌶️",
    note: "Colour (ASTA) and pungency (SHU) determine price. Guntur benchmark." },
  { id: "ginger",      name: "Ginger",         hindi: "अदरक", bengali: "আদা", category: "spice", unit: "qtl", season: "kharif",
    msp: null, bandLow: 2000, bandHigh: 12000, icon: "FlaskConical", emoji: "🫚",
    note: "Very high price volatility year to year. Drying for dry ginger adds margin." },

  /* ── Livestock products ── */
  { id: "milk",        name: "Cow Milk",        hindi: "गाय का दूध", bengali: "গরুর দুধ", category: "livestock", unit: "litre", season: "year-round",
    msp: null, bandLow: 35, bandHigh: 55, icon: "Milk", emoji: "🥛",
    note: "Price per litre varies by fat % and local cooperative. Winter flush (Oct–Feb) slightly lower." },
  { id: "egg",         name: "Egg (Broiler)",   hindi: "अंडा", bengali: "ডিম", category: "livestock", unit: "hundred", season: "year-round",
    msp: null, bandLow: 380, bandHigh: 700, icon: "Bird", emoji: "🥚",
    note: "NECC daily rate is benchmark. Summer demand dips; festival season peaks." },
  { id: "broiler",     name: "Broiler Chicken", hindi: "मुर्गी", bengali: "ব্রয়লার মুরগি", category: "livestock", unit: "kg", season: "year-round",
    msp: null, bandLow: 90, bandHigh: 160, icon: "Bird", emoji: "🐔",
    note: "Live weight price. Dressing adds ₹20–30/kg for cut birds." },
  { id: "fish-rohu",   name: "Rohu Fish",       hindi: "रोहू", bengali: "রুই মাছ", category: "livestock", unit: "kg", season: "year-round",
    msp: null, bandLow: 120, bandHigh: 220, icon: "Fish", emoji: "🐟",
    note: "Size matters: 1 kg+ fish commands 20–30% premium. Festival weeks peak." },
  { id: "goat",        name: "Goat (Live)",     hindi: "बकरी", bengali: "ছাগল", category: "livestock", unit: "kg", season: "year-round",
    msp: null, bandLow: 400, bandHigh: 700, icon: "Rabbit", emoji: "🐐",
    note: "Live weight. Eid/Bakrid demand spikes significantly. Grade by body condition." },
];

export function getCrop(id) { return CROPS.find((c) => c.id === id) || null; }
export function getCropsByCategory(catId) { return CROPS.filter((c) => c.category === catId); }
export function searchCrops(query) {
  const q = (query || "").toLowerCase().trim();
  if (!q) return CROPS;
  return CROPS.filter((c) =>
    c.name.toLowerCase().includes(q) ||
    (c.hindi || "").includes(q) ||
    (c.bengali || "").includes(q) ||
    c.category.includes(q),
  );
}

/* A crop's name in the farmer's language, falling back to English.

   Each crop already carries hindi/bengali; two pages had their own copy of
   this three-liner and the crop planner's dropdown had none at all, so a
   Bengali farmer picked their crop from an English list. */
export const localCropName = (crop, lang) =>
  (lang === "bn" ? crop?.bengali : lang === "hi" ? crop?.hindi : null) || crop?.name || "";
