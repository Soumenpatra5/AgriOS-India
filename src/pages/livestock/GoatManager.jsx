import HerdManager from "./HerdManager.jsx";

/* Goat management delegates to the shared HerdManager (Phase 6) — goat, pig
   and sheep share identical workflows, so one implementation.

   Every display string is a {en,hi,bn} object rather than a bare noun: the
   screen used to build labels like `${female}s` and `Add ${noun}`, and neither
   English plural-s nor English word order survives translation. Breed `value`
   stays English because it is what gets written to the animal record. */
const CONFIG = {
  enterprise: "goat",
  icon: "Rabbit",
  accent: "primary",
  title:       { en: "Goat",  hi: "बकरी",     bn: "ছাগল"     },
  noun:        { en: "Goat",  hi: "बकरी",     bn: "ছাগল"     },
  nounPlural:  { en: "Goats", hi: "बकरियाँ",  bn: "ছাগল"     },
  female:      { en: "Doe",   hi: "बकरी",     bn: "ছাগী"     },
  male:        { en: "Buck",  hi: "बकरा",     bn: "পাঁঠা"    },
  femalePlural:{ en: "Does",  hi: "बकरियाँ",  bn: "ছাগী"     },
  malePlural:  { en: "Bucks", hi: "बकरे",     bn: "পাঁঠা"    },
  breeds: [
    { value: "Black Bengal", label: { en: "Black Bengal", hi: "ब्लैक बंगाल",  bn: "ব্ল্যাক বেঙ্গল" } },
    { value: "Sirohi",       label: { en: "Sirohi",       hi: "सिरोही",       bn: "সিরোহি"        } },
    { value: "Barbari",      label: { en: "Barbari",      hi: "बरबरी",        bn: "বারবারি"       } },
    { value: "Beetal",       label: { en: "Beetal",       hi: "बीटल",         bn: "বিটল"          } },
    { value: "Jamunapari",   label: { en: "Jamunapari",   hi: "जमुनापारी",    bn: "যমুনাপারি"     } },
    { value: "Osmanabadi",   label: { en: "Osmanabadi",   hi: "उस्मानाबादी",  bn: "ওসমানাবাদি"    } },
    { value: "Mixed",        label: { en: "Mixed",        hi: "मिश्रित",      bn: "মিশ্র"         } },
    { value: "Other",        label: { en: "Other",        hi: "अन्य",         bn: "অন্যান্য"      } },
  ],
  eventTypes: [
    { value: "vaccination", label: { en: "Vaccination",     hi: "टीकाकरण",       bn: "টিকাকরণ"        } },
    { value: "deworming",   label: { en: "Deworming",       hi: "कृमिनाशक",      bn: "কৃমিনাশক"       } },
    { value: "kidding",     label: { en: "Kidding (birth)", hi: "बच्चा जन्म",    bn: "বাচ্চা প্রসব"   } },
    { value: "mating",      label: { en: "Mating",          hi: "संभोग",         bn: "প্রজনন"         } },
    { value: "treatment",   label: { en: "Treatment",       hi: "उपचार",         bn: "চিকিৎসা"        } },
    { value: "sale",        label: { en: "Sale",            hi: "बिक्री",         bn: "বিক্রয়"         } },
    { value: "purchase",    label: { en: "Purchase",        hi: "खरीद",          bn: "ক্রয়"           } },
    { value: "other",       label: { en: "Other",           hi: "अन्य",          bn: "অন্যান্য"       } },
  ],
};

export default function GoatManager() {
  return <HerdManager config={CONFIG} />;
}
