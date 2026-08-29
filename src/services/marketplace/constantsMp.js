/* label stays English — it is the stored value, the text in CSV exports and
   the key reports group on. i18n is what the UI shows. */
/* Marketplace taxonomies. Icons are names from the curated Icon registry. */

export const PRODUCT_CATEGORIES = [
  { id: "seeds",      label: "Seeds",           icon: "Sprout",       accent: "primary", i18n: { en: "Seeds", hi: "बीज", bn: "বীজ" } },
  { id: "fertilizer", label: "Fertilizers",     icon: "Leaf",         accent: "primary", i18n: { en: "Fertilizers", hi: "उर्वरक", bn: "সার" } },
  { id: "pesticide",  label: "Crop Protection", icon: "SprayCan",     accent: "orange", i18n: { en: "Crop Protection", hi: "फ़सल सुरक्षा", bn: "ফসল সুরক্ষা" }  },
  { id: "bioinput",   label: "Bio Inputs",      icon: "FlaskConical", accent: "primary", i18n: { en: "Bio Inputs", hi: "जैविक इनपुट", bn: "জৈব উপকরণ" } },
  { id: "feed",       label: "Feed",            icon: "Package",      accent: "orange", i18n: { en: "Feed", hi: "चारा", bn: "খাদ্য" }  },
  { id: "medicine",   label: "Medicine",        icon: "Pill",         accent: "red", i18n: { en: "Medicine", hi: "दवा", bn: "ওষুধ" }     },
  { id: "equipment",  label: "Equipment",       icon: "Tractor",      accent: "yellow", i18n: { en: "Equipment", hi: "उपकरण", bn: "সরঞ্জাম" }  },
  { id: "tools",      label: "Tools & Spares",  icon: "Wrench",       accent: "blue", i18n: { en: "Tools & Spares", hi: "औज़ार व पुर्ज़े", bn: "সরঞ্জাম ও যন্ত্রাংশ" }    },
  { id: "organic",    label: "Organic Produce", icon: "Wheat",        accent: "primary", i18n: { en: "Organic Produce", hi: "जैविक उपज", bn: "জৈব উৎপাদন" } },
  { id: "livestock",  label: "Livestock",       icon: "Rabbit",       accent: "red", i18n: { en: "Livestock", hi: "पशुधन", bn: "পশুসম্পদ" }     },
];

export const UNITS = ["kg", "g", "L", "mL", "bag", "packet", "pcs", "set", "qtl", "animal"];

export const SELLER_TYPES = [
  { id: "farmer",       label: "Farmer", i18n: { en: "Farmer", hi: "किसान", bn: "কৃষক" } },
  { id: "fpo",          label: "FPO", i18n: { en: "FPO", hi: "FPO", bn: "FPO" } },
  { id: "cooperative",  label: "Cooperative", i18n: { en: "Cooperative", hi: "सहकारी समिति", bn: "সমবায়" } },
  { id: "dealer",       label: "Input Dealer", i18n: { en: "Input Dealer", hi: "इनपुट विक्रेता", bn: "উপকরণ বিক্রেতা" } },
  { id: "company",      label: "Company", i18n: { en: "Company", hi: "कंपनी", bn: "কোম্পানি" } },
  { id: "manufacturer", label: "Manufacturer", i18n: { en: "Manufacturer", hi: "निर्माता", bn: "প্রস্তুতকারক" } },
  { id: "distributor",  label: "Distributor", i18n: { en: "Distributor", hi: "वितरक", bn: "পরিবেশক" } },
  { id: "retailer",     label: "Retailer", i18n: { en: "Retailer", hi: "फुटकर विक्रेता", bn: "খুচরা বিক্রেতা" } },
  { id: "wholesaler",   label: "Wholesaler", i18n: { en: "Wholesaler", hi: "थोक विक्रेता", bn: "পাইকারি বিক্রেতা" } },
  { id: "govt",         label: "Government Org", i18n: { en: "Government Org", hi: "सरकारी संस्था", bn: "সরকারি সংস্থা" } },
];

/* Forward fulfilment flow. Cancel / return / refund sit outside the line. */
export const ORDER_FLOW = ["pending", "processing", "packed", "shipped", "delivered"];

export const ORDER_STATUS = {
  pending:         { label: "Pending",          a: "yellow", i18n: { en: "Pending", hi: "लंबित", bn: "মুলতুবি" }  },
  processing:      { label: "Processing",       a: "blue", i18n: { en: "Processing", hi: "प्रक्रिया में", bn: "প্রক্রিয়াধীন" }    },
  packed:          { label: "Packed",           a: "blue", i18n: { en: "Packed", hi: "पैक किया", bn: "প্যাক করা" }    },
  shipped:         { label: "Shipped",          a: "orange", i18n: { en: "Shipped", hi: "भेजा गया", bn: "পাঠানো হয়েছে" }  },
  delivered:       { label: "Delivered",        a: "primary", i18n: { en: "Delivered", hi: "वितरित", bn: "সরবরাহকৃত" } },
  cancelled:       { label: "Cancelled",        a: "red", i18n: { en: "Cancelled", hi: "रद्द", bn: "বাতিল" }     },
  returned:        { label: "Returned",         a: "red", i18n: { en: "Returned", hi: "वापस", bn: "ফেরত" }     },
  refundRequested: { label: "Refund requested", a: "orange", i18n: { en: "Refund requested", hi: "धनवापसी अनुरोध", bn: "ফেরতের অনুরোধ" }  },
  refundApproved:  { label: "Refund approved",  a: "primary", i18n: { en: "Refund approved", hi: "धनवापसी स्वीकृत", bn: "ফেরত অনুমোদিত" } },
};

/* Honest labels — no money moves in this phase; collection needs the backend. */
export const PAYMENT_METHODS = [
  { id: "cod",  label: "Cash on Delivery", i18n: { en: "Cash on Delivery", hi: "डिलीवरी पर नकद", bn: "ডেলিভারিতে নগদ" } },
  { id: "upi",  label: "UPI on Delivery", i18n: { en: "UPI on Delivery", hi: "डिलीवरी पर UPI", bn: "ডেলিভারিতে UPI" } },
  { id: "bank", label: "Bank Transfer (settle directly)", i18n: { en: "Bank Transfer (settle directly)", hi: "बैंक ट्रांसफर (सीधे निपटान)", bn: "ব্যাঙ্ক ট্রান্সফার (সরাসরি নিষ্পত্তি)" } },
];

export const PRODUCT_STATUS = {
  draft:     { label: "Draft",     a: "yellow", i18n: { en: "Draft", hi: "मसौदा", bn: "খসড়া" }  },
  published: { label: "Live",      a: "primary", i18n: { en: "Live", hi: "सक्रिय", bn: "সক্রিয়" } },
  archived:  { label: "Archived",  a: "red", i18n: { en: "Archived", hi: "संग्रहीत", bn: "সংরক্ষিত" }     },
};

export const categoryMeta = (id) =>
  PRODUCT_CATEGORIES.find((c) => c.id === id) ||
  { id, label: id, icon: "Package", accent: "primary" };
