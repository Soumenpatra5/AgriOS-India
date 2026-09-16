/* Languages offered at selection. `t` marks which have full UI dictionaries;
   others fall back to English until their dictionary is added (i18n is ready). */
export const LANGUAGES = [
  { code: "en", label: "English", native: "English", t: true },
  { code: "hi", label: "Hindi", native: "हिन्दी", t: true },
  { code: "bn", label: "Bengali", native: "বাংলা", t: true },
  { code: "ta", label: "Tamil", native: "தமிழ்", t: true },
  { code: "te", label: "Telugu", native: "తెలుగు", t: true },
  { code: "mr", label: "Marathi", native: "मराठी", t: true },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", t: true },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ", t: true },
];
export const LOCALES = { en: "en-IN", hi: "hi-IN", bn: "bn-IN", ta: "ta-IN", te: "te-IN", mr: "mr-IN", pa: "pa-IN", or: "or-IN" };
