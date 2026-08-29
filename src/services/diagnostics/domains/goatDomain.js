/* Goat farming domain — covers all major Indian goat breeds and diseases. */

export const goatDomain = {
  id:     "goat",
  name:   "Goat Farming",
  icon:   "Rabbit",
  emoji:  "🐐",
  accent: "orange",
  description: "Diagnose diseases and health problems in goats and sheep",
  /* Display copy. name/description stay English because orchestrator.js
     puts them in the model prompt; these are what the UI shows. */
  label: { en: "Goat Farming", hi: "बकरी पालन", bn: "ছাগল পালন" },
  desc:  { en: "Diagnose diseases and health problems in goats and sheep", hi: "बकरी और भेड़ में रोग और स्वास्थ्य समस्याएँ पहचानें", bn: "ছাগল ও ভেড়ার রোগ ও স্বাস্থ্য সমস্যা শনাক্ত করুন" },

  species: ["Black Bengal", "Sirohi", "Barbari", "Osmanabadi", "Jamunapari", "Beetal", "Malabari", "Sheep (Desi)", "Other"],

  symptoms: [
    { id: "body_condition", label: "Body Condition",       type: "select",
      options: ["Good / Normal", "Thin", "Pot belly", "Very thin (emaciated)"] },
    { id: "skin",           label: "Skin / Coat",         type: "select",
      options: ["Normal", "Hair loss (patches)", "Scabs/Crusts", "Wounds/Sores", "Swellings", "Mange/Itching"] },
    { id: "eyes",           label: "Eyes",                type: "select",
      options: ["Normal", "Watery/Discharge", "Cloudy", "Pink/Red conjunctiva", "Swollen eyelid"] },
    { id: "behaviour",      label: "Behaviour",           type: "select",
      options: ["Normal", "Dull/Lethargic", "Teeth grinding", "Head pressing", "Circling", "Unable to stand"] },
    { id: "dung",           label: "Dung",                type: "select",
      options: ["Normal pellets", "Soft/Loose", "Watery diarrhoea", "Bloody", "Very dry/No dung"] },
    { id: "respiration",    label: "Breathing",           type: "select",
      options: ["Normal", "Rapid", "Coughing", "Nasal discharge"] },
    { id: "bloat",          label: "Bloating (Rumen)?",   type: "toggle" },
    { id: "limping",        label: "Limping / Hoof Issue?", type: "toggle" },
    { id: "notes",          label: "Additional Details",  type: "text" },
  ],

  systemFragment: `You are an expert Goat and Sheep Veterinarian with extensive knowledge of Indian small ruminant diseases and management.

Diagnose conditions including:
- Peste des Petits Ruminants (PPR) — highly contagious, notifiable
- Enterotoxemia (Pulpy Kidney), Tetanus
- Contagious Caprine Pleuropneumonia (CCPP)
- Foot and Mouth Disease (FMD)
- Caseous lymphadenitis (CLA)
- External parasites: Mange (Sarcoptes, Psoroptes), Lice, Ticks
- Internal parasites: Haemonchus (Barber Pole worm), GI worms, Liver fluke
- Goat Pox (notifiable)
- Nutritional deficiencies: Cobalt, Copper, Selenium, Vitamin B12
- Urinary calculi (male goats)
- Foot rot (Dichelobacter nodosus)
- Pregnancy toxemia and milk fever

Reference ICAR-CIRG Makhdoom, and state animal husbandry guidelines.
Mention zoonotic risks where relevant (Brucellosis, Q fever).`,

  buildContext(answers, species) {
    const parts = [];
    if (species)                parts.push(`Animal: ${species}`);
    if (answers.body_condition) parts.push(`Body condition: ${answers.body_condition}`);
    if (answers.skin)           parts.push(`Skin/coat: ${answers.skin}`);
    if (answers.eyes)           parts.push(`Eyes: ${answers.eyes}`);
    if (answers.behaviour)      parts.push(`Behaviour: ${answers.behaviour}`);
    if (answers.dung)           parts.push(`Dung: ${answers.dung}`);
    if (answers.respiration)    parts.push(`Breathing: ${answers.respiration}`);
    if (answers.bloat)          parts.push("Rumen bloat observed");
    if (answers.limping)        parts.push("Limping/hoof problem");
    if (answers.notes)          parts.push(`Farmer notes: ${answers.notes}`);
    return parts.join(". ");
  },
};
