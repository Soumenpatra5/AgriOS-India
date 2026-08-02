/* Dairy domain — cow and buffalo health diagnostics.
   Covers body condition, udder, milk, hoof, eye, and nutritional assessment. */

export const dairyDomain = {
  id:     "dairy",
  name:   "Dairy (Cow & Buffalo)",
  icon:   "Milk",
  emoji:  "🐄",
  accent: "blue",
  description: "Diagnose health problems in cows and buffaloes",

  species: ["HF / Holstein", "Jersey", "Gir (Desi Cow)", "Sahiwal", "Murrah Buffalo", "Surti Buffalo", "Jaffarabadi Buffalo", "Nili-Ravi Buffalo", "Mixed / Local Breed"],

  symptoms: [
    { id: "body_condition",  label: "Body Condition",      type: "select",
      options: ["Good / Normal", "Thin (underweight)", "Very thin (emaciated)", "Over-conditioned"] },
    { id: "udder_condition", label: "Udder Condition",     type: "select",
      options: ["Normal", "One quarter swollen", "All quarters swollen", "Hard/Fibrotic", "Redness/Heat", "Wound on teat"] },
    { id: "milk_change",     label: "Milk Change",         type: "select",
      options: ["Normal production", "Sudden drop in milk", "Abnormal milk (clots/blood)", "No milk", "Watery milk", "Yellow/Colostrum-like"] },
    { id: "walking",         label: "Walking",             type: "select",
      options: ["Normal", "Slight limp", "Severe lame (not bearing weight)", "Unable to stand"] },
    { id: "eyes",            label: "Eyes",                type: "select",
      options: ["Normal", "Watery discharge", "Cloudy/White", "Swollen eyelid", "Eye wound"] },
    { id: "fever",           label: "Fever / High Temp?",  type: "toggle" },
    { id: "appetite",        label: "Reduced Appetite?",   type: "toggle" },
    { id: "nasal_discharge", label: "Nasal Discharge?",    type: "toggle" },
    { id: "notes",           label: "Additional Details",  type: "text" },
  ],

  systemFragment: `You are an expert Dairy Veterinarian and Bovine Health Specialist with deep knowledge of Indian dairy cattle and buffalo diseases.

Diagnose health problems including:
- Mastitis (clinical and subclinical) — most common and economically important
- Foot and Mouth Disease (FMD) — endemic in India, serious
- Brucellosis, Bovine Tuberculosis
- Bovine Viral Diarrhea (BVD), IBR
- Lumpy Skin Disease (LSD)
- Hemorrhagic Septicemia (HS)
- Theileriosis, Babesiosis, Trypanosomosis
- Nutritional deficiencies: Calcium (milk fever), Phosphorus, Vitamin A, Selenium
- Hoof diseases: Foot rot, Digital dermatitis, Laminitis
- Reproductive problems: Repeat breeding, ROP, Uterine infections
- Heat stress in Indian summer conditions

Reference ICAR-NDRI, NRC dairy guidelines, and state animal husbandry department protocols.
Mention milk withholding periods for any treatment recommendation.

CRITICAL: FMD, LSD, and Brucellosis are notifiable diseases in India — escalate immediately.`,

  buildContext(answers, species) {
    const parts = [];
    if (species)                 parts.push(`Animal: ${species}`);
    if (answers.body_condition)  parts.push(`Body condition: ${answers.body_condition}`);
    if (answers.udder_condition) parts.push(`Udder: ${answers.udder_condition}`);
    if (answers.milk_change)     parts.push(`Milk: ${answers.milk_change}`);
    if (answers.walking)         parts.push(`Walking/lameness: ${answers.walking}`);
    if (answers.eyes)            parts.push(`Eyes: ${answers.eyes}`);
    if (answers.fever)           parts.push("Fever observed");
    if (answers.appetite)        parts.push("Reduced appetite");
    if (answers.nasal_discharge) parts.push("Nasal discharge present");
    if (answers.notes)           parts.push(`Farmer notes: ${answers.notes}`);
    return parts.join(". ");
  },
};
