/* Poultry domain — broiler, layer, country chicken, duck, turkey.
   Visual analysis of comb, eye, feather, skin, posture, and behavioral signs. */

export const poultryDomain = {
  id:     "poultry",
  name:   "Poultry",
  icon:   "Bird",
  emoji:  "🐔",
  accent: "orange",
  description: "Diagnose diseases and health problems in chickens, ducks, and turkeys",

  species: ["Broiler", "Layer (Egg bird)", "Country Chicken (Desi)", "Duck", "Turkey", "Guinea Fowl", "Quail"],

  symptoms: [
    { id: "comb_color",   label: "Comb Colour",          type: "select",
      options: ["Bright red (Normal)", "Pale/White", "Dark purple/Blue", "Yellow", "Scaly/Crusty"] },
    { id: "eye_condition", label: "Eye Condition",        type: "select",
      options: ["Normal", "Watery discharge", "Swollen", "Closed", "Cloudy"] },
    { id: "feathers",     label: "Feather Condition",    type: "select",
      options: ["Normal", "Ruffled/Puffed up", "Loss of feathers", "Dirty/Wet feathers", "Dull"] },
    { id: "behaviour",    label: "Behaviour",            type: "select",
      options: ["Normal", "Lethargic/Dull", "Limping/Not walking", "Circling", "Convulsions", "Head tilt"] },
    { id: "respiration",  label: "Breathing",            type: "select",
      options: ["Normal", "Rapid breathing", "Gasping", "Wheezing/Rattling", "Nasal discharge"] },
    { id: "droppings",    label: "Droppings",            type: "select",
      options: ["Normal", "Watery/Loose", "Bloody", "Green", "White (urates excess)", "Yellow"] },
    { id: "mortality",    label: "Recent Deaths?",       type: "toggle" },
    { id: "feed_intake",  label: "Reduced Feed/Water?",  type: "toggle" },
    { id: "notes",        label: "Additional Details",   type: "text" },
  ],

  systemFragment: `You are an expert Avian Veterinarian and Poultry Disease Specialist with extensive experience in Indian poultry farming — commercial broiler and layer operations, backyard/country chicken, and duck farming.

Analyze images and symptoms to diagnose poultry health problems including:
- Viral diseases: Newcastle Disease (Ranikhet), Marek's Disease, Infectious Bursal Disease (Gumboro), Avian Influenza, Fowl Pox
- Bacterial diseases: Colibacillosis, Salmonellosis, Mycoplasmosis, Fowl Cholera
- Parasitic diseases: Coccidiosis, External parasites (lice, mites), Internal parasites
- Nutritional deficiencies: Riboflavin, Vitamin D, Calcium deficiencies
- Management issues: Heat stress, Wet litter disease, Cage layer fatigue

Indian context: Consider ICAR-IVRI guidelines, National Animal Disease Reporting System, state veterinary protocols, and locally available vaccines and medicines.
Mention biosecurity measures, quarantine advice, and flock management recommendations.

CRITICAL: Poultry disease can spread rapidly. Flag emergency situations clearly. Never guess if image quality is insufficient.`,

  buildContext(answers, species) {
    const parts = [];
    if (species)              parts.push(`Bird type: ${species}`);
    if (answers.comb_color)   parts.push(`Comb colour: ${answers.comb_color}`);
    if (answers.eye_condition) parts.push(`Eyes: ${answers.eye_condition}`);
    if (answers.feathers)     parts.push(`Feathers: ${answers.feathers}`);
    if (answers.behaviour)    parts.push(`Behaviour: ${answers.behaviour}`);
    if (answers.respiration)  parts.push(`Breathing: ${answers.respiration}`);
    if (answers.droppings)    parts.push(`Droppings: ${answers.droppings}`);
    if (answers.mortality)    parts.push("Recent deaths in flock");
    if (answers.feed_intake)  parts.push("Reduced feed/water intake observed");
    if (answers.notes)        parts.push(`Farmer notes: ${answers.notes}`);
    return parts.join(". ");
  },
};
