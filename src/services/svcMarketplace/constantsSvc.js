/* label stays English — it is the stored value, the text in CSV exports and
   the key reports group on. i18n is what the UI shows. */
/* Service marketplace taxonomies. */

export const SERVICE_CATEGORIES = [
  { id: "vet",            label: "Veterinary",        icon: "Stethoscope",   accent: "red", i18n: { en: "Veterinary", hi: "पशु चिकित्सा", bn: "পশুচিকিৎসা" }     },
  { id: "agronomist",     label: "Agronomist",        icon: "Sprout",        accent: "primary", i18n: { en: "Agronomist", hi: "कृषि विशेषज्ञ", bn: "কৃষিবিদ" } },
  { id: "plantDoctor",    label: "Plant Doctor",      icon: "Leaf",          accent: "primary", i18n: { en: "Plant Doctor", hi: "पादप चिकित्सक", bn: "উদ্ভিদ ডাক্তার" } },
  { id: "drone",          label: "Drone Service",     icon: "Send",          accent: "blue", i18n: { en: "Drone Service", hi: "ड्रोन सेवा", bn: "ড্রোন সেবা" }    },
  { id: "soilTest",       label: "Soil Testing",      icon: "FlaskConical",  accent: "orange", i18n: { en: "Soil Testing", hi: "मृदा परीक्षण", bn: "মাটি পরীক্ষা" }  },
  { id: "machineryRental",label: "Machinery Rental",  icon: "Tractor",       accent: "yellow", i18n: { en: "Machinery Rental", hi: "मशीन किराया", bn: "যন্ত্র ভাড়া" }  },
  { id: "coldStorage",    label: "Cold Storage",      icon: "Snowflake",     accent: "blue", i18n: { en: "Cold Storage", hi: "शीत भंडार", bn: "হিমঘর" }    },
  { id: "transport",      label: "Transport",         icon: "Truck",         accent: "yellow", i18n: { en: "Transport", hi: "परिवहन", bn: "পরিবহন" }  },
  { id: "farmWorker",     label: "Farm Workers",      icon: "Users",         accent: "orange", i18n: { en: "Farm Workers", hi: "खेत मज़दूर", bn: "খামার শ্রমিক" }  },
  { id: "irrigation",     label: "Irrigation",        icon: "Droplets",      accent: "blue", i18n: { en: "Irrigation", hi: "सिंचाई", bn: "সেচ" }    },
  { id: "harvesting",     label: "Harvesting",        icon: "Wheat",         accent: "primary", i18n: { en: "Harvesting", hi: "कटाई", bn: "ফসল কাটা" } },
  { id: "packaging",      label: "Packaging & Grading",icon: "Package",     accent: "orange", i18n: { en: "Packaging & Grading", hi: "पैकेजिंग व ग्रेडिंग", bn: "প্যাকেজিং ও গ্রেডিং" }  },
  { id: "insurance",      label: "Insurance Advisory", icon: "ShieldCheck",  accent: "primary", i18n: { en: "Insurance Advisory", hi: "बीमा सलाह", bn: "বিমা পরামর্শ" } },
  { id: "legalLand",      label: "Legal & Land",      icon: "Landmark",      accent: "primary", i18n: { en: "Legal & Land", hi: "कानूनी व भूमि", bn: "আইনি ও জমি" } },
  { id: "training",       label: "Training",          icon: "GraduationCap", accent: "yellow", i18n: { en: "Training", hi: "प्रशिक्षण", bn: "প্রশিক্ষণ" }  },
];

export const PROVIDER_TYPES = [
  { id: "individual", label: "Individual Expert", i18n: { en: "Individual Expert", hi: "व्यक्तिगत विशेषज्ञ", bn: "ব্যক্তিগত বিশেষজ্ঞ" } },
  { id: "clinic",     label: "Clinic / Hospital", i18n: { en: "Clinic / Hospital", hi: "क्लिनिक / अस्पताल", bn: "ক্লিনিক / হাসপাতাল" } },
  { id: "company",    label: "Company", i18n: { en: "Company", hi: "कंपनी", bn: "কোম্পানি" } },
  { id: "fpo",        label: "FPO", i18n: { en: "FPO", hi: "FPO", bn: "FPO" } },
  { id: "cooperative",label: "Cooperative", i18n: { en: "Cooperative", hi: "सहकारी समिति", bn: "সমবায়" } },
  { id: "government", label: "Government Org", i18n: { en: "Government Org", hi: "सरकारी संस्था", bn: "সরকারি সংস্থা" } },
  { id: "ngo",        label: "NGO", i18n: { en: "NGO", hi: "NGO", bn: "NGO" } },
];

export const BOOKING_FLOW = ["pending", "confirmed", "in_progress", "completed"];

export const BOOKING_STATUS = {
  pending:     { label: "Pending",     a: "yellow", i18n: { en: "Pending", hi: "लंबित", bn: "মুলতুবি" }  },
  confirmed:   { label: "Confirmed",   a: "blue", i18n: { en: "Confirmed", hi: "पुष्ट", bn: "নিশ্চিত" }    },
  in_progress: { label: "In Progress", a: "orange", i18n: { en: "In Progress", hi: "चल रहा है", bn: "চলমান" }  },
  completed:   { label: "Completed",   a: "primary", i18n: { en: "Completed", hi: "पूर्ण", bn: "সম্পন্ন" } },
  cancelled:   { label: "Cancelled",   a: "red", i18n: { en: "Cancelled", hi: "रद्द", bn: "বাতিল" }     },
  no_show:     { label: "No Show",     a: "red", i18n: { en: "No Show", hi: "अनुपस्थित", bn: "অনুপস্থিত" }     },
};

export const PRICING_TYPES = [
  { id: "fixed",    label: "Fixed", i18n: { en: "Fixed", hi: "निश्चित", bn: "নির্দিষ্ট" } },
  { id: "hourly",   label: "Per Hour", i18n: { en: "Per Hour", hi: "प्रति घंटा", bn: "প্রতি ঘণ্টা" } },
  { id: "perAcre",  label: "Per Acre", i18n: { en: "Per Acre", hi: "प्रति एकड़", bn: "প্রতি একর" } },
  { id: "perVisit", label: "Per Visit", i18n: { en: "Per Visit", hi: "प्रति विज़िट", bn: "প্রতি ভিজিট" } },
  { id: "perDay",   label: "Per Day", i18n: { en: "Per Day", hi: "प्रति दिन", bn: "প্রতি দিন" } },
];

export const BOOKING_TYPES = [
  { id: "scheduled", label: "Scheduled", i18n: { en: "Scheduled", hi: "निर्धारित", bn: "নির্ধারিত" } },
  { id: "instant",   label: "Instant", i18n: { en: "Instant", hi: "तत्काल", bn: "তাৎক্ষণিক" } },
  { id: "emergency", label: "Emergency", i18n: { en: "Emergency", hi: "आपात", bn: "জরুরি" } },
];

export const LANGUAGES = [
  "Hindi", "Bengali", "English", "Tamil", "Telugu",
  "Kannada", "Marathi", "Gujarati", "Odia", "Punjabi",
];

export const PAYMENT_METHODS = [
  { id: "cod",  label: "Cash on Service", i18n: { en: "Cash on Service", hi: "सेवा पर नकद", bn: "সেবায় নগদ" } },
  { id: "upi",  label: "UPI on Service", i18n: { en: "UPI on Service", hi: "सेवा पर UPI", bn: "সেবায় UPI" } },
  { id: "bank", label: "Bank Transfer (settle directly)", i18n: { en: "Bank Transfer (settle directly)", hi: "बैंक ट्रांसफर (सीधे निपटान)", bn: "ব্যাঙ্ক ট্রান্সফার (সরাসরি নিষ্পত্তি)" } },
];

export const categoryMeta = (id) =>
  SERVICE_CATEGORIES.find((c) => c.id === id) ||
  { id, label: id, icon: "Handshake", accent: "primary" };
