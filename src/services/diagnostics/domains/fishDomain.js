/* Fish farming domain — freshwater aquaculture, brackish water, and marine.
   Includes water quality context which is critical for fish disease diagnosis. */

export const fishDomain = {
  id:     "fish",
  name:   "Fish Farming",
  icon:   "Fish",
  emoji:  "🐟",
  accent: "blue",
  description: "Diagnose diseases and health problems in fish and aquaculture",
  /* Display copy. name/description stay English because orchestrator.js
     puts them in the model prompt; these are what the UI shows. */
  label: { en: "Fish Farming", hi: "मछली पालन", bn: "মাছ চাষ" },
  desc:  { en: "Diagnose diseases and health problems in fish and aquaculture", hi: "मछली और जलकृषि में रोग और स्वास्थ्य समस्याएँ पहचानें", bn: "মাছ ও মৎস্যচাষে রোগ ও স্বাস্থ্য সমস্যা শনাক্ত করুন" },

  species: ["Rohu", "Catla", "Mrigal", "Common Carp", "Grass Carp", "Silver Carp", "Pangasius", "Tilapia", "Catfish (Magur/Singhi)", "Prawn (Vannamei)", "Prawn (Tiger)", "Hilsa", "Murrel", "Pearl Spot", "Other"],

  symptoms: [
    { id: "body_lesions",  label: "Body Surface",         type: "select",
      options: ["Normal", "Ulcers/Sores", "Red patches", "Haemorrhage", "Swollen/Dropsy", "White spots", "Grey-white patches", "Fin erosion"] },
    { id: "behaviour",     label: "Swimming Behaviour",   type: "select",
      options: ["Normal", "Erratic swimming", "Swimming at surface (gasping)", "Spiral swimming", "Lying on bottom", "Not moving"] },
    { id: "gills",         label: "Gills",                type: "select",
      options: ["Normal (red)", "Pale", "Dark brown/Black", "Swollen/Clubbed", "Excessive mucus", "Visible parasites"] },
    { id: "eyes",          label: "Eyes",                 type: "select",
      options: ["Normal", "Popped out (Exophthalmia)", "Cloudy", "One eye missing"] },
    { id: "scales",        label: "Scales",               type: "select",
      options: ["Normal", "Raised / Standing out", "Missing patches", "Discoloured"] },
    { id: "water_colour",  label: "Water Colour/Condition", type: "select",
      options: ["Clear / Normal green", "Turbid/Brown", "Foul smell", "Algal bloom (green/blue-green)", "Red tide"] },
    { id: "mortality",     label: "Fish Deaths?",         type: "toggle" },
    { id: "appetite",      label: "Not Feeding?",         type: "toggle" },
    { id: "notes",         label: "Additional Details",   type: "text" },
  ],

  systemFragment: `You are an expert Fisheries Scientist, Aquatic Veterinarian, and Aquaculture Disease Specialist with extensive knowledge of Indian freshwater and brackish water fish farming.

Diagnose conditions including:
- Bacterial diseases: Epizootic Ulcerative Syndrome (EUS/Red Spot), Aeromonas infection, Columnaris (Saddleback disease), Bacterial Gill Disease
- Viral diseases: Koi Herpesvirus (KHV), Spring Viremia of Carp (SVC), Infectious Spleen and Kidney Necrosis (ISKN)
- Parasitic diseases: Argulus (Fish Louse), Lernaea (Anchor worm), Ichthyophthirius (White Spot/Ich), Monogenean flukes, Myxobolan
- Fungal diseases: Saprolegnia (Cotton mold)
- Environmental/Water quality problems: Dissolved oxygen depletion, Ammonia toxicity, Nitrite toxicity, pH extremes, Blue-green algae toxicity
- Nutritional diseases: Lipoid liver disease, Vitamin C deficiency, Broken Back disease
- Ectoparasite infestations

Reference ICAR-CIFRI, MPEDA, NFDB, and state fisheries department guidelines.
IMPORTANT: Always include water quality context in recommendations. Many fish diseases are secondary to poor water quality.`,

  buildContext(answers, species) {
    const parts = [];
    if (species)               parts.push(`Fish species: ${species}`);
    if (answers.body_lesions)  parts.push(`Body surface: ${answers.body_lesions}`);
    if (answers.behaviour)     parts.push(`Swimming: ${answers.behaviour}`);
    if (answers.gills)         parts.push(`Gills: ${answers.gills}`);
    if (answers.eyes)          parts.push(`Eyes: ${answers.eyes}`);
    if (answers.scales)        parts.push(`Scales: ${answers.scales}`);
    if (answers.water_colour)  parts.push(`Water condition: ${answers.water_colour}`);
    if (answers.mortality)     parts.push("Fish deaths occurring");
    if (answers.appetite)      parts.push("Fish not feeding");
    if (answers.notes)         parts.push(`Farmer notes: ${answers.notes}`);
    return parts.join(". ");
  },
};
