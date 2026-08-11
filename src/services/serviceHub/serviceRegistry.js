/* AgriOS Service Hub — the single catalogue of every user-facing capability,
   grouped into categories for discovery. This is data only: each entry points
   at an existing routable screen `kind` (see src/navigation/ScreenRouter.jsx)
   — nothing here implements behaviour, and nothing is faked. Services that
   don't have a screen yet are marked `coming: true` and route to the shared
   "coming soon" FeatureDetail stub rather than pretending to work.

   `types` lists the farmer-profile enterprise types (src/customize/farmerTypes.js)
   a service is relevant to; a service with no `types` is universal (always
   suggested). This drives the "Suggested for your farm" personalization,
   reusing the same prefs.farmerProfile the rest of the app already uses.

   Adding a new service later = one entry here. The hub screen never changes. */

export const SERVICE_CATEGORIES = [
  { id: "farm",         label: { en: "Farm management", hi: "फार्म प्रबंधन", bn: "খামার ব্যবস্থাপনা" }, icon: "LayoutGrid",   accent: "primary" },
  { id: "crop",         label: { en: "Crop & agriculture", hi: "फसल व कृषि", bn: "ফসল ও কৃষি" }, icon: "Wheat",        accent: "primary" },
  { id: "livestock",    label: { en: "Livestock", hi: "पशुपालन", bn: "পশুপালন" }, icon: "Rabbit",       accent: "red"     },
  { id: "workforce",    label: { en: "Workforce", hi: "श्रमबल", bn: "শ্রমশক্তি" }, icon: "Users",        accent: "orange"  },
  { id: "inventory",    label: { en: "Inventory & procurement", hi: "इन्वेंटरी व खरीद", bn: "ইনভেন্টরি ও ক্রয়" }, icon: "Warehouse",    accent: "orange"  },
  { id: "finance",      label: { en: "Finance & business", hi: "वित्त व व्यापार", bn: "অর্থ ও ব্যবসা" }, icon: "BarChart3",    accent: "blue"    },
  { id: "marketplace",  label: { en: "Marketplace", hi: "बाज़ार", bn: "বাজার" }, icon: "ShoppingBag",  accent: "primary" },
  { id: "logistics",    label: { en: "Logistics", hi: "परिवहन", bn: "পরিবহন" }, icon: "Truck",        accent: "yellow"  },
  { id: "professional", label: { en: "Professional services", hi: "पेशेवर सेवाएँ", bn: "পেশাদার সেবা" }, icon: "Handshake",    accent: "primary" },
  { id: "ai",           label: { en: "AI & smart farm", hi: "AI व स्मार्ट फार्म", bn: "AI ও স্মার্ট ফার্ম" }, icon: "Sparkles",     accent: "blue"    },
  { id: "government",   label: { en: "Government & schemes", hi: "सरकार व योजनाएँ", bn: "সরকার ও স্কিম" }, icon: "Landmark",     accent: "primary" },
  { id: "documents",    label: { en: "Documents", hi: "दस्तावेज़", bn: "নথিপত্র" }, icon: "FileText",     accent: "blue"    },
  { id: "reports",      label: { en: "Reports & analytics", hi: "रिपोर्ट व विश्लेषण", bn: "রিপোর্ট ও বিশ্লেষণ" }, icon: "PieChart",     accent: "primary" },
  { id: "settings",     label: { en: "Settings & admin", hi: "सेटिंग्स व एडमिन", bn: "সেটিংস ও অ্যাডমিন" }, icon: "Settings",     accent: "blue"    },
];

/* badge: "new" | "ai" | "premium" (rendered as a small pill). coming: true
   overrides — shows a "Soon" badge and routes to the coming-soon stub. */
export const SERVICE_REGISTRY = [
  /* ── Farm management ── */
  { id: "erp",          category: "farm", icon: "LayoutGrid", accent: "primary", kind: "farmErp",
    title: { en: "Farm ERP", hi: "फार्म ERP", bn: "ফার্ম ERP" }, desc: { en: "Farms, land, assets, team, CRM & more", hi: "फार्म, ज़मीन, संपत्ति, टीम, CRM", bn: "খামার, জমি, সম্পদ, টিম, CRM" }, keywords: "erp management hub" },
  { id: "farmProfiles", category: "farm", icon: "House", accent: "primary", kind: "farmProfiles",
    title: { en: "Farm profiles", hi: "फार्म प्रोफ़ाइल", bn: "খামার প্রোফাইল" }, desc: { en: "Manage multiple farms", hi: "कई फार्म प्रबंधित करें", bn: "একাধিক খামার পরিচালনা" }, keywords: "multiple farms" },
  { id: "land",         category: "farm", icon: "Map", accent: "orange", kind: "landManager",
    title: { en: "Land management", hi: "भूमि प्रबंधन", bn: "জমি ব্যবস্থাপনা" }, desc: { en: "Parcels, soil, water & lease", hi: "खसरा, मिट्टी, पानी, पट्टा", bn: "জমি, মাটি, জল, ইজারা" }, keywords: "field parcel boundary lease water irrigation soil" },
  { id: "assets",       category: "farm", icon: "Tractor", accent: "yellow", kind: "erpAssets",
    title: { en: "Farm assets", hi: "फार्म संपत्ति", bn: "খামার সম্পদ" }, desc: { en: "Machinery, tools & maintenance", hi: "मशीन, औज़ार, रखरखाव", bn: "যন্ত্র, সরঞ্জাম, রক্ষণাবেক্ষণ" }, keywords: "machinery equipment tools maintenance" },
  { id: "devices",      category: "farm", icon: "Satellite", accent: "yellow", kind: "erpDevices",
    title: { en: "IoT devices", hi: "IoT डिवाइस", bn: "IoT ডিভাইস" }, desc: { en: "Sensors & smart equipment", hi: "सेंसर व स्मार्ट उपकरण", bn: "সেন্সর ও স্মার্ট যন্ত্র" }, keywords: "sensor iot smart feeder weight" },
  { id: "locations",    category: "farm", icon: "MapPin", accent: "blue", kind: "farmLocations",
    title: { en: "Farm locations", hi: "फार्म स्थान", bn: "খামার অবস্থান" }, desc: { en: "Map your farm & fields", hi: "फार्म व खेत मैप करें", bn: "খামার ও মাঠ ম্যাপ" }, keywords: "map gps boundary location" },

  /* ── Crop & agriculture ── */
  { id: "cropCalendar", category: "crop", icon: "CalendarDays", accent: "primary", kind: "cropCalendar", types: ["crop"],
    title: { en: "Crop calendar", hi: "फसल कैलेंडर", bn: "ফসল ক্যালেন্ডার" }, desc: { en: "Season tasks & reminders", hi: "मौसमी काम व रिमाइंडर", bn: "মৌসুমি কাজ ও রিমাইন্ডার" }, keywords: "sowing harvest schedule spraying fertilizer" },
  { id: "cropPlanner",  category: "crop", icon: "Calculator", accent: "yellow", kind: "cropPlanList", types: ["crop"], badge: "new",
    title: { en: "Crop planner", hi: "फसल योजनाकार", bn: "ফসল পরিকল্পক" }, desc: { en: "Seed, inputs, cost & profit", hi: "बीज, इनपुट, लागत, मुनाफा", bn: "বীজ, ইনপুট, খরচ, মুনাফা" }, keywords: "seed calculator cultivation cost profitability planning" },
  { id: "fertCalc",     category: "crop", icon: "Leaf", accent: "primary", kind: "calculator", props: { id: "fert" }, types: ["crop"],
    title: { en: "Fertilizer calculator", hi: "उर्वरक कैलकुलेटर", bn: "সার ক্যালকুলেটর" }, desc: { en: "Dose & bags for your field", hi: "खेत के लिए मात्रा व बोरे", bn: "মাঠের জন্য মাত্রা ও বস্তা" }, keywords: "fertilizer dose urea dap npk" },
  { id: "yieldCalc",    category: "crop", icon: "BarChart3", accent: "red", kind: "calculator", props: { id: "yield" }, types: ["crop"],
    title: { en: "Yield calculator", hi: "उपज कैलकुलेटर", bn: "ফলন ক্যালকুলেটর" }, desc: { en: "Per-acre yield & value", hi: "प्रति एकड़ उपज व मूल्य", bn: "একর প্রতি ফলন ও মূল্য" }, keywords: "yield production estimate" },
  { id: "plantDisease", category: "crop", icon: "Microscope", accent: "red", kind: "diagnosticsHome", types: ["crop"], badge: "ai",
    title: { en: "Plant disease detection", hi: "पौध रोग पहचान", bn: "গাছের রোগ শনাক্ত" }, desc: { en: "Snap a photo, get a diagnosis", hi: "फोटो लें, निदान पाएँ", bn: "ছবি তুলুন, রোগ নির্ণয়" }, keywords: "disease pest photo diagnosis crop health" },
  { id: "weather",      category: "crop", icon: "CloudSun", accent: "blue", kind: "weather",
    title: { en: "Weather", hi: "मौसम", bn: "আবহাওয়া" }, desc: { en: "Forecast & farm advisories", hi: "पूर्वानुमान व सलाह", bn: "পূর্বাভাস ও পরামর্শ" }, keywords: "weather rain forecast advisory spraying window" },

  /* ── Livestock ── */
  { id: "livestock",    category: "livestock", icon: "Rabbit", accent: "primary", kind: "livestockHub",
    title: { en: "Livestock manager", hi: "पशुपालन प्रबंधक", bn: "পশুপালন ম্যানেজার" }, desc: { en: "All your animal enterprises", hi: "आपके सभी पशु उद्यम", bn: "আপনার সব পশু উদ্যোগ" }, keywords: "animal livestock hub" },
  { id: "poultry",      category: "livestock", icon: "Bird", accent: "orange", kind: "poultryManager", types: ["poultry"],
    title: { en: "Poultry manager", hi: "मुर्गी प्रबंधक", bn: "মুরগি ম্যানেজার" }, desc: { en: "Flocks, eggs & production", hi: "झुंड, अंडे, उत्पादन", bn: "ঝাঁক, ডিম, উৎপাদন" }, keywords: "poultry chicken broiler layer egg flock" },
  { id: "dairy",        category: "livestock", icon: "Milk", accent: "blue", kind: "dairyManager", types: ["dairy"],
    title: { en: "Dairy manager", hi: "डेयरी प्रबंधक", bn: "ডেয়ারি ম্যানেজার" }, desc: { en: "Cows, buffalo & milk yield", hi: "गाय, भैंस, दूध उपज", bn: "গরু, মহিষ, দুধ উৎপাদন" }, keywords: "dairy cow buffalo milk lactation" },
  { id: "goat",         category: "livestock", icon: "Rabbit", accent: "primary", kind: "goatManager", types: ["goat"],
    title: { en: "Goat manager", hi: "बकरी प्रबंधक", bn: "ছাগল ম্যানেজার" }, desc: { en: "Herd, weight & breeding", hi: "झुंड, वज़न, प्रजनन", bn: "পাল, ওজন, প্রজনন" }, keywords: "goat herd" },
  { id: "pig",          category: "livestock", icon: "PiggyBank", accent: "red", kind: "pigManager", types: ["pig"],
    title: { en: "Pig manager", hi: "सूअर प्रबंधक", bn: "শূকর ম্যানেজার" }, desc: { en: "Herd, weight & breeding", hi: "झुंड, वज़न, प्रजनन", bn: "পাল, ওজন, প্রজনন" }, keywords: "pig piggery herd" },
  { id: "sheep",        category: "livestock", icon: "Beef", accent: "blue", kind: "sheepManager",
    title: { en: "Sheep manager", hi: "भेड़ प्रबंधक", bn: "ভেড়া ম্যানেজার" }, desc: { en: "Flock, weight & wool", hi: "झुंड, वज़न, ऊन", bn: "পাল, ওজন, পশম" }, keywords: "sheep flock wool" },
  { id: "fish",         category: "livestock", icon: "Fish", accent: "blue", kind: "fishManager", types: ["fish"],
    title: { en: "Fish / pond manager", hi: "मछली / तालाब प्रबंधक", bn: "মাছ / পুকুর ম্যানেজার" }, desc: { en: "Ponds, stocking & harvest", hi: "तालाब, स्टॉकिंग, कटाई", bn: "পুকুর, মজুত, ফসল" }, keywords: "fish pond aqua stocking water quality biomass" },
  { id: "bee",          category: "livestock", icon: "Bug", accent: "yellow", kind: "beeManager", types: ["bee"],
    title: { en: "Bee manager", hi: "मधुमक्खी प्रबंधक", bn: "মৌমাছি ম্যানেজার" }, desc: { en: "Hives, honey & inspections", hi: "छत्ते, शहद, निरीक्षण", bn: "মৌচাক, মধু, পরিদর্শন" }, keywords: "bee apiary honey hive" },
  { id: "feedMgmt",     category: "livestock", icon: "Package", accent: "orange", kind: "feedHub", badge: "new",
    title: { en: "Feed management", hi: "चारा प्रबंधन", bn: "খাদ্য ব্যবস্থাপনা" }, desc: { en: "Feed, FCR, cost & analytics", hi: "चारा, FCR, लागत, विश्लेषण", bn: "খাদ্য, FCR, খরচ, বিশ্লেষণ" }, keywords: "feed fodder fcr consumption ration" },
  { id: "feedCalc",     category: "livestock", icon: "Calculator", accent: "yellow", kind: "feedCalculator",
    title: { en: "Feed cost calculator", hi: "चारा लागत कैलकुलेटर", bn: "খাদ্য খরচ ক্যালকুলেটর" }, desc: { en: "Estimate feed needs & cost", hi: "चारा ज़रूरत व लागत", bn: "খাদ্যের প্রয়োজন ও খরচ" }, keywords: "feed cost calculator" },
  { id: "vax",          category: "livestock", icon: "Syringe", accent: "red", kind: "vaccinationCalendar",
    title: { en: "Vaccination calendar", hi: "टीकाकरण कैलेंडर", bn: "টিকাকরণ ক্যালেন্ডার" }, desc: { en: "Upcoming & missed vaccinations", hi: "आने वाले व छूटे टीके", bn: "আসন্ন ও বাকি টিকা" }, keywords: "vaccination vaccine health medicine" },
  { id: "livestockDisease", category: "livestock", icon: "Stethoscope", accent: "red", kind: "diagnosticsHome", badge: "ai",
    title: { en: "Livestock disease analysis", hi: "पशु रोग विश्लेषण", bn: "পশু রোগ বিশ্লেষণ" }, desc: { en: "AI-assisted symptom check", hi: "AI लक्षण जाँच", bn: "AI উপসর্গ যাচাই" }, keywords: "disease diagnosis symptom animal health" },
  { id: "vet",          category: "livestock", icon: "Stethoscope", accent: "red", kind: "svcMarketplace", props: { category: "vet" },
    title: { en: "Veterinary", hi: "पशु चिकित्सा", bn: "পশু চিকিৎসা" }, desc: { en: "Doctors & clinics near you", hi: "आपके पास डॉक्टर व क्लिनिक", bn: "কাছের ডাক্তার ও ক্লিনিক" }, keywords: "vet veterinary doctor clinic" },
  { id: "duck",         category: "livestock", icon: "Bird", accent: "orange", coming: true,
    title: { en: "Duck manager", hi: "बत्तख प्रबंधक", bn: "হাঁস ম্যানেজার" }, desc: { en: "Coming soon", hi: "जल्द आ रहा है", bn: "শীঘ্রই আসছে" }, keywords: "duck" },
  { id: "rabbit",       category: "livestock", icon: "Rabbit", accent: "primary", coming: true,
    title: { en: "Rabbit manager", hi: "खरगोश प्रबंधक", bn: "খরগোশ ম্যানেজার" }, desc: { en: "Coming soon", hi: "जल्द आ रहा है", bn: "শীঘ্রই আসছে" }, keywords: "rabbit" },

  /* ── Workforce ── */
  { id: "workers",      category: "workforce", icon: "Users", accent: "orange", kind: "erpEmployees",
    title: { en: "Worker & team management", hi: "श्रमिक व टीम प्रबंधन", bn: "শ্রমিক ও টিম ব্যবস্থাপনা" }, desc: { en: "Workers, attendance, wages & documents", hi: "श्रमिक, हाजिरी, मजदूरी, दस्तावेज़", bn: "শ্রমিক, হাজিরা, মজুরি, নথি" }, keywords: "worker employee labour attendance payroll wage salary team staff document" },

  /* ── Inventory & procurement ── */
  { id: "inventory",    category: "inventory", icon: "Warehouse", accent: "orange", kind: "erpInventory",
    title: { en: "Inventory", hi: "इन्वेंटरी", bn: "ইনভেন্টরি" }, desc: { en: "Feed, medicine, seed & stock alerts", hi: "चारा, दवा, बीज, स्टॉक अलर्ट", bn: "খাদ্য, ওষুধ, বীজ, স্টক সতর্কতা" }, keywords: "inventory stock feed medicine seed fertilizer pesticide fuel low stock expiry" },
  { id: "feedInventory", category: "inventory", icon: "Package", accent: "orange", kind: "feedInventory",
    title: { en: "Feed inventory", hi: "चारा इन्वेंटरी", bn: "খাদ্য ইনভেন্টরি" }, desc: { en: "Feed stock, expiry & value", hi: "चारा स्टॉक, समाप्ति, मूल्य", bn: "খাদ্য স্টক, মেয়াদ, মূল্য" }, keywords: "feed inventory stock" },
  { id: "suppliers",    category: "inventory", icon: "Handshake", accent: "primary", kind: "erpCrm",
    title: { en: "Suppliers & CRM", hi: "आपूर्तिकर्ता व CRM", bn: "সরবরাহকারী ও CRM" }, desc: { en: "Contacts, orders & payments", hi: "संपर्क, ऑर्डर, भुगतान", bn: "যোগাযোগ, অর্ডার, পেমেন্ট" }, keywords: "supplier vendor contact purchase order crm" },
  { id: "procurement",  category: "inventory", icon: "ClipboardList", accent: "blue", kind: "logProcurement",
    title: { en: "Procurement", hi: "खरीद", bn: "ক্রয়" }, desc: { en: "Purchase requests & orders", hi: "खरीद अनुरोध व ऑर्डर", bn: "ক্রয় অনুরোধ ও অর্ডার" }, keywords: "procurement purchase order quotation supplier" },

  /* ── Finance & business ── */
  { id: "business",     category: "finance", icon: "BarChart3", accent: "blue", kind: "businessDashboard",
    title: { en: "Farm business", hi: "खेत व्यापार", bn: "খামার ব্যবসা" }, desc: { en: "P&L, cash flow & profit", hi: "लाभ-हानि, नगदी, मुनाफा", bn: "লাভ-ক্ষতি, নগদ, মুনাফা" }, keywords: "business profit loss cash flow roi break-even" },
  { id: "ledger",       category: "finance", icon: "BookOpen", accent: "primary", kind: "farmLedger",
    title: { en: "Farm ledger", hi: "खेत का खाता", bn: "খামারের খাতা" }, desc: { en: "Income & expense tracking", hi: "आय व खर्च ट्रैकिंग", bn: "আয় ও খরচ হিসাব" }, keywords: "ledger income expense accounts money cash" },
  { id: "pl",           category: "finance", icon: "TrendingUp", accent: "primary", kind: "plReport",
    title: { en: "Profit & loss", hi: "लाभ-हानि", bn: "লাভ-ক্ষতি" }, desc: { en: "Enterprise-wise P&L", hi: "उद्यम अनुसार लाभ-हानि", bn: "উদ্যোগ অনুযায়ী লাভ-ক্ষতি" }, keywords: "profit loss pl enterprise" },
  { id: "cashFlow",     category: "finance", icon: "ArrowLeftRight", accent: "blue", kind: "cashFlow",
    title: { en: "Cash flow", hi: "नगदी प्रवाह", bn: "নগদ প্রবাহ" }, desc: { en: "Monthly opening & closing balance", hi: "मासिक शुरुआती व अंतिम शेष", bn: "মাসিক খোলা ও বন্ধ ব্যালেন্স" }, keywords: "cash flow balance" },
  { id: "emiCalc",      category: "finance", icon: "Landmark", accent: "blue", kind: "calculator", props: { id: "emi" },
    title: { en: "Loan EMI calculator", hi: "ऋण EMI कैलकुलेटर", bn: "ঋণ EMI ক্যালকুলেটর" }, desc: { en: "Monthly instalment estimate", hi: "मासिक किस्त अनुमान", bn: "মাসিক কিস্তি অনুমান" }, keywords: "emi loan interest instalment" },
  { id: "profitCalc",   category: "finance", icon: "TrendingUp", accent: "primary", kind: "calculator", props: { id: "profit" },
    title: { en: "Profit calculator", hi: "मुनाफा कैलकुलेटर", bn: "মুনাফা ক্যালকুলেটর" }, desc: { en: "Revenue, cost, margin & per-acre", hi: "आय, लागत, मार्जिन, प्रति एकड़", bn: "আয়, খরচ, মার্জিন, একর প্রতি" }, keywords: "profit margin revenue cost" },

  /* ── Marketplace ── */
  { id: "market",       category: "marketplace", icon: "ShoppingBag", accent: "primary", kind: "marketplace",
    title: { en: "Agri marketplace", hi: "कृषि बाज़ार", bn: "কৃষি বাজার" }, desc: { en: "Buy & sell farm produce & supplies", hi: "उपज व सामान खरीदें-बेचें", bn: "ফসল ও সামগ্রী কেনাবেচা" }, keywords: "marketplace buy sell produce seed feed fertilizer equipment livestock" },
  { id: "myOrders",     category: "marketplace", icon: "ClipboardCheck", accent: "blue", kind: "mpOrders",
    title: { en: "My orders", hi: "मेरे ऑर्डर", bn: "আমার অর্ডার" }, desc: { en: "Track your purchases", hi: "अपनी खरीद ट्रैक करें", bn: "আপনার কেনাকাটা ট্র্যাক" }, keywords: "order purchase track" },
  { id: "wishlist",     category: "marketplace", icon: "Heart", accent: "red", kind: "mpWishlist",
    title: { en: "Wishlist", hi: "विशलिस्ट", bn: "উইশলিস্ট" }, desc: { en: "Saved products", hi: "सहेजे उत्पाद", bn: "সংরক্ষিত পণ্য" }, keywords: "wishlist saved favorite" },
  { id: "sell",         category: "marketplace", icon: "Store", accent: "primary", kind: "mpSeller",
    title: { en: "Sell products", hi: "उत्पाद बेचें", bn: "পণ্য বিক্রি" }, desc: { en: "Your seller dashboard", hi: "आपका विक्रेता डैशबोर्ड", bn: "আপনার বিক্রেতা ড্যাশবোর্ড" }, keywords: "sell seller listing store" },

  /* ── Logistics ── */
  { id: "logistics",    category: "logistics", icon: "Truck", accent: "yellow", kind: "logisticsHub",
    title: { en: "Logistics", hi: "परिवहन", bn: "পরিবহন" }, desc: { en: "Transport, delivery & tracking", hi: "परिवहन, डिलीवरी, ट्रैकिंग", bn: "পরিবহন, ডেলিভারি, ট্র্যাকিং" }, keywords: "logistics transport delivery pickup shipment vehicle driver" },
  { id: "shipments",    category: "logistics", icon: "Package2", accent: "orange", kind: "logShipments",
    title: { en: "Shipments", hi: "शिपमेंट", bn: "শিপমেন্ট" }, desc: { en: "Track shipments & delivery status", hi: "शिपमेंट व डिलीवरी स्थिति", bn: "শিপমেন্ট ও ডেলিভারি স্ট্যাটাস" }, keywords: "shipment tracking delivery" },
  { id: "fleet",        category: "logistics", icon: "Truck", accent: "blue", kind: "logFleet",
    title: { en: "Fleet", hi: "बेड़ा", bn: "বহর" }, desc: { en: "Vehicles & drivers", hi: "वाहन व चालक", bn: "যান ও চালক" }, keywords: "fleet vehicle driver transport" },
  { id: "warehouse",    category: "logistics", icon: "Warehouse", accent: "orange", kind: "logWarehouse",
    title: { en: "Warehouse", hi: "गोदाम", bn: "গুদাম" }, desc: { en: "Storage bookings", hi: "भंडारण बुकिंग", bn: "সংরক্ষণ বুকিং" }, keywords: "warehouse storage cold" },
  { id: "contracts",    category: "logistics", icon: "FileSignature", accent: "primary", kind: "logContracts",
    title: { en: "Contracts", hi: "अनुबंध", bn: "চুক্তি" }, desc: { en: "Buyer & supply contracts", hi: "खरीदार व आपूर्ति अनुबंध", bn: "ক্রেতা ও সরবরাহ চুক্তি" }, keywords: "contract agreement buyer supply" },
  { id: "auctions",     category: "logistics", icon: "Gavel", accent: "red", kind: "logAuctions",
    title: { en: "Auctions", hi: "नीलामी", bn: "নিলাম" }, desc: { en: "Bid & sell at auction", hi: "नीलामी में बोली व बिक्री", bn: "নিলামে দর ও বিক্রি" }, keywords: "auction bid" },
  { id: "export",       category: "logistics", icon: "Container", accent: "blue", kind: "logExport",
    title: { en: "Export", hi: "निर्यात", bn: "রপ্তানি" }, desc: { en: "Export orders", hi: "निर्यात ऑर्डर", bn: "রপ্তানি অর্ডার" }, keywords: "export international" },

  /* ── Professional services ── */
  { id: "svcHub",       category: "professional", icon: "Handshake", accent: "primary", kind: "svcMarketplace",
    title: { en: "Service marketplace", hi: "सेवा बाज़ार", bn: "সেবা বাজার" }, desc: { en: "Book farm service providers", hi: "फार्म सेवा प्रदाता बुक करें", bn: "খামার সেবা প্রদানকারী বুক" }, keywords: "service provider book agronomist consultant machinery rental" },
  { id: "myBookings",   category: "professional", icon: "CalendarCheck", accent: "blue", kind: "svcMyBookings",
    title: { en: "My bookings", hi: "मेरी बुकिंग", bn: "আমার বুকিং" }, desc: { en: "Your service bookings", hi: "आपकी सेवा बुकिंग", bn: "আপনার সেবা বুকিং" }, keywords: "booking appointment service" },
  { id: "providerDash", category: "professional", icon: "Briefcase", accent: "primary", kind: "svcProviderDash",
    title: { en: "Provider dashboard", hi: "प्रदाता डैशबोर्ड", bn: "প্রদানকারী ড্যাশবোর্ড" }, desc: { en: "For service providers", hi: "सेवा प्रदाताओं के लिए", bn: "সেবা প্রদানকারীদের জন্য" }, keywords: "provider dashboard service" },
  { id: "soil",         category: "professional", icon: "FlaskConical", accent: "orange", kind: "svcMarketplace", props: { category: "soilTest" },
    title: { en: "Soil testing", hi: "मिट्टी जाँच", bn: "মাটি পরীক্ষা" }, desc: { en: "Labs & at-home kits", hi: "लैब व होम किट", bn: "ল্যাব ও বাড়ির কিট" }, keywords: "soil test lab health nutrient" },
  { id: "drone",        category: "professional", icon: "Send", accent: "blue", kind: "svcMarketplace", props: { category: "drone" },
    title: { en: "Drone services", hi: "ड्रोन सेवा", bn: "ড্রোন সেবা" }, desc: { en: "Spraying & mapping", hi: "स्प्रे व मैपिंग", bn: "স্প্রে ও ম্যাপিং" }, keywords: "drone spray mapping" },
  { id: "training",     category: "professional", icon: "GraduationCap", accent: "yellow", kind: "svcMarketplace", props: { category: "training" },
    title: { en: "Training centre", hi: "प्रशिक्षण केंद्र", bn: "প্রশিক্ষণ কেন্দ্র" }, desc: { en: "KVK & skill programs", hi: "KVK व कौशल कार्यक्रम", bn: "KVK ও দক্ষতা কর্মসূচি" }, keywords: "training kvk skill education" },
  { id: "insurance",    category: "professional", icon: "ShieldCheck", accent: "primary", kind: "svcMarketplace", props: { category: "insurance" },
    title: { en: "Insurance", hi: "बीमा", bn: "বীমা" }, desc: { en: "Crop & livestock cover", hi: "फसल व पशु कवर", bn: "ফসল ও পশু কভার" }, keywords: "insurance cover crop livestock claim" },

  /* ── AI & smart farm ── */
  { id: "aiAdvisor",    category: "ai", icon: "Bot", accent: "blue", kind: "chat", badge: "ai",
    title: { en: "AI farm advisor", hi: "AI कृषि सलाहकार", bn: "AI কৃষি উপদেষ্টা" }, desc: { en: "Chat about crops, animals & more", hi: "फसल, पशु आदि पर चैट", bn: "ফসল, পশু ইত্যাদি নিয়ে চ্যাট" }, keywords: "ai advisor chat assistant voice" },
  { id: "insights",     category: "ai", icon: "Sparkles", accent: "blue", kind: "erpInsights", badge: "ai",
    title: { en: "AI insights", hi: "AI अंतर्दृष्टि", bn: "AI অন্তর্দৃষ্টি" }, desc: { en: "Smart alerts & recommendations", hi: "स्मार्ट अलर्ट व सिफ़ारिशें", bn: "স্মার্ট সতর্কতা ও সুপারিশ" }, keywords: "ai insight recommendation alert farm health score" },
  { id: "aiCommerce",   category: "ai", icon: "BrainCircuit", accent: "primary", kind: "aiCommerceHub", badge: "ai",
    title: { en: "AI commerce", hi: "AI कॉमर्स", bn: "AI কমার্স" }, desc: { en: "Price, demand & market intelligence", hi: "मूल्य, माँग, बाज़ार बुद्धि", bn: "দাম, চাহিদা, বাজার বুদ্ধি" }, keywords: "ai commerce price demand forecast market intelligence recommendation" },
  { id: "mlops",        category: "ai", icon: "Cpu", accent: "blue", kind: "mlopsHub", badge: "ai",
    title: { en: "MLOps", hi: "MLOps", bn: "MLOps" }, desc: { en: "Datasets, models & training", hi: "डेटासेट, मॉडल, प्रशिक्षण", bn: "ডেটাসেট, মডেল, প্রশিক্ষণ" }, keywords: "mlops model dataset training annotation" },

  /* ── Government & schemes ── */
  { id: "schemes",      category: "government", icon: "Landmark", accent: "primary", kind: "schemeExplorer",
    title: { en: "Government schemes", hi: "सरकारी योजनाएँ", bn: "সরকারি স্কিম" }, desc: { en: "Subsidies, loans & benefits", hi: "सब्सिडी, ऋण, लाभ", bn: "ভর্তুকি, ঋণ, সুবিধা" }, keywords: "government scheme subsidy loan insurance benefit eligibility" },
  { id: "mandi",        category: "government", icon: "Store", accent: "orange", kind: "mandiPrices",
    title: { en: "Mandi prices", hi: "मंडी भाव", bn: "মান্ডি দর" }, desc: { en: "MSP & crop prices", hi: "MSP व फसल भाव", bn: "MSP ও ফসলের দর" }, keywords: "mandi price msp market rate crop" },
  { id: "nearby",       category: "government", icon: "MapPin", accent: "blue", kind: "nearby",
    title: { en: "Nearby offices", hi: "पास के कार्यालय", bn: "কাছের দপ্তর" }, desc: { en: "Banks, govt offices & more", hi: "बैंक, सरकारी दफ़्तर", bn: "ব্যাংক, সরকারি দপ্তর" }, keywords: "nearby bank government office location" },

  /* ── Documents ── */
  { id: "farmDocs",     category: "documents", icon: "FileText", accent: "blue", kind: "documents",
    title: { en: "Farm documents", hi: "फार्म दस्तावेज़", bn: "খামার নথি" }, desc: { en: "Land, KCC, insurance & more", hi: "ज़मीन, KCC, बीमा", bn: "জমি, KCC, বীমা" }, keywords: "document land kcc insurance certificate licence permit" },

  /* ── Reports & analytics ── */
  { id: "reports",      category: "reports", icon: "FileText", accent: "orange", kind: "erpReports",
    title: { en: "Farm reports", hi: "फार्म रिपोर्ट", bn: "খামার রিপোর্ট" }, desc: { en: "Financial, production & inventory", hi: "वित्त, उत्पादन, इन्वेंटरी", bn: "অর্থ, উৎপাদন, ইনভেন্টরি" }, keywords: "report csv pdf financial production inventory livestock" },
  { id: "analytics",    category: "reports", icon: "PieChart", accent: "primary", kind: "erpAnalytics",
    title: { en: "Farm analytics", hi: "फार्म विश्लेषण", bn: "খামার বিশ্লেষণ" }, desc: { en: "KPIs, cost & break-even", hi: "KPI, लागत, ब्रेक-ईवन", bn: "KPI, খরচ, ব্রেক-ইভেন" }, keywords: "analytics kpi cost break-even performance" },
  { id: "feedReports",  category: "reports", icon: "FileText", accent: "blue", kind: "feedReports",
    title: { en: "Feed reports", hi: "चारा रिपोर्ट", bn: "খাদ্য রিপোর্ট" }, desc: { en: "Cost, FCR, wastage & supplier", hi: "लागत, FCR, बर्बादी, आपूर्तिकर्ता", bn: "খরচ, FCR, অপচয়, সরবরাহকারী" }, keywords: "feed report fcr wastage cost supplier" },

  /* ── Settings & admin ── */
  { id: "settings",     category: "settings", icon: "Settings", accent: "blue", kind: "settings",
    title: { en: "Settings", hi: "सेटिंग्स", bn: "সেটিংস" }, desc: { en: "App preferences", hi: "ऐप प्राथमिकताएँ", bn: "অ্যাপ পছন্দ" }, keywords: "settings preferences" },
  { id: "personalize",  category: "settings", icon: "SlidersHorizontal", accent: "primary", kind: "personalize",
    title: { en: "Personalize", hi: "अनुकूलित करें", bn: "ব্যক্তিগতকরণ" }, desc: { en: "Theme, layout & dashboard", hi: "थीम, लेआउट, डैशबोर्ड", bn: "থিম, লেআউট, ড্যাশবোর্ড" }, keywords: "personalize theme dark layout dashboard widget" },
  { id: "subscription", category: "settings", icon: "Crown", accent: "yellow", kind: "subscription",
    title: { en: "Subscription", hi: "सदस्यता", bn: "সাবস্ক্রিপশন" }, desc: { en: "Your plan & billing", hi: "आपकी योजना व बिलिंग", bn: "আপনার প্ল্যান ও বিলিং" }, keywords: "subscription plan premium billing" },
  { id: "payments",     category: "settings", icon: "CreditCard", accent: "blue", kind: "payments",
    title: { en: "Payments", hi: "भुगतान", bn: "পেমেন্ট" }, desc: { en: "Payment methods & history", hi: "भुगतान तरीके व इतिहास", bn: "পেমেন্ট পদ্ধতি ও ইতিহাস" }, keywords: "payment upi card billing" },
  { id: "security",     category: "settings", icon: "Lock", accent: "primary", kind: "security",
    title: { en: "Security", hi: "सुरक्षा", bn: "নিরাপত্তা" }, desc: { en: "Account security", hi: "खाता सुरक्षा", bn: "অ্যাকাউন্ট নিরাপত্তা" }, keywords: "security password login" },
  { id: "permissions",  category: "settings", icon: "ShieldCheck", accent: "blue", kind: "permissions",
    title: { en: "Permissions", hi: "अनुमतियाँ", bn: "অনুমতি" }, desc: { en: "App permissions", hi: "ऐप अनुमतियाँ", bn: "অ্যাপ অনুমতি" }, keywords: "permission access camera location" },
  { id: "apiKeys",      category: "settings", icon: "Cpu", accent: "blue", kind: "apiKeyManager",
    title: { en: "AI API keys", hi: "AI API कुंजियाँ", bn: "AI API কী" }, desc: { en: "Manage AI provider keys", hi: "AI प्रदाता कुंजियाँ प्रबंधित करें", bn: "AI প্রদানকারী কী পরিচালনা" }, keywords: "api key ai provider anthropic" },
  { id: "storage",      category: "settings", icon: "HardDrive", accent: "orange", kind: "storage",
    title: { en: "Storage", hi: "स्टोरेज", bn: "স্টোরেজ" }, desc: { en: "Local data & cache", hi: "स्थानीय डेटा व कैश", bn: "স্থানীয় ডেটা ও ক্যাশ" }, keywords: "storage cache data offline" },
  { id: "about",        category: "settings", icon: "Info", accent: "blue", kind: "about",
    title: { en: "About", hi: "बारे में", bn: "সম্পর্কে" }, desc: { en: "App info & version", hi: "ऐप जानकारी व संस्करण", bn: "অ্যাপ তথ্য ও সংস্করণ" }, keywords: "about version help info" },
];

export function serviceById(id) {
  return SERVICE_REGISTRY.find((s) => s.id === id) || null;
}

export function servicesByCategory(categoryId) {
  return SERVICE_REGISTRY.filter((s) => s.category === categoryId);
}
