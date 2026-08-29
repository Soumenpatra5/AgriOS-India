/* Pig farming domain — covers all major Indian pig production systems. */

export const pigDomain = {
  id:     "pig",
  name:   "Pig Farming",
  icon:   "PiggyBank",
  emoji:  "🐖",
  accent: "red",
  description: "Diagnose diseases and health problems in pigs",
  /* Display copy. name/description stay English because orchestrator.js
     puts them in the model prompt; these are what the UI shows. */
  label: { en: "Pig Farming", hi: "सूअर पालन", bn: "শূকর পালন" },
  desc:  { en: "Diagnose diseases and health problems in pigs", hi: "सूअरों में रोग और स्वास्थ्य समस्याएँ पहचानें", bn: "শূকরের রোগ ও স্বাস্থ্য সমস্যা শনাক্ত করুন" },

  species: ["Desi (Indigenous)", "Large White Yorkshire", "Landrace", "Hampshire", "Duroc", "Crossbred"],

  symptoms: [
    { id: "skin",         label: "Skin Condition",       type: "select",
      options: ["Normal", "Red blotches", "Blue/Purple discoloration", "Vesicles/Blisters", "Crusty lesions", "Hair loss", "Swelling"] },
    { id: "behaviour",    label: "Behaviour",            type: "select",
      options: ["Normal", "Dull/Lethargic", "Unable to stand", "Trembling", "Convulsions", "Rubbing/Scratching"] },
    { id: "respiration",  label: "Breathing",            type: "select",
      options: ["Normal", "Rapid/Laboured", "Coughing", "Sneezing", "Nasal discharge"] },
    { id: "appetite",     label: "Eating/Drinking",      type: "select",
      options: ["Normal", "Reduced", "Not eating at all", "Vomiting"] },
    { id: "dung",         label: "Droppings",            type: "select",
      options: ["Normal", "Loose/Diarrhoea", "Bloody diarrhoea", "Constipation"] },
    { id: "growth",       label: "Growth",               type: "select",
      options: ["Normal for age", "Slow growth", "Much smaller than littermates", "Wasting"] },
    { id: "fever",        label: "Fever?",               type: "toggle" },
    { id: "mortality",    label: "Deaths in Herd?",      type: "toggle" },
    { id: "notes",        label: "Additional Details",   type: "text" },
  ],

  systemFragment: `You are an expert Swine Veterinarian with deep knowledge of pig diseases affecting Indian farming conditions — both commercial and backyard/smallholder operations.

Diagnose conditions including:
- African Swine Fever (ASF) — notifiable, no treatment, devastating
- Classical Swine Fever (CSF/Hog Cholera) — notifiable, widespread in India
- Foot and Mouth Disease (FMD)
- Porcine Reproductive and Respiratory Syndrome (PRRS)
- Swine Influenza
- Porcine Parvovirus, Pseudorabies
- Erysipelas (diamond skin disease)
- Leptospirosis — zoonotic risk
- External parasites: Mange (Sarcoptes scabiei var. suis)
- Internal parasites: Ascaris, Trichinella
- Nutritional deficiencies
- Heat stress in Indian summer

Reference ICAR-NRC Pig (Guwahati), state animal husbandry department guidelines.
CRITICAL: ASF and CSF are notifiable — if suspected, advise immediate reporting to veterinary authorities. Never recommend home treatment for notifiable diseases.`,

  buildContext(answers, species) {
    const parts = [];
    if (species)              parts.push(`Breed: ${species}`);
    if (answers.skin)         parts.push(`Skin: ${answers.skin}`);
    if (answers.behaviour)    parts.push(`Behaviour: ${answers.behaviour}`);
    if (answers.respiration)  parts.push(`Breathing: ${answers.respiration}`);
    if (answers.appetite)     parts.push(`Eating: ${answers.appetite}`);
    if (answers.dung)         parts.push(`Droppings: ${answers.dung}`);
    if (answers.growth)       parts.push(`Growth: ${answers.growth}`);
    if (answers.fever)        parts.push("Fever suspected");
    if (answers.mortality)    parts.push("Deaths in herd");
    if (answers.notes)        parts.push(`Farmer notes: ${answers.notes}`);
    return parts.join(". ");
  },
};
