import HerdManager from "./HerdManager.jsx";

/* See GoatManager for why every display string is a {en,hi,bn} object and
   breed `value` stays English. */
const CONFIG = {
  enterprise: "pig",
  icon: "PiggyBank",
  accent: "red",
  title:       { en: "Pig",   hi: "सूअर",      bn: "শূকর"    },
  noun:        { en: "Pig",   hi: "सूअर",      bn: "শূকর"    },
  nounPlural:  { en: "Pigs",  hi: "सूअर",      bn: "শূকর"    },
  female:      { en: "Sow",   hi: "सूअरी",     bn: "শূকরী"   },
  male:        { en: "Boar",  hi: "सूअर",      bn: "শূকর"    },
  femalePlural:{ en: "Sows",  hi: "सूअरियाँ",  bn: "শূকরী"   },
  malePlural:  { en: "Boars", hi: "सूअर",      bn: "শূকর"    },
  breeds: [
    { value: "Large White Yorkshire", label: { en: "Large White Yorkshire", hi: "लार्ज व्हाइट यॉर्कशायर", bn: "লার্জ হোয়াইট ইয়র্কশায়ার" } },
    { value: "Landrace",   label: { en: "Landrace",   hi: "लैंडरेस",     bn: "ল্যান্ডরেস"   } },
    { value: "Duroc",      label: { en: "Duroc",      hi: "ड्यूरॉक",     bn: "ডুরক"         } },
    { value: "Hampshire",  label: { en: "Hampshire",  hi: "हैम्पशायर",   bn: "হ্যাম্পশায়ার" } },
    { value: "Ghungroo",   label: { en: "Ghungroo",   hi: "घुंघरू",      bn: "ঘুংরু"        } },
    { value: "Desi/Local", label: { en: "Desi/Local", hi: "देसी",        bn: "দেশি"         } },
    { value: "Crossbred",  label: { en: "Crossbred",  hi: "संकर",        bn: "সংকর"         } },
    { value: "Other",      label: { en: "Other",      hi: "अन्य",        bn: "অন্যান্য"     } },
  ],
  eventTypes: [
    { value: "vaccination", label: { en: "Vaccination",        hi: "टीकाकरण",    bn: "টিকাকরণ"       } },
    { value: "deworming",   label: { en: "Deworming",          hi: "कृमिनाशक",   bn: "কৃমিনাশক"      } },
    { value: "farrowing",   label: { en: "Farrowing (birth)",  hi: "बच्चा जन्म", bn: "শাবক প্রসব"    } },
    { value: "mating",      label: { en: "Mating",             hi: "संभोग",      bn: "প্রজনন"        } },
    { value: "treatment",   label: { en: "Treatment",          hi: "उपचार",      bn: "চিকিৎসা"       } },
    { value: "sale",        label: { en: "Sale",               hi: "बिक्री",      bn: "বিক্রয়"        } },
    { value: "purchase",    label: { en: "Purchase",           hi: "खरीद",       bn: "ক্রয়"          } },
    { value: "other",       label: { en: "Other",              hi: "अन्य",       bn: "অন্যান্য"      } },
  ],
};

export default function PigManager() {
  return <HerdManager config={CONFIG} />;
}
