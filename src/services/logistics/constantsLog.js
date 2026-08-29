/* label stays English — it is the stored value, the text in shipment and
   contract records, and the key reports group on. i18n is what the UI shows. */
/* Logistics & Smart Commerce taxonomies. */

export const PROVIDER_TYPES = [
  { id: "individual",  label: "Owner-Operator", i18n: { en: "Owner-Operator", hi: "स्वामी-चालक", bn: "মালিক-চালক" } },
  { id: "fleet",       label: "Fleet Company", i18n: { en: "Fleet Company", hi: "फ़्लीट कंपनी", bn: "ফ্লিট কোম্পানি" } },
  { id: "cooperative", label: "Transport Co-op", i18n: { en: "Transport Co-op", hi: "परिवहन सहकारी", bn: "পরিবহন সমবায়" } },
  { id: "fpo",         label: "FPO Logistics", i18n: { en: "FPO Logistics", hi: "FPO लॉजिस्टिक्स", bn: "FPO লজিস্টিকস" } },
  { id: "logistics",   label: "3PL / Logistics Co.", i18n: { en: "3PL / Logistics Co.", hi: "3PL / लॉजिस्टिक्स कंपनी", bn: "3PL / লজিস্টিকস কোম্পানি" } },
];

export const VEHICLE_CATEGORIES = [
  { id: "truck",       label: "Truck",            icon: "Truck",      accent: "primary", capacityKg: 10000, i18n: { en: "Truck", hi: "ट्रक", bn: "ট্রাক" } },
  { id: "miniTruck",   label: "Mini Truck",       icon: "Truck",      accent: "blue",    capacityKg: 3000, i18n: { en: "Mini Truck", hi: "मिनी ट्रक", bn: "মিনি ট্রাক" }  },
  { id: "pickupVan",   label: "Pickup Van",       icon: "Truck",      accent: "blue",    capacityKg: 1500, i18n: { en: "Pickup Van", hi: "पिकअप वैन", bn: "পিকআপ ভ্যান" }  },
  { id: "tractor",     label: "Tractor-Trolley",  icon: "Tractor",    accent: "yellow",  capacityKg: 5000, i18n: { en: "Tractor-Trolley", hi: "ट्रैक्टर-ट्रॉली", bn: "ট্রাক্টর-ট্রলি" }  },
  { id: "threeWheeler",label: "Three-Wheeler",    icon: "Truck",      accent: "orange",  capacityKg: 500, i18n: { en: "Three-Wheeler", hi: "तिपहिया", bn: "তিন চাকা" }   },
  { id: "coldChain",   label: "Cold-Chain Vehicle",icon: "Snowflake", accent: "blue",    capacityKg: 8000, i18n: { en: "Cold-Chain Vehicle", hi: "शीत-श्रृंखला वाहन", bn: "শীতল-শৃঙ্খল যান" }  },
  { id: "container",   label: "Container",        icon: "Container",  accent: "primary", capacityKg: 25000, i18n: { en: "Container", hi: "कंटेनर", bn: "কন্টেইনার" } },
  { id: "railReady",   label: "Rail-Ready Wagon", icon: "Container",  accent: "primary", capacityKg: 60000, i18n: { en: "Rail-Ready Wagon", hi: "रेल वैगन", bn: "রেল ওয়াগন" } },
];

export const vehicleMeta = (id) =>
  VEHICLE_CATEGORIES.find((v) => v.id === id) ||
  { id, label: id, icon: "Truck", accent: "primary", capacityKg: 0 };

/* Shipment lifecycle — forward flow + terminal branches. */
export const SHIPMENT_FLOW = ["pending", "assigned", "picked_up", "in_transit", "delivered"];

export const SHIPMENT_STATUS = {
  pending:    { label: "Pending",     a: "yellow", i18n: { en: "Pending", hi: "लंबित", bn: "মুলতুবি" }  },
  assigned:   { label: "Assigned",    a: "blue", i18n: { en: "Assigned", hi: "सौंपा गया", bn: "বরাদ্দকৃত" }    },
  picked_up:  { label: "Picked Up",   a: "blue", i18n: { en: "Picked Up", hi: "उठाया गया", bn: "সংগ্রহ করা হয়েছে" }    },
  in_transit: { label: "In Transit",  a: "orange", i18n: { en: "In Transit", hi: "रास्ते में", bn: "পথে" }  },
  delivered:  { label: "Delivered",   a: "primary", i18n: { en: "Delivered", hi: "वितरित", bn: "সরবরাহকৃত" } },
  returned:   { label: "Returned",    a: "red", i18n: { en: "Returned", hi: "वापस", bn: "ফেরত" }     },
  cancelled:  { label: "Cancelled",   a: "red", i18n: { en: "Cancelled", hi: "रद्द", bn: "বাতিল" }     },
};

export const DRIVER_STATUS = {
  available:  { label: "Available",   a: "primary", i18n: { en: "Available", hi: "उपलब्ध", bn: "উপলব্ধ" } },
  on_trip:    { label: "On Trip",     a: "orange", i18n: { en: "On Trip", hi: "यात्रा पर", bn: "যাত্রায়" }  },
  off_duty:   { label: "Off Duty",    a: "yellow", i18n: { en: "Off Duty", hi: "ड्यूटी से बाहर", bn: "ডিউটির বাইরে" }  },
};

export const WAREHOUSE_TYPES = [
  { id: "dry",        label: "Dry Warehouse",   icon: "Warehouse", accent: "orange", cold: false, i18n: { en: "Dry Warehouse", hi: "सूखा गोदाम", bn: "শুকনো গুদাম" } },
  { id: "cold",       label: "Cold Storage",    icon: "Snowflake", accent: "blue",   cold: true, i18n: { en: "Cold Storage", hi: "शीत भंडार", bn: "হিমঘর" }  },
  { id: "controlled", label: "Controlled Atmosphere", icon: "Thermometer", accent: "blue", cold: true, i18n: { en: "Controlled Atmosphere", hi: "नियंत्रित वातावरण", bn: "নিয়ন্ত্রিত পরিবেশ" } },
  { id: "silo",       label: "Grain Silo",      icon: "Boxes",     accent: "yellow", cold: false, i18n: { en: "Grain Silo", hi: "अनाज साइलो", bn: "শস্য সাইলো" } },
  { id: "packhouse",  label: "Pack House",      icon: "Package",   accent: "primary",cold: false, i18n: { en: "Pack House", hi: "पैक हाउस", bn: "প্যাক হাউস" } },
];

export const warehouseMeta = (id) =>
  WAREHOUSE_TYPES.find((w) => w.id === id) ||
  { id, label: id, icon: "Warehouse", accent: "orange", cold: false };

export const STORAGE_BOOKING_STATUS = {
  requested: { label: "Requested", a: "yellow", i18n: { en: "Requested", hi: "अनुरोधित", bn: "অনুরোধকৃত" }  },
  active:    { label: "Active",    a: "primary", i18n: { en: "Active", hi: "सक्रिय", bn: "সক্রিয়" } },
  completed: { label: "Completed", a: "blue", i18n: { en: "Completed", hi: "पूर्ण", bn: "সম্পন্ন" }    },
  cancelled: { label: "Cancelled", a: "red", i18n: { en: "Cancelled", hi: "रद्द", bn: "বাতিল" }     },
};

export const CONTRACT_STATUS = {
  draft:     { label: "Draft",     a: "yellow", i18n: { en: "Draft", hi: "मसौदा", bn: "খসড়া" }  },
  offered:   { label: "Offered",   a: "blue", i18n: { en: "Offered", hi: "प्रस्तावित", bn: "প্রস্তাবিত" }    },
  active:    { label: "Active",    a: "primary", i18n: { en: "Active", hi: "सक्रिय", bn: "সক্রিয়" } },
  completed: { label: "Completed", a: "blue", i18n: { en: "Completed", hi: "पूर्ण", bn: "সম্পন্ন" }    },
  disputed:  { label: "Disputed",  a: "red", i18n: { en: "Disputed", hi: "विवादित", bn: "বিতর্কিত" }     },
  cancelled: { label: "Cancelled", a: "red", i18n: { en: "Cancelled", hi: "रद्द", bn: "বাতিল" }     },
};

export const AUCTION_TYPES = [
  { id: "forward", label: "Forward (sell to highest)", i18n: { en: "Forward (sell to highest)", hi: "फॉरवर्ड (सर्वोच्च बोली को बेचें)", bn: "ফরওয়ার্ড (সর্বোচ্চ দরে বিক্রি)" } },
  { id: "reverse", label: "Reverse (buy at lowest)", i18n: { en: "Reverse (buy at lowest)", hi: "रिवर्स (न्यूनतम बोली पर खरीदें)", bn: "রিভার্স (সর্বনিম্ন দরে ক্রয়)" } },
];

export const AUCTION_STATUS = {
  scheduled: { label: "Scheduled", a: "yellow", i18n: { en: "Scheduled", hi: "निर्धारित", bn: "নির্ধারিত" }  },
  live:      { label: "Live",      a: "primary", i18n: { en: "Live", hi: "चालू", bn: "চালু" } },
  closed:    { label: "Closed",    a: "blue", i18n: { en: "Closed", hi: "बंद", bn: "বন্ধ" }    },
  awarded:   { label: "Awarded",   a: "primary", i18n: { en: "Awarded", hi: "प्रदान किया", bn: "প্রদত্ত" } },
  cancelled: { label: "Cancelled", a: "red", i18n: { en: "Cancelled", hi: "रद्द", bn: "বাতিল" }     },
};

export const PROCUREMENT_TYPES = [
  { id: "government",  label: "Government Procurement", icon: "Landmark", i18n: { en: "Government Procurement", hi: "सरकारी खरीद", bn: "সরকারি ক্রয়" } },
  { id: "fpo",         label: "FPO Procurement",        icon: "Users", i18n: { en: "FPO Procurement", hi: "FPO खरीद", bn: "FPO ক্রয়" } },
  { id: "cooperative", label: "Cooperative Procurement",icon: "Users", i18n: { en: "Cooperative Procurement", hi: "सहकारी खरीद", bn: "সমবায় ক্রয়" } },
  { id: "private",     label: "Private Procurement",    icon: "Building2", i18n: { en: "Private Procurement", hi: "निजी खरीद", bn: "বেসরকারি ক্রয়" } },
];

export const procurementMeta = (id) =>
  PROCUREMENT_TYPES.find((p) => p.id === id) ||
  { id, label: id, icon: "ClipboardList" };

export const PROCUREMENT_STATUS = {
  open:      { label: "Open",      a: "primary", i18n: { en: "Open", hi: "खुला", bn: "খোলা" } },
  reviewing: { label: "Reviewing", a: "orange", i18n: { en: "Reviewing", hi: "समीक्षा में", bn: "পর্যালোচনাধীন" }  },
  awarded:   { label: "Awarded",   a: "blue", i18n: { en: "Awarded", hi: "प्रदान किया", bn: "প্রদত্ত" }    },
  closed:    { label: "Closed",    a: "yellow", i18n: { en: "Closed", hi: "बंद", bn: "বন্ধ" }  },
};

export const EXPORT_STATUS = {
  preparing:  { label: "Preparing",  a: "yellow", i18n: { en: "Preparing", hi: "तैयारी में", bn: "প্রস্তুতিতে" }  },
  documented: { label: "Documented", a: "blue", i18n: { en: "Documented", hi: "दस्तावेज़ीकृत", bn: "নথিভুক্ত" }    },
  cleared:    { label: "Cleared",    a: "primary", i18n: { en: "Cleared", hi: "स्वीकृत", bn: "ছাড়পত্রপ্রাপ্ত" } },
  shipped:    { label: "Shipped",    a: "orange", i18n: { en: "Shipped", hi: "भेजा गया", bn: "পাঠানো হয়েছে" }  },
  delivered:  { label: "Delivered",  a: "primary", i18n: { en: "Delivered", hi: "वितरित", bn: "সরবরাহকৃত" } },
};

/* Export document checklist — status-only, no real customs integration. */
export const EXPORT_DOCS = [
  "Commercial Invoice",
  "Packing List",
  "Phytosanitary Certificate",
  "Certificate of Origin",
  "Bill of Lading",
  "APEDA Registration",
  "Quality / Residue Certificate",
];

/* Payment terms — bookkeeping labels only, no money movement. */
export const PAYMENT_TERMS = [
  { id: "onDelivery", label: "On Delivery", i18n: { en: "On Delivery", hi: "डिलीवरी पर", bn: "ডেলিভারিতে" } },
  { id: "advance",    label: "Advance", i18n: { en: "Advance", hi: "अग्रिम", bn: "অগ্রিম" } },
  { id: "milestone",  label: "Milestone", i18n: { en: "Milestone", hi: "चरणबद्ध", bn: "ধাপে ধাপে" } },
  { id: "escrow",     label: "Escrow (held till delivery)", i18n: { en: "Escrow (held till delivery)", hi: "एस्क्रो (डिलीवरी तक रोका)", bn: "এসক্রো (ডেলিভারি পর্যন্ত আটক)" } },
  { id: "credit30",   label: "Net 30 Credit", i18n: { en: "Net 30 Credit", hi: "नेट 30 उधार", bn: "নেট ৩০ ক্রেডিট" } },
];

export const COMMODITIES = [
  "Paddy", "Wheat", "Potato", "Onion", "Mustard", "Maize",
  "Tomato", "Jute", "Tea", "Pulses", "Banana", "Mango",
];

export const QUALITY_GRADES = ["A / FAQ", "B / Standard", "C / Fair", "Export Grade"];

/* Preset pickup/drop locations (lat/lon carried through for distance/ETA).
   A geocoded free-text picker is deferred to the backend phase. */
export const PLACES = [
  { id: "barasat",  name: "Barasat",             lat: 22.72, lon: 88.48, i18n: { en: "Barasat", hi: "बारासात", bn: "বারাসাত" } },
  { id: "kolkata",  name: "Kolkata Wholesale Mkt", lat: 22.57, lon: 88.36, i18n: { en: "Kolkata Wholesale Mkt", hi: "कोलकाता थोक मंडी", bn: "কলকাতা পাইকারি বাজার" } },
  { id: "hooghly",  name: "Hooghly",             lat: 22.90, lon: 88.39, i18n: { en: "Hooghly", hi: "हुगली", bn: "হুগলি" } },
  { id: "burdwan",  name: "Burdwan",             lat: 23.24, lon: 87.86, i18n: { en: "Burdwan", hi: "बर्दवान", bn: "বর্ধমান" } },
  { id: "siliguri", name: "Siliguri",            lat: 26.72, lon: 88.39, i18n: { en: "Siliguri", hi: "सिलीगुड़ी", bn: "শিলিগুড়ি" } },
  { id: "durgapur", name: "Durgapur",            lat: 23.55, lon: 87.29, i18n: { en: "Durgapur", hi: "दुर्गापुर", bn: "দুর্গাপুর" } },
  { id: "nadia",    name: "Nadia",               lat: 23.47, lon: 88.55, i18n: { en: "Nadia", hi: "नदिया", bn: "নদিয়া" } },
  { id: "haldia",   name: "Haldia Port",         lat: 22.06, lon: 88.06, i18n: { en: "Haldia Port", hi: "हल्दिया बंदरगाह", bn: "হলদিয়া বন্দর" } },
];

export const placeById = (id) => PLACES.find((p) => p.id === id) || PLACES[0];

/* Simulated telemetry sensor kinds — link to iot/deviceRegistry protocols. */
export const SENSOR_KINDS = [
  { id: "gps",         label: "GPS Location", icon: "MapPin",      unit: "", i18n: { en: "GPS Location", hi: "GPS स्थान", bn: "GPS অবস্থান" } },
  { id: "temperature", label: "Temperature",  icon: "Thermometer", unit: "°C", i18n: { en: "Temperature", hi: "तापमान", bn: "তাপমাত্রা" } },
  { id: "humidity",    label: "Humidity",     icon: "Droplets",    unit: "%", i18n: { en: "Humidity", hi: "आर्द्रता", bn: "আর্দ্রতা" } },
];
