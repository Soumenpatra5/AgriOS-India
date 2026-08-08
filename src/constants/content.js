/* Static demo content — all text fields are {en, hi, bn} objects.
   Components use tc(field) to pick the current language. */

export const ENTERPRISES = [
  { id: "crop", label: { en: "Crop", hi: "फसल", bn: "ফসল" }, icon: "Wheat" },
  { id: "dairy", label: { en: "Dairy", hi: "डेयरी", bn: "দুগ্ধ" }, icon: "Milk" },
  { id: "poultry", label: { en: "Poultry", hi: "मुर्गीपालन", bn: "মুরগি পালন" }, icon: "Bird" },
  { id: "goat", label: { en: "Goat", hi: "बकरी", bn: "ছাগল" }, icon: "Rabbit" },
  { id: "pig", label: { en: "Pig", hi: "सूअर", bn: "শূকর" }, icon: "PiggyBank" },
  { id: "fish", label: { en: "Fish", hi: "मछली", bn: "মাছ" }, icon: "Fish" },
  { id: "bee", label: { en: "Bee keeping", hi: "मधुमक्खी पालन", bn: "মৌমাছি পালন" }, icon: "Bug" },
  { id: "horti", label: { en: "Horticulture", hi: "बागवानी", bn: "উদ্যানপালন" }, icon: "Sprout" },
];

export const ONBOARDING = [
  { icon: "Sprout", accent: "primary",
    title: { en: "Your whole farm, one app", hi: "आपका पूरा खेत, एक ऐप", bn: "আপনার পুরো খামার, একটি অ্যাপ" },
    body: { en: "Crops, dairy, poultry, fish and more — track every enterprise from a single, beautifully simple place.",
      hi: "फसल, डेयरी, मुर्गी, मछली और अधिक — एक सरल ऐप से सब ट्रैक करें।",
      bn: "ফসল, দুগ্ধ, মুরগি, মাছ ও আরও — একটি সহজ অ্যাপ থেকে সব দেখুন।" } },
  { icon: "Bot", accent: "blue",
    title: { en: "An AI team for your farm", hi: "आपके खेत के लिए AI टीम", bn: "আপনার খামারের জন্য AI দল" },
    body: { en: "A doctor, an accountant, an advisor and more — intelligent help that understands Indian farming.",
      hi: "डॉक्टर, अकाउंटेंट, सलाहकार और अधिक — भारतीय खेती समझने वाली स्मार्ट मदद।",
      bn: "ডাক্তার, হিসাবরক্ষক, পরামর্শদাতা ও আরও — ভারতীয় চাষ বোঝে এমন স্মার্ট সাহায্য।" } },
  { icon: "TrendingUp", accent: "orange",
    title: { en: "Grow it like a business", hi: "व्यापार की तरह खेती बढ़ाएँ", bn: "ব্যবসার মতো চাষ বাড়ান" },
    body: { en: "Market prices, government schemes, accounts and services — the tools to earn more, all in your language.",
      hi: "बाज़ार भाव, सरकारी योजनाएँ, हिसाब और सेवाएँ — ज़्यादा कमाने के लिए सारे टूल, आपकी भाषा में।",
      bn: "বাজার দর, সরকারি প্রকল্প, হিসাব ও সেবা — বেশি আয়ের সব সরঞ্জাম, আপনার ভাষায়।" } },
];

export const AI_TOOLS = [
  { id: "doctor", agentId: "farmDoctor", title: { en: "AI Doctor", hi: "AI डॉक्टर", bn: "AI ডাক্তার" }, desc: { en: "Diagnose crop & animal illness", hi: "फसल और पशु रोग पहचानें", bn: "ফসল ও পশুর রোগ চিহ্নিত করুন" }, icon: "Stethoscope", accent: "red" },
  { id: "advisor", agentId: "cropExpert", title: { en: "AI Crop Advisor", hi: "AI फसल सलाहकार", bn: "AI ফসল পরামর্শদাতা" }, desc: { en: "Sowing to harvest, step by step", hi: "बुवाई से कटाई, कदम दर कदम", bn: "বপন থেকে ফসল কাটা, ধাপে ধাপে" }, icon: "Sprout", accent: "primary" },
  { id: "livestock", agentId: "livestockExpert", title: { en: "AI Livestock Expert", hi: "AI पशुपालन विशेषज्ञ", bn: "AI পশুপালন বিশেষজ্ঞ" }, desc: { en: "Poultry, goat, dairy, fish & more", hi: "मुर्गी, बकरी, डेयरी, मछली और अधिक", bn: "মুরগি, ছাগল, দুগ্ধ, মাছ ও আরও" }, icon: "Rabbit", accent: "orange" },
  { id: "vet", agentId: "veterinaryExpert", title: { en: "AI Vet Advisor", hi: "AI पशु चिकित्सक", bn: "AI পশু চিকিৎসক" }, desc: { en: "Animal health, vaccines & first aid", hi: "पशु स्वास्थ्य, टीका और प्राथमिक उपचार", bn: "পশু স্বাস্থ্য, টিকা ও প্রাথমিক চিকিৎসা" }, icon: "ShieldCheck", accent: "red" },
  { id: "accountant", agentId: "financeExpert", title: { en: "AI Finance Expert", hi: "AI वित्त विशेषज्ञ", bn: "AI অর্থ বিশেষজ্ঞ" }, desc: { en: "Accounts, profit, tax & insurance", hi: "हिसाब, मुनाफा, कर और बीमा", bn: "হিসাব, মুনাফা, কর ও বীমা" }, icon: "Calculator", accent: "blue" },
  { id: "loan", agentId: "loanAdvisor", title: { en: "AI Loan Advisor", hi: "AI ऋण सलाहकार", bn: "AI ঋণ পরামর্শদাতা" }, desc: { en: "Eligibility, EMI & documents", hi: "पात्रता, EMI और दस्तावेज़", bn: "যোগ্যতা, EMI ও নথি" }, icon: "Landmark", accent: "yellow" },
  { id: "schemes", agentId: "governmentAdvisor", title: { en: "AI Scheme Advisor", hi: "AI योजना सलाहकार", bn: "AI প্রকল্প পরামর্শদাতা" }, desc: { en: "Government schemes you qualify for", hi: "आपकी पात्र सरकारी योजनाएँ", bn: "আপনার যোগ্য সরকারি প্রকল্প" }, icon: "Building2", accent: "primary" },
  { id: "weather", agentId: "weatherExpert", title: { en: "AI Weather", hi: "AI मौसम", bn: "AI আবহাওয়া" }, desc: { en: "Spray windows & field-work timing", hi: "स्प्रे का समय और खेत के काम", bn: "স্প্রে-র সময় ও মাঠের কাজ" }, icon: "CloudSun", accent: "blue" },
  { id: "market", agentId: "marketExpert", title: { en: "AI Market", hi: "AI बाज़ार", bn: "AI বাজার" }, desc: { en: "Best time & mandi to sell", hi: "बेचने का सबसे अच्छा समय और मंडी", bn: "বিক্রির সেরা সময় ও মান্ডি" }, icon: "LineChart", accent: "orange" },
  { id: "dpr", agentId: "dprGenerator", title: { en: "AI DPR Generator", hi: "AI DPR जनरेटर", bn: "AI DPR জেনারেটর" }, desc: { en: "Bank-format project reports", hi: "बैंक-प्रारूप प्रोजेक्ट रिपोर्ट", bn: "ব্যাংক-ফরম্যাট প্রকল্প রিপোর্ট" }, icon: "FileText", accent: "yellow" },
  { id: "business", agentId: "businessAdvisor", title: { en: "AI Business Advisor", hi: "AI व्यापार सलाहकार", bn: "AI ব্যবসা পরামর্শদাতা" }, desc: { en: "Growth, marketing & legal basics", hi: "विस्तार, मार्केटिंग और कानूनी बातें", bn: "সম্প্রসারণ, মার্কেটিং ও আইনি বিষয়" }, icon: "Briefcase", accent: "blue" },
  { id: "learn", agentId: "educationExpert", title: { en: "AI Learning Guide", hi: "AI शिक्षण गाइड", bn: "AI শিক্ষা গাইড" }, desc: { en: "Learn new farming skills", hi: "नई खेती कौशल सीखें", bn: "নতুন চাষের দক্ষতা শিখুন" }, icon: "GraduationCap", accent: "yellow" },
  { id: "chat", agentId: null, title: { en: "AI Chat", hi: "AI चैट", bn: "AI চ্যাট" }, desc: { en: "Ask anything — auto-routes to the right expert", hi: "कुछ भी पूछें — सही विशेषज्ञ जवाब देगा", bn: "যা খুশি জিজ্ঞেস করুন — সঠিক বিশেষজ্ঞ উত্তর দেবেন" }, icon: "MessageCircle", accent: "primary" },
];

export const QUICK_ACTIONS = [
  { id: "doctor", title: { en: "AI Doctor", hi: "AI डॉक्टर", bn: "AI ডাক্তার" }, icon: "Stethoscope", accent: "red" },
  { id: "advisor", title: { en: "Advisor", hi: "सलाहकार", bn: "পরামর্শ" }, icon: "Sprout", accent: "primary" },
  { id: "market", title: { en: "Sell", hi: "बेचें", bn: "বিক্রি" }, icon: "LineChart", accent: "orange" },
  { id: "chat", title: { en: "Ask AI", hi: "AI पूछें", bn: "AI জিজ্ঞেস" }, icon: "MessageCircle", accent: "blue" },
];

export const TASKS = [
  { id: 1, text: { en: "Irrigate the north paddy plot", hi: "उत्तर धान के खेत में सिंचाई करें", bn: "উত্তরের ধান ক্ষেতে সেচ দিন" }, tag: { en: "Crop", hi: "फसल", bn: "ফসল" }, done: false },
  { id: 2, text: { en: "Vaccinate new poultry batch", hi: "नए मुर्गी बैच को टीका दें", bn: "নতুন মুরগির ব্যাচে টিকা দিন" }, tag: { en: "Poultry", hi: "मुर्गी", bn: "মুরগি" }, done: false },
  { id: 3, text: { en: "Record yesterday's milk sale", hi: "कल की दूध बिक्री दर्ज करें", bn: "গতকালের দুধ বিক্রি লিখুন" }, tag: { en: "Dairy", hi: "डेयरी", bn: "দুগ্ধ" }, done: true },
];

export const SCHEMES = [
  { id: 1, title: "PM-KISAN", tag: { en: "Income support", hi: "आय सहायता", bn: "আয় সহায়তা" }, note: { en: "₹6,000/year direct benefit", hi: "₹6,000/वर्ष सीधा लाभ", bn: "₹৬,০০০/বছর সরাসরি সুবিধা" }, accent: "primary" },
  { id: 2, title: "Kisan Credit Card", tag: { en: "Credit", hi: "ऋण", bn: "ঋণ" }, note: { en: "Low-interest crop loans", hi: "कम ब्याज पर फसल ऋण", bn: "কম সুদে ফসল ঋণ" }, accent: "blue" },
  { id: 3, title: "PMFBY", tag: { en: "Insurance", hi: "बीमा", bn: "বীমা" }, note: { en: "Crop insurance cover", hi: "फसल बीमा कवर", bn: "ফসল বীমা কভার" }, accent: "orange" },
];

export const PRICES = [
  { id: 1, crop: { en: "Paddy", hi: "धान", bn: "ধান" }, mandi: { en: "Barasat", hi: "बारासात", bn: "বারাসাত" }, price: 2203, unit: { en: "qtl", hi: "क्विंटल", bn: "কুইন্টাল" }, up: true, change: 1.8 },
  { id: 2, crop: { en: "Potato", hi: "आलू", bn: "আলু" }, mandi: { en: "Hooghly", hi: "हुगली", bn: "হুগলি" }, price: 1450, unit: { en: "qtl", hi: "क्विंटल", bn: "কুইন্টাল" }, up: false, change: 2.4 },
  { id: 3, crop: { en: "Mustard", hi: "सरसों", bn: "সরিষা" }, mandi: { en: "Nadia", hi: "नदिया", bn: "নদিয়া" }, price: 5600, unit: { en: "qtl", hi: "क्विंटल", bn: "কুইন্টাল" }, up: true, change: 0.9 },
  { id: 4, crop: { en: "Milk", hi: "दूध", bn: "দুধ" }, mandi: { en: "Local", hi: "स्थानीय", bn: "স্থানীয়" }, price: 42, unit: { en: "L", hi: "लीटर", bn: "লিটার" }, up: true, change: 0.5 },
];

export const NEWS = [
  { id: 1, tag: { en: "Weather", hi: "मौसम", bn: "আবহাওয়া" }, title: { en: "Light rain expected across Gangetic West Bengal this week", hi: "इस सप्ताह गंगा तटीय पश्चिम बंगाल में हल्की बारिश की संभावना", bn: "এই সপ্তাহে গাঙ্গেয় পশ্চিমবঙ্গে হালকা বৃষ্টির সম্ভাবনা" }, time: { en: "2h ago", hi: "2 घंटे पहले", bn: "২ ঘণ্টা আগে" } },
  { id: 2, tag: { en: "Policy", hi: "नीति", bn: "নীতি" }, title: { en: "New MSP rates announced for kharif crops", hi: "खरीफ फसलों के लिए नए MSP दर घोषित", bn: "খারিফ ফসলের জন্য নতুন MSP ঘোষণা" }, time: { en: "1d ago", hi: "1 दिन पहले", bn: "১ দিন আগে" } },
  { id: 3, tag: { en: "Advisory", hi: "सलाह", bn: "পরামর্শ" }, title: { en: "Watch for stem borer in transplanted paddy", hi: "रोपित धान में तना छेदक पर नज़र रखें", bn: "রোপণ করা ধানে মাজরা পোকার দিকে নজর রাখুন" }, time: { en: "2d ago", hi: "2 दिन पहले", bn: "২ দিন আগে" } },
];

export const CALCULATORS = [
  { id: "emi", title: { en: "Loan EMI", hi: "ऋण EMI", bn: "ঋণ EMI" }, icon: "Landmark", accent: "blue" },
  { id: "profit", title: { en: "Profit", hi: "मुनाफा", bn: "মুনাফা" }, icon: "TrendingUp", accent: "primary" },
  { id: "feed", title: { en: "Feed cost", hi: "चारा खर्च", bn: "খাদ্য খরচ" }, icon: "Package", accent: "orange" },
  { id: "seed", title: { en: "Seed rate", hi: "बीज दर", bn: "বীজ হার" }, icon: "Sprout", accent: "yellow" },
  { id: "fert", title: { en: "Fertilizer", hi: "खाद", bn: "সার" }, icon: "Leaf", accent: "primary" },
  { id: "yield", title: { en: "Yield", hi: "उपज", bn: "ফলন" }, icon: "BarChart3", accent: "red" },
];

export const CATEGORIES = [
  { id: "crop", title: { en: "Crops", hi: "फसलें", bn: "ফসল" }, icon: "Wheat", accent: "primary" },
  { id: "dairy", title: { en: "Dairy", hi: "डेयरी", bn: "দুগ্ধ" }, icon: "Milk", accent: "blue" },
  { id: "poultry", title: { en: "Poultry", hi: "मुर्गी", bn: "মুরগি" }, icon: "Bird", accent: "orange" },
  { id: "goat", title: { en: "Goat", hi: "बकरी", bn: "ছাগল" }, icon: "Rabbit", accent: "yellow" },
  { id: "fish", title: { en: "Fish", hi: "मछली", bn: "মাছ" }, icon: "Fish", accent: "blue" },
  { id: "horti", title: { en: "Horticulture", hi: "बागवानी", bn: "উদ্যানপালন" }, icon: "Sprout", accent: "primary" },
];

export const FEATURED = [
  { id: "vet", title: { en: "Veterinary at home", hi: "घर पर पशु चिकित्सा", bn: "বাড়িতে পশু চিকিৎসা" }, desc: { en: "Book a vet visit", hi: "पशु चिकित्सक को बुलाएँ", bn: "পশু চিকিৎসক ডাকুন" }, icon: "Stethoscope", accent: "red" },
  { id: "soil", title: { en: "Soil testing", hi: "मिट्टी जाँच", bn: "মাটি পরীক্ষা" }, desc: { en: "Know your soil health", hi: "अपनी मिट्टी की सेहत जानें", bn: "আপনার মাটির স্বাস্থ্য জানুন" }, icon: "FlaskConical", accent: "orange" },
  { id: "drone", title: { en: "Drone spraying", hi: "ड्रोन स्प्रे", bn: "ড্রোন স্প্রে" }, desc: { en: "Fast, even coverage", hi: "तेज़, समान कवरेज", bn: "দ্রুত, সমান কভারেজ" }, icon: "Send", accent: "blue" },
];

export const MARKET_SECTIONS = [
  { id: "prices", title: { en: "Today's prices", hi: "आज का भाव", bn: "আজকের দর" }, icon: "LineChart", accent: "primary" },
  { id: "buyers", title: { en: "Nearby buyers", hi: "पास के खरीदार", bn: "কাছের ক্রেতা" }, icon: "Users", accent: "blue" },
  { id: "sellers", title: { en: "Nearby sellers", hi: "पास के विक्रेता", bn: "কাছের বিক্রেতা" }, icon: "Store", accent: "orange" },
  { id: "marketplace", title: { en: "Marketplace", hi: "बाज़ार", bn: "বাজার" }, icon: "ShoppingBag", accent: "primary" },
  { id: "equipment", title: { en: "Equipment", hi: "उपकरण", bn: "সরঞ্জাম" }, icon: "Tractor", accent: "yellow" },
  { id: "seeds", title: { en: "Seeds", hi: "बीज", bn: "বীজ" }, icon: "Sprout", accent: "primary" },
  { id: "feed", title: { en: "Feed", hi: "चारा", bn: "খাদ্য" }, icon: "Package", accent: "orange" },
  { id: "medicine", title: { en: "Medicine", hi: "दवाई", bn: "ওষুধ" }, icon: "Pill", accent: "red" },
];

export const SERVICES = [
  { id: "livestock", title: { en: "Livestock Manager", hi: "पशुपालन प्रबंधक", bn: "পশুপালন ম্যানেজার" }, desc: { en: "Poultry, dairy, goat, pig, sheep, fish & bees", hi: "मुर्गी, डेयरी, बकरी, सूअर, भेड़, मछली", bn: "মুরগি, দুগ্ধ, ছাগল, শূকর, ভেড়া, মাছ" }, icon: "Rabbit", accent: "primary", kind: "livestockHub" },
  { id: "vax", title: { en: "Vaccination Calendar", hi: "टीकाकरण कैलेंडर", bn: "টিকাকরণ ক্যালেন্ডার" }, desc: { en: "Upcoming & missed vaccinations", hi: "आने वाले और छूटे टीके", bn: "আসন্ন ও বাকি টিকা" }, icon: "Syringe", accent: "red", kind: "vaccinationCalendar" },
  { id: "inventory", title: { en: "Inventory", hi: "इन्वेंटरी", bn: "ইনভেন্টরি" }, desc: { en: "Feed, medicine & stock alerts", hi: "चारा, दवाई और स्टॉक अलर्ट", bn: "খাদ্য, ওষুধ ও স্টক সতর্কতা" }, icon: "Warehouse", accent: "orange", kind: "erpInventory" },
  { id: "tasks", title: { en: "Task Manager", hi: "कार्य प्रबंधक", bn: "কাজ ম্যানেজার" }, desc: { en: "Daily work & reminders", hi: "दैनिक काम और रिमाइंडर", bn: "দৈনিক কাজ ও রিমাইন্ডার" }, icon: "ListChecks", accent: "blue", kind: "erpTasks" },
  { id: "business", title: { en: "Farm Business", hi: "खेत व्यापार", bn: "খামার ব্যবসা" }, desc: { en: "P&L, cash flow & profit analysis", hi: "लाभ-हानि, नगद प्रवाह और मुनाफा विश्लेषण", bn: "লাভ-ক্ষতি, নগদ প্রবাহ ও মুনাফা বিশ্লেষণ" }, icon: "BarChart3", accent: "blue", kind: "businessDashboard" },
  { id: "erp", title: { en: "Farm Management", hi: "फार्म प्रबंधन", bn: "ফার্ম ব্যবস্থাপনা" }, desc: { en: "Farms, land, assets, team, CRM & more", hi: "फार्म, ज़मीन, संपत्ति, टीम, CRM और अधिक", bn: "খামার, জমি, সম্পদ, টিম, CRM ও আরও" }, icon: "LayoutGrid", accent: "primary", kind: "farmErp" },
  { id: "ledger", title: { en: "Farm Ledger", hi: "खेत का खाता", bn: "খামারের খাতা" }, desc: { en: "Income & expense tracking", hi: "आय और ख़र्च ट्रैकिंग", bn: "আয় ও খরচ হিসাব" }, icon: "BookOpen", accent: "primary", kind: "farmLedger" },
  { id: "calendar", title: { en: "Crop Calendar", hi: "फसल कैलेंडर", bn: "ফসল ক্যালেন্ডার" }, desc: { en: "Season tasks & reminders", hi: "मौसमी काम और रिमाइंडर", bn: "মৌসুমি কাজ ও রিমাইন্ডার" }, icon: "CalendarDays", accent: "primary", kind: "cropCalendar" },
  { id: "vet", title: { en: "Veterinary", hi: "पशु चिकित्सा", bn: "পশু চিকিৎসা" }, desc: { en: "Doctors & clinics near you", hi: "आपके पास डॉक्टर और क्लिनिक", bn: "আপনার কাছে ডাক্তার ও ক্লিনিক" }, icon: "Stethoscope", accent: "red", kind: "svcMarketplace", props: { category: "vet" } },
  { id: "soil", title: { en: "Soil testing", hi: "मिट्टी जाँच", bn: "মাটি পরীক্ষা" }, desc: { en: "Labs & at-home kits", hi: "लैब और होम किट", bn: "ল্যাব ও বাড়ির কিট" }, icon: "FlaskConical", accent: "orange", kind: "svcMarketplace", props: { category: "soilTest" } },
  { id: "drone", title: { en: "Drone services", hi: "ड्रोन सेवा", bn: "ড্রোন সেবা" }, desc: { en: "Spraying & mapping", hi: "स्प्रे और मैपिंग", bn: "স্প্রে ও ম্যাপিং" }, icon: "Send", accent: "blue", kind: "svcMarketplace", props: { category: "drone" } },
  { id: "govt", title: { en: "Government office", hi: "सरकारी कार्यालय", bn: "সরকারি দপ্তর" }, desc: { en: "Find your local office", hi: "स्थानीय कार्यालय खोजें", bn: "স্থানীয় দপ্তর খুঁজুন" }, icon: "Landmark", accent: "primary" },
  { id: "training", title: { en: "Training center", hi: "प्रशिक्षण केंद्र", bn: "প্রশিক্ষণ কেন্দ্র" }, desc: { en: "KVK & skill programs", hi: "KVK और कौशल कार्यक्रम", bn: "KVK ও দক্ষতা কর্মসূচি" }, icon: "GraduationCap", accent: "yellow", kind: "svcMarketplace", props: { category: "training" } },
  { id: "bank", title: { en: "Bank", hi: "बैंक", bn: "ব্যাংক" }, desc: { en: "Loans & accounts", hi: "ऋण और खाते", bn: "ঋণ ও অ্যাকাউন্ট" }, icon: "Building2", accent: "blue" },
  { id: "insurance", title: { en: "Insurance", hi: "बीमा", bn: "বীমা" }, desc: { en: "Crop & livestock cover", hi: "फसल और पशु कवर", bn: "ফসল ও পশু কভার" }, icon: "ShieldCheck", accent: "primary", kind: "svcMarketplace", props: { category: "insurance" } },
  { id: "labor", title: { en: "Labor", hi: "श्रमिक", bn: "শ্রমিক" }, desc: { en: "Workers, attendance & wages", hi: "श्रमिक, हाजिरी और मजदूरी", bn: "শ্রমিক, হাজিরা ও মজুরি" }, icon: "Users", accent: "orange", kind: "erpEmployees" },
  { id: "transport", title: { en: "Transport", hi: "परिवहन", bn: "পরিবহন" }, desc: { en: "Move produce to market", hi: "उपज मंडी पहुँचाएँ", bn: "ফসল বাজারে পৌঁছান" }, icon: "Truck", accent: "yellow", kind: "logisticsHub" },
];

export const PROFILE_ITEMS = [
  { id: "farm", title: "farmDetails", icon: "Wheat" },
  { id: "language", title: "language", icon: "Languages" },
  { id: "subscription", title: "subscription", icon: "Crown" },
  { id: "payments", title: "payments", icon: "CreditCard" },
  { id: "documents", title: "documents", icon: "FileText" },
  { id: "support", title: "support", icon: "LifeBuoy" },
  { id: "settings", title: "settings", icon: "Settings" },
  { id: "privacy", title: "privacy", icon: "Lock" },
];
