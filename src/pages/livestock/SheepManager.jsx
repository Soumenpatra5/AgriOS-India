import HerdManager from "./HerdManager.jsx";

/* See GoatManager for why every display string is a {en,hi,bn} object and
   breed `value` stays English. */
const CONFIG = {
  enterprise: "sheep",
  icon: "Beef",
  accent: "blue",
  title:       { en: "Sheep", hi: "भेड़",      bn: "ভেড়া"   },
  noun:        { en: "Sheep", hi: "भेड़",      bn: "ভেড়া"   },
  nounPlural:  { en: "Sheep", hi: "भेड़ें",    bn: "ভেড়া"   },
  female:      { en: "Ewe",   hi: "भेड़",      bn: "ভেড়ি"   },
  male:        { en: "Ram",   hi: "मेढ़ा",     bn: "মেষ"     },
  femalePlural:{ en: "Ewes",  hi: "भेड़ें",    bn: "ভেড়ি"   },
  malePlural:  { en: "Rams",  hi: "मेढ़े",     bn: "মেষ"     },
  breeds: [
    { value: "Deccani",      label: { en: "Deccani",      hi: "दक्कनी",      bn: "দাক্ষিণাত্য" } },
    { value: "Nellore",      label: { en: "Nellore",      hi: "नेल्लोर",     bn: "নেল্লোর"     } },
    { value: "Marwari",      label: { en: "Marwari",      hi: "मारवाड़ी",    bn: "মারওয়াড়ি"   } },
    { value: "Garole",       label: { en: "Garole",       hi: "गरोल",        bn: "গাড়োল"       } },
    { value: "Chokla",       label: { en: "Chokla",       hi: "चोकला",       bn: "চোকলা"       } },
    { value: "Merino Cross", label: { en: "Merino Cross", hi: "मेरिनो संकर", bn: "মেরিনো সংকর" } },
    { value: "Desi/Local",   label: { en: "Desi/Local",   hi: "देसी",        bn: "দেশি"        } },
    { value: "Other",        label: { en: "Other",        hi: "अन्य",        bn: "অন্যান্য"    } },
  ],
  eventTypes: [
    { value: "vaccination", label: { en: "Vaccination",       hi: "टीकाकरण",     bn: "টিকাকরণ"        } },
    { value: "deworming",   label: { en: "Deworming",         hi: "कृमिनाशक",    bn: "কৃমিনাশক"       } },
    { value: "lambing",     label: { en: "Lambing (birth)",   hi: "मेमना जन्म",  bn: "শাবক প্রসব"     } },
    { value: "shearing",    label: { en: "Shearing (wool)",   hi: "ऊन कटाई",     bn: "পশম ছাঁটাই"     } },
    { value: "mating",      label: { en: "Mating",            hi: "संभोग",       bn: "প্রজনন"         } },
    { value: "treatment",   label: { en: "Treatment",         hi: "उपचार",       bn: "চিকিৎসা"        } },
    { value: "sale",        label: { en: "Sale",              hi: "बिक्री",       bn: "বিক্রয়"         } },
    { value: "purchase",    label: { en: "Purchase",          hi: "खरीद",        bn: "ক্রয়"           } },
    { value: "other",       label: { en: "Other",             hi: "अन्य",        bn: "অন্যান্য"       } },
  ],
};

export default function SheepManager() {
  return <HerdManager config={CONFIG} />;
}
