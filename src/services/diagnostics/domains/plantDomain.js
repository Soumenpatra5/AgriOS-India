/* Plant & Crop domain — covers all Indian field crops, horticulture, and vegetables.
   No disease logic is hardcoded; all knowledge lives in the AI systemFragment. */

export const plantDomain = {
  id:     "plant",
  name:   "Plant & Crop",
  icon:   "Leaf",
  emoji:  "🌱",
  accent: "primary",
  description: "Diagnose diseases, pests, nutrient deficiencies, and stress in crops",
  /* Display copy. name/description stay English because orchestrator.js
     puts them in the model prompt; these are what the UI shows. */
  label: { en: "Plant & Crop", hi: "फ़सल और पौधे", bn: "ফসল ও গাছ" },
  desc:  { en: "Diagnose diseases, pests, nutrient deficiencies, and stress in crops", hi: "फ़सलों में रोग, कीट, पोषक तत्वों की कमी और तनाव पहचानें", bn: "ফসলের রোগ, পোকা, পুষ্টির ঘাটতি ও চাপ শনাক্ত করুন" },

  species: [
    "Paddy (Rice)", "Wheat", "Maize (Corn)", "Cotton", "Mustard", "Soybean",
    "Potato", "Tomato", "Onion", "Chilli", "Brinjal", "Banana", "Mango",
    "Sugarcane", "Groundnut", "Sunflower", "Turmeric", "Ginger", "Cabbage",
    "Cauliflower", "Okra (Bhindi)", "Peas", "Lentil (Masoor)", "Chickpea (Chana)",
    "Other",
  ],

  symptoms: [
    { id: "affected_part",  label: "Affected Part",        type: "select",
      options: ["Leaf", "Stem", "Root / Bulb", "Fruit / Pod", "Flower", "Seedling", "Whole Plant"] },
    { id: "symptom_type",   label: "Main Symptom",         type: "select",
      options: ["Yellow/Pale spots", "Brown/Dark spots", "Black lesions", "White powder", "Rust (orange)", "Wilting", "Rotting", "Holes / Tunnels", "Curling / Distortion", "Stunted growth", "No visible symptom"] },
    { id: "spread",         label: "Extent of Spread",     type: "select",
      options: ["Single plant", "Few plants", "One section of field", "Most of the field", "Entire field"] },
    { id: "onset",          label: "When Did It Start?",   type: "select",
      options: ["Today", "2–3 days ago", "About 1 week ago", "2+ weeks ago"] },
    { id: "recent_spray",   label: "Recent Spray Applied?",  type: "toggle" },
    { id: "waterlogged",    label: "Waterlogging / Flooding?", type: "toggle" },
    { id: "insect_visible", label: "Insects Visible on Plant?", type: "toggle" },
    { id: "notes",          label: "Additional Details",   type: "text" },
  ],

  systemFragment: `You are an expert Plant Pathologist, Agricultural Scientist, and Pest Management Specialist with 30 years of experience in Indian farming conditions.

Your role is to analyze farm images and provided symptoms to diagnose plant health problems.

Cover the full spectrum of plant health issues:
- Fungal diseases (leaf spots, blights, rusts, powdery mildew, downy mildew, root rots)
- Bacterial diseases (blights, wilts, cankers, soft rots)
- Viral diseases (mosaics, yellowing, ring spots, streak)
- Pest attacks (insects, mites, nematodes)
- Nutrient deficiencies (N, P, K, Fe, Zn, Mg, S, B, Mo)
- Abiotic stress (water, heat, cold, salinity, herbicide injury)
- Weed competition
- Growth stage identification

India-specific context: consider regional pests, monsoon conditions, Indian crop varieties (desi and hybrid), and locally available treatments. Reference ICAR, State Agriculture Universities, and Ministry of Agriculture guidelines.

CRITICAL: If the image quality is poor or insufficient for diagnosis, say so explicitly. Never fabricate a disease name.`,

  buildContext(answers, species) {
    const parts = [];
    if (species)               parts.push(`Crop species: ${species}`);
    if (answers.affected_part) parts.push(`Affected part: ${answers.affected_part}`);
    if (answers.symptom_type)  parts.push(`Main symptom: ${answers.symptom_type}`);
    if (answers.spread)        parts.push(`Spread extent: ${answers.spread}`);
    if (answers.onset)         parts.push(`Onset: ${answers.onset}`);
    if (answers.recent_spray)  parts.push("Recent spray/fertilizer applied");
    if (answers.waterlogged)   parts.push("Field has waterlogging/flooding");
    if (answers.insect_visible) parts.push("Insects visible on plant");
    if (answers.notes)         parts.push(`Farmer notes: ${answers.notes}`);
    return parts.join(". ");
  },
};
