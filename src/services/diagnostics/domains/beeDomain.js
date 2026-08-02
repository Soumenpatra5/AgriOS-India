/* Bee keeping domain — colony health, queen status, brood, parasites, and honey production. */

export const beeDomain = {
  id:     "bee",
  name:   "Bee Keeping",
  icon:   "Bug",
  emoji:  "🐝",
  accent: "yellow",
  description: "Assess hive health, diagnose bee diseases, and monitor colony strength",

  species: ["Apis mellifera (European Honey Bee)", "Apis cerana (Indian Honey Bee)", "Apis dorsata (Rock Bee)", "Apis florea (Dwarf Bee)", "Stingless Bee (Meliponini)"],

  symptoms: [
    { id: "colony_strength", label: "Colony Strength",      type: "select",
      options: ["Strong (frames covered)", "Moderate", "Weak (few bees)", "Very weak / Collapsing"] },
    { id: "brood_pattern",   label: "Brood Pattern",        type: "select",
      options: ["Normal (compact)", "Spotty pattern", "Sunken/Perforated caps", "Rope-like when opened", "White larvae dead", "Black larvae dead", "No brood"] },
    { id: "queen_status",    label: "Queen Signs",          type: "select",
      options: ["Queen seen", "Queen cells present", "Laying worker signs", "No eggs/larvae", "Supersedure cells"] },
    { id: "bee_behaviour",   label: "Bee Behaviour",        type: "select",
      options: ["Normal foraging", "Bees crawling outside", "Trembling bees", "Aggressive", "Robbing behaviour", "Absconding signs"] },
    { id: "mites_visible",   label: "Mites Visible on Bees?", type: "toggle" },
    { id: "wax_moth",        label: "Wax Moth Signs?",      type: "toggle" },
    { id: "bee_deaths",      label: "Dead Bees at Entrance?", type: "toggle" },
    { id: "notes",           label: "Additional Details",   type: "text" },
  ],

  systemFragment: `You are an expert Apiculturist, Bee Pathologist, and Beekeeping Specialist with deep knowledge of honey bee health management in Indian conditions.

Diagnose hive and colony health problems including:
- Varroa mite infestation (Varroa destructor) — most destructive bee pest globally
- American Foulbrood (AFB) — Paenibacillus larvae, notifiable, must be burned
- European Foulbrood (EFB) — Melissococcus plutonius
- Nosema disease — Nosema ceranae and Nosema apis, midgut fungus
- Sacbrood virus
- Chalkbrood — Ascosphaera apis, fungal
- Tropilaelaps mite — more common than Varroa in Asian bees
- Small Hive Beetle (Aethina tumida)
- Wax moth (Galleria mellonella and Achroia grisella)
- Colony Collapse Disorder (CCD) symptoms
- Queenlessness, laying workers, failing queens
- Pesticide poisoning (common cause of colony loss in India near agricultural fields)
- Nutritional stress, robbing, absconding

Reference ICAR-AICRP on Honeybees, Khadi and Village Industries Commission (KVIC) beekeeping guidelines, and NBHM protocols.
IMPORTANT: AFB requires legal reporting in many states. Never recommend re-queening or splitting a colony with suspected AFB.`,

  buildContext(answers, species) {
    const parts = [];
    if (species)                 parts.push(`Bee species: ${species}`);
    if (answers.colony_strength) parts.push(`Colony strength: ${answers.colony_strength}`);
    if (answers.brood_pattern)   parts.push(`Brood pattern: ${answers.brood_pattern}`);
    if (answers.queen_status)    parts.push(`Queen status: ${answers.queen_status}`);
    if (answers.bee_behaviour)   parts.push(`Behaviour: ${answers.bee_behaviour}`);
    if (answers.mites_visible)   parts.push("Mites visible on bees");
    if (answers.wax_moth)        parts.push("Wax moth signs present");
    if (answers.bee_deaths)      parts.push("Dead bees at entrance");
    if (answers.notes)           parts.push(`Beekeeper notes: ${answers.notes}`);
    return parts.join(". ");
  },
};
