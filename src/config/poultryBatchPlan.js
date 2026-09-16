/* Batch Operating Plan — static client-side config.
   Provides phase guidance, cautions, and watch-for items for each stage of a
   poultry batch lifecycle. Does NOT replace the workflow engine — purely
   advisory UI overlay. No medical dosing; operational cautions only. */

const PHASES = [
  {
    id: "placement",
    days: [0, 0],
    label: { en: "Day 0 — Placement", hi: "दिन 0 — रखवाली", bn: "দিন ০ — স্থাপন" },
    focus: {
      en: "Receive chicks, confirm placement count, and establish brooding environment.",
      hi: "चूज़े प्राप्त करें, संख्या दर्ज करें और ब्रूडिंग वातावरण तैयार करें।",
      bn: "বাচ্চা গ্রহণ করুন, সংখ্যা নিশ্চিত করুন এবং ব্রুডিং পরিবেশ তৈরি করুন।",
    },
    mandatory: ["day0-setup", "daily-mortality", "daily-feed-check", "daily-env", "daily-water"],
    cautions: [
      {
        en: "Maintain brooder temperature at 32–35 °C at chick level; cold stress in the first 24 hours raises week-1 mortality significantly.",
        hi: "चूज़े की ऊँचाई पर ब्रूडर तापमान 32–35 °C रखें; पहले 24 घंटे में ठंड का तनाव सप्ताह-1 मृत्यु दर बढ़ाता है।",
        bn: "বাচ্চার স্তরে ব্রুডার তাপমাত্রা ৩২–৩৫ °C রাখুন; প্রথম ২৪ ঘন্টায় ঠান্ডার চাপ সপ্তাহ-১ মৃত্যু বাড়ায়।",
      },
      {
        en: "Provide clean, slightly warm water immediately on arrival; dehydration on day 0 reduces gut colonisation.",
        hi: "आगमन पर तुरंत साफ, हल्का गर्म पानी दें; दिन 0 पर निर्जलीकरण आंत-उपनिवेशीकरण कम करता है।",
        bn: "আগমনের সাথে সাথে পরিষ্কার, হালকা গরম পানি দিন; দিন ০-এ পানি-শূন্যতা অন্ত্রের জীবাণু বসতি কমায়।",
      },
      {
        en: "Record the exact number of chicks placed and any DOA (dead-on-arrival) before signing the delivery receipt.",
        hi: "डिलीवरी रसीद पर हस्ताक्षर करने से पहले रखे गए चूज़ों की सटीक संख्या और किसी भी DOA को दर्ज करें।",
        bn: "ডেলিভারি রসিদে সই করার আগে রাখা বাচ্চার সঠিক সংখ্যা এবং যেকোনো DOA রেকর্ড করুন।",
      },
    ],
    watchFor: [
      {
        en: "More than 1% of chicks dead or unresponsive within first 6 hours.",
        hi: "पहले 6 घंटों में 1% से अधिक चूज़े मृत या अनुत्तरदायी।",
        bn: "প্রথম ৬ ঘন্টায় ১%-এর বেশি বাচ্চা মৃত বা সাড়াহীন।",
        incidentHint: {
          en: "More than 1% of chicks dead or unresponsive within 6 hours of placement",
          hi: "रखवाली के 6 घंटे के अंदर 1% से अधिक चूज़े मृत या अनुत्तरदायी",
          bn: "স্থাপনের ৬ ঘন্টার মধ্যে ১%-এর বেশি বাচ্চা মৃত বা সাড়াহীন",
        },
      },
      {
        en: "Chicks piling under brooder (too cold) or crowding at edges (too hot).",
        hi: "ब्रूडर के नीचे चूज़ों का ढेर (बहुत ठंडा) या किनारों पर भीड़ (बहुत गर्म)।",
        bn: "ব্রুডারের নিচে বাচ্চা জড়ো হওয়া (অনেক ঠান্ডা) বা কিনারায় ভিড় (অনেক গরম)।",
        incidentHint: {
          en: "Chicks piling under brooder or crowding at pen edges — possible temperature problem",
          hi: "चूज़े ब्रूडर के नीचे ढेर या बाड़े के किनारों पर भीड़ — संभावित तापमान समस्या",
          bn: "বাচ্চা ব্রুডারের নিচে জড়ো বা কলমের কিনারায় ভিড় — সম্ভাব্য তাপমাত্রার সমস্যা",
        },
      },
    ],
  },
  {
    id: "early-brooding",
    days: [1, 6],
    label: { en: "Early Brooding (Days 1–6)", hi: "प्रारंभिक ब्रूडिंग (दिन 1–6)", bn: "প্রাথমিক ব্রুডিং (দিন ১–৬)" },
    focus: {
      en: "Maintain uniform heat, ensure all chicks are eating and drinking, and keep mortality below 0.5% per day.",
      hi: "एकसमान गर्मी बनाए रखें, सुनिश्चित करें कि सभी चूज़े खा-पी रहे हैं, और प्रति दिन मृत्यु दर 0.5% से कम रखें।",
      bn: "সমান তাপ বজায় রাখুন, নিশ্চিত করুন সব বাচ্চা খাচ্ছে ও পান করছে, এবং প্রতিদিন মৃত্যু ০.৫%-এর নিচে রাখুন।",
    },
    mandatory: ["daily-mortality", "daily-feed-check", "daily-env", "daily-water", "brooding-check"],
    cautions: [
      {
        en: "Reduce brooder temperature by 2–3 °C every 3 days; rapid or uneven temperature drops stress the flock.",
        hi: "हर 3 दिन में ब्रूडर तापमान 2–3 °C कम करें; तीव्र या असमान तापमान गिरावट झुंड को तनाव देती है।",
        bn: "প্রতি ৩ দিনে ব্রুডার তাপমাত্রা ২–৩ °C কমান; দ্রুত বা অসমান তাপমাত্রা হ্রাস ঝাঁককে চাপ দেয়।",
      },
      {
        en: "Check litter moisture daily; wet litter leads to hock burns, footpad lesions, and respiratory issues from ammonia.",
        hi: "प्रतिदिन लिटर नमी जाँचें; गीला लिटर हॉक बर्न, फुट-पैड घाव और अमोनिया से श्वास समस्याएँ पैदा करता है।",
        bn: "প্রতিদিন লিটারের আর্দ্রতা পরীক্ষা করুন; ভেজা লিটার হক বার্ন, ফুটপ্যাড ক্ষত এবং অ্যামোনিয়া থেকে শ্বাস সমস্যা তৈরি করে।",
      },
      {
        en: "Ensure feeder and drinker space keeps pace with flock growth; restricted access causes uneven weight gain.",
        hi: "सुनिश्चित करें कि फीडर और ड्रिंकर की जगह झुंड की वृद्धि के साथ बढ़ती रहे; सीमित पहुँच असमान वजन बढ़ोतरी का कारण बनती है।",
        bn: "নিশ্চিত করুন ফিডার ও ড্রিংকারের জায়গা ঝাঁকের বৃদ্ধির সাথে সামঞ্জস্যপূর্ণ; সীমিত প্রবেশাধিকার অসমান ওজন বৃদ্ধি করে।",
      },
    ],
    watchFor: [
      {
        en: "Cumulative mortality above 1% by day 3 or above 2% by day 6.",
        hi: "दिन 3 तक संचयी मृत्यु दर 1% से ऊपर या दिन 6 तक 2% से ऊपर।",
        bn: "দিন ৩-এর মধ্যে সঞ্চিত মৃত্যু ১%-এর উপরে বা দিন ৬-এর মধ্যে ২%-এর উপরে।",
        incidentHint: {
          en: "Cumulative mortality above expected level in early brooding (days 1–6)",
          hi: "प्रारंभिक ब्रूडिंग में संचयी मृत्यु दर अपेक्षित स्तर से अधिक (दिन 1–6)",
          bn: "প্রাথমিক ব্রুডিংয়ে (দিন ১–৬) সঞ্চিত মৃত্যু প্রত্যাশিত স্তরের উপরে",
        },
      },
      {
        en: "Chicks not eating or visibly huddled away from feeders after 24 hours.",
        hi: "24 घंटे बाद चूज़े खाना नहीं खा रहे या फीडर से दूर झुंड में हैं।",
        bn: "২৪ ঘন্টা পর বাচ্চা খাচ্ছে না বা ফিডার থেকে দূরে জড়ো হয়ে আছে।",
        incidentHint: {
          en: "Chicks not eating or huddled away from feeders more than 24 hours after placement",
          hi: "रखवाली के 24 घंटे बाद भी चूज़े नहीं खा रहे या फीडर से दूर झुंड में हैं",
          bn: "স্থাপনের ২৪ ঘন্টার বেশি সময় পর বাচ্চা খাচ্ছে না বা ফিডার থেকে দূরে জড়ো",
        },
      },
    ],
  },
  {
    id: "week1-end",
    days: [7, 7],
    label: { en: "Day 7 — First Weigh-In", hi: "दिन 7 — पहला वजन", bn: "দিন ৭ — প্রথম ওজন" },
    focus: {
      en: "Weigh a sample of birds to assess early growth; target body weight guides feed programme adjustments.",
      hi: "प्रारंभिक विकास जाँचने के लिए पक्षियों के नमूने का वजन करें; लक्ष्य शरीर वजन फ़ीड कार्यक्रम समायोजन का मार्गदर्शन करता है।",
      bn: "প্রাথমিক বৃদ্ধি মূল্যায়নের জন্য কিছু পাখির নমুনা ওজন করুন; লক্ষ্য শরীরের ওজন ফিড প্রোগ্রাম সামঞ্জস্যের নির্দেশ দেয়।",
    },
    mandatory: ["weight-d7", "daily-mortality", "daily-feed-check", "daily-env", "daily-water", "brooding-check"],
    cautions: [
      {
        en: "Weigh at least 50–100 birds (or 5% of flock) from multiple pen locations for a representative sample.",
        hi: "प्रतिनिधि नमूने के लिए कई पेन स्थानों से कम से कम 50–100 पक्षी (या झुंड का 5%) तौलें।",
        bn: "প্রতিনিধিত্বমূলক নমুনার জন্য একাধিক কলম স্থান থেকে কমপক্ষে ৫০–১০০ পাখি (বা ঝাঁকের ৫%) ওজন করুন।",
      },
    ],
    watchFor: [
      {
        en: "Average day-7 weight more than 15% below breed standard for your poultry type.",
        hi: "औसत दिन-7 वजन आपके पोल्ट्री प्रकार के नस्ल मानक से 15% से अधिक कम।",
        bn: "গড় দিন-৭ ওজন আপনার পোল্ট্রি ধরনের জাত মানদণ্ডের চেয়ে ১৫%-এর বেশি কম।",
        incidentHint: {
          en: "Day-7 average weight significantly below breed standard — possible early growth check",
          hi: "दिन-7 औसत वजन नस्ल मानक से काफी कम — संभावित प्रारंभिक विकास समस्या",
          bn: "দিন-৭ গড় ওজন জাত মানদণ্ডের তুলনায় উল্লেখযোগ্যভাবে কম — সম্ভাব্য প্রাথমিক বৃদ্ধি সমস্যা",
        },
      },
    ],
  },
  {
    id: "mid-brooding",
    days: [8, 13],
    label: { en: "Mid Brooding (Days 8–13)", hi: "मध्य ब्रूडिंग (दिन 8–13)", bn: "মধ্য ব্রুডিং (দিন ৮–১৩)" },
    focus: {
      en: "Gradually wean off supplemental heat, focus on ventilation, and monitor feed intake growth.",
      hi: "धीरे-धीरे अनुपूरक गर्मी कम करें, वेंटिलेशन पर ध्यान दें और फ़ीड खपत वृद्धि की निगरानी करें।",
      bn: "ধীরে ধীরে অতিরিক্ত তাপ কমান, ভেন্টিলেশনে মনোযোগ দিন এবং ফিড গ্রহণের বৃদ্ধি পর্যবেক্ষণ করুন।",
    },
    mandatory: ["daily-mortality", "daily-feed-check", "daily-env", "daily-water", "brooding-check"],
    cautions: [
      {
        en: "Increase ventilation as the flock grows; ammonia above 20 ppm at bird level suppresses feed intake and immunity.",
        hi: "झुंड बढ़ने के साथ वेंटिलेशन बढ़ाएँ; पक्षी स्तर पर 20 ppm से ऊपर अमोनिया फ़ीड खपत और प्रतिरक्षा कम करती है।",
        bn: "ঝাঁক বাড়ার সাথে ভেন্টিলেশন বাড়ান; পাখির স্তরে ২০ পিপিএম-এর উপরে অ্যামোনিয়া ফিড গ্রহণ এবং রোগ প্রতিরোধ ক্ষমতা কমায়।",
      },
      {
        en: "Avoid drafts at bird level when opening side curtains; temperature swings above 5 °C cause respiratory stress.",
        hi: "पार्श्व पर्दे खोलते समय पक्षी स्तर पर ड्राफ्ट से बचें; 5 °C से ऊपर तापमान उतार-चढ़ाव श्वास तनाव का कारण बनता है।",
        bn: "পাশের পর্দা খোলার সময় পাখির স্তরে খসড়া এড়িয়ে চলুন; ৫ °C-এর উপরে তাপমাত্রার ওঠানামা শ্বাস-চাপ তৈরি করে।",
      },
    ],
    watchFor: [
      {
        en: "Sudden drop in feed or water consumption over 2 consecutive days.",
        hi: "लगातार 2 दिनों में फ़ीड या पानी की खपत में अचानक गिरावट।",
        bn: "পর পর ২ দিন ফিড বা পানির ব্যবহারে হঠাৎ পতন।",
        incidentHint: {
          en: "Sudden drop in feed or water consumption over 2 consecutive days (days 8–13)",
          hi: "लगातार 2 दिनों में फ़ीड या पानी की खपत में अचानक गिरावट (दिन 8–13)",
          bn: "পর পর ২ দিন ফিড বা পানির ব্যবহারে হঠাৎ পতন (দিন ৮–১৩)",
        },
      },
      {
        en: "Sneezing, nasal discharge, or laboured breathing observed in multiple birds.",
        hi: "कई पक्षियों में छींकना, नाक से स्राव, या कठिन साँस लेना।",
        bn: "একাধিক পাখিতে হাঁচি, নাকের স্রাব বা কষ্টকর শ্বাস-প্রশ্বাস পর্যবেক্ষণ।",
        incidentHint: {
          en: "Sneezing, nasal discharge, or laboured breathing in multiple birds",
          hi: "कई पक्षियों में छींकना, नाक से स्राव या कठिन साँस",
          bn: "একাধিক পাখিতে হাঁচি, নাকের স্রাব বা কষ্টকর শ্বাস",
        },
      },
    ],
  },
  {
    id: "brooding-end",
    days: [14, 14],
    label: { en: "Day 14 — Brooding Ends", hi: "दिन 14 — ब्रूडिंग खत्म", bn: "দিন ১৪ — ব্রুডিং শেষ" },
    focus: {
      en: "Remove supplemental heat, confirm birds are fully feathered and adapted to ambient temperature.",
      hi: "अनुपूरक गर्मी हटाएँ, पुष्टि करें कि पक्षी पूरी तरह से पंखदार हैं और परिवेश तापमान के अनुकूल हैं।",
      bn: "অতিরিক্ত তাপ সরান, নিশ্চিত করুন পাখি পুরোপুরি পালকযুক্ত এবং পরিবেশের তাপমাত্রায় মানিয়ে নিয়েছে।",
    },
    mandatory: ["daily-mortality", "daily-feed-check", "daily-env", "daily-water"],
    cautions: [
      {
        en: "Transition heat removal gradually over 1–2 days; abrupt withdrawal during cold nights can cause chill mortality.",
        hi: "1–2 दिनों में धीरे-धीरे गर्मी हटाएँ; ठंडी रातों में अचानक वापसी सर्दी से मृत्यु का कारण बन सकती है।",
        bn: "১–২ দিনে ধীরে ধীরে তাপ সরান; ঠান্ডা রাতে হঠাৎ প্রত্যাহার ঠান্ডা-জনিত মৃত্যু ঘটাতে পারে।",
      },
    ],
    watchFor: [
      {
        en: "Birds showing signs of chilling (huddling, lethargy) after heat removal.",
        hi: "गर्मी हटाने के बाद ठंड के लक्षण (झुंड बनाना, सुस्ती) दिखाने वाले पक्षी।",
        bn: "তাপ সরানোর পর ঠান্ডার লক্ষণ দেখাচ্ছে (জড়ো হওয়া, অলসতা)।",
        incidentHint: {
          en: "Birds huddling or lethargic after heat removal on day 14",
          hi: "दिन 14 पर गर्मी हटाने के बाद पक्षी झुंड बना रहे या सुस्त हैं",
          bn: "দিন ১৪-এ তাপ সরানোর পর পাখি জড়ো হচ্ছে বা অলস",
        },
      },
    ],
  },
  {
    id: "grower-early",
    days: [15, 20],
    label: { en: "Early Grower (Days 15–20)", hi: "प्रारंभिक ग्रोअर (दिन 15–20)", bn: "প্রাথমিক গ্রোয়ার (দিন ১৫–২০)" },
    focus: {
      en: "Maximise feed intake and uniform growth; this period sets the trajectory for final body weight.",
      hi: "फ़ीड खपत और एकसमान विकास अधिकतम करें; यह अवधि अंतिम शरीर वजन की गति निर्धारित करती है।",
      bn: "ফিড গ্রহণ এবং সমান বৃদ্ধি সর্বাধিক করুন; এই সময়কাল চূড়ান্ত শরীরের ওজনের গতিপথ নির্ধারণ করে।",
    },
    mandatory: ["daily-mortality", "daily-feed-check", "daily-env", "daily-water"],
    cautions: [
      {
        en: "Ensure stocking density does not exceed recommended limits; overcrowding suppresses feed intake and increases disease pressure.",
        hi: "स्टॉकिंग घनत्व अनुशंसित सीमाओं से अधिक न हो; अत्यधिक भीड़ फ़ीड खपत कम करती है और बीमारी का दबाव बढ़ाती है।",
        bn: "স্টকিং ঘনত্ব প্রস্তাবিত সীমা অতিক্রম না করে; অতিরিক্ত ভিড় ফিড গ্রহণ কমায় এবং রোগের চাপ বাড়ায়।",
      },
      {
        en: "Maintain 18–22 hours of light to support continuous feeding during rapid growth phase.",
        hi: "तीव्र वृद्धि चरण में निरंतर खिलाने का समर्थन करने के लिए 18–22 घंटे रोशनी बनाए रखें।",
        bn: "দ্রুত বৃদ্ধির পর্যায়ে ক্রমাগত খাওয়ানোর সহায়তায় ১৮–২২ ঘন্টার আলো বজায় রাখুন।",
      },
    ],
    watchFor: [
      {
        en: "Daily feed intake plateau or decline over 3 consecutive days without a clear environmental cause.",
        hi: "स्पष्ट पर्यावरणीय कारण के बिना लगातार 3 दिनों में दैनिक फ़ीड खपत का ठहराव या गिरावट।",
        bn: "কোনো স্পষ্ট পরিবেশগত কারণ ছাড়া পর পর ৩ দিন দৈনিক ফিড গ্রহণ স্থবির বা হ্রাস।",
        incidentHint: {
          en: "Feed intake plateau or decline for 3+ days in early grower phase (days 15–20)",
          hi: "प्रारंभिक ग्रोअर चरण में 3+ दिन फ़ीड खपत का ठहराव या गिरावट (दिन 15–20)",
          bn: "প্রাথমিক গ্রোয়ার পর্যায়ে (দিন ১৫–২০) ৩+ দিন ফিড গ্রহণ স্থবির বা হ্রাস",
        },
      },
    ],
  },
  {
    id: "grower-mid",
    days: [21, 27],
    label: { en: "Mid Grower (Days 21–27)", hi: "मध्य ग्रोअर (दिन 21–27)", bn: "মধ্য গ্রোয়ার (দিন ২১–২৭)" },
    focus: {
      en: "Weekly weight check; monitor FCR and adjust feeding strategy based on growth performance.",
      hi: "साप्ताहिक वजन जाँच; FCR निगरानी करें और विकास प्रदर्शन के आधार पर फीडिंग रणनीति समायोजित करें।",
      bn: "সাপ্তাহিক ওজন পরীক্ষা; FCR পর্যবেক্ষণ করুন এবং বৃদ্ধির কার্যক্ষমতার ভিত্তিতে ফিডিং কৌশল সামঞ্জস্য করুন।",
    },
    mandatory: ["daily-mortality", "daily-feed-check", "daily-env", "daily-water", "weight-weekly", "biosecurity-weekly"],
    cautions: [
      {
        en: "Heat stress becomes a risk above 32 °C; ensure cross-ventilation and avoid feed delivery during peak afternoon heat.",
        hi: "32 °C से ऊपर गर्मी का तनाव एक जोखिम है; क्रॉस-वेंटिलेशन सुनिश्चित करें और दोपहर की चरम गर्मी में फ़ीड देने से बचें।",
        bn: "৩২ °C-এর উপরে তাপ-চাপ ঝুঁকি হয়; ক্রস-ভেন্টিলেশন নিশ্চিত করুন এবং দুপুরের প্রচণ্ড গরমে ফিড দেওয়া এড়িয়ে চলুন।",
      },
      {
        en: "Weekly biosecurity sweep: disinfect footbaths, check perimeter nets, and log visitor access.",
        hi: "साप्ताहिक जैव सुरक्षा जाँच: फुटबाथ कीटाणुरहित करें, परिधि जाल जाँचें और आगंतुक पहुँच लॉग करें।",
        bn: "সাপ্তাহিক জৈব-নিরাপত্তা পরীক্ষা: ফুটবাথ জীবাণুমুক্ত করুন, পরিধি জাল পরীক্ষা করুন এবং দর্শনার্থীর প্রবেশ লগ করুন।",
      },
    ],
    watchFor: [
      {
        en: "Sudden increase in daily mortality (>0.3% on a single day).",
        hi: "दैनिक मृत्यु दर में अचानक वृद्धि (एक दिन में >0.3%)।",
        bn: "দৈনিক মৃত্যুতে হঠাৎ বৃদ্ধি (একদিনে >০.৩%)।",
        incidentHint: {
          en: "Sudden spike in daily mortality above 0.3% in mid grower phase",
          hi: "मध्य ग्रोअर चरण में दैनिक मृत्यु दर में 0.3% से ऊपर अचानक उछाल",
          bn: "মধ্য গ্রোয়ার পর্যায়ে দৈনিক মৃত্যু ০.৩%-এর উপরে হঠাৎ বৃদ্ধি",
        },
      },
      {
        en: "Lameness or leg weakness noticed in multiple birds.",
        hi: "कई पक्षियों में लंगड़ापन या पैर की कमजोरी।",
        bn: "একাধিক পাখিতে খোঁড়াত্ব বা পা দুর্বলতা।",
        incidentHint: {
          en: "Lameness or leg weakness observed in multiple birds",
          hi: "कई पक्षियों में लंगड़ापन या पैर की कमजोरी देखी गई",
          bn: "একাধিক পাখিতে খোঁড়াত্ব বা পা দুর্বলতা পর্যবেক্ষণ",
        },
      },
    ],
  },
  {
    id: "grower-late",
    days: [28, 34],
    label: { en: "Late Grower (Days 28–34)", hi: "अंतिम ग्रोअर (दिन 28–34)", bn: "শেষ গ্রোয়ার (দিন ২৮–৩৪)" },
    focus: {
      en: "Monitor weight-for-age closely; begin planning harvest logistics based on market weight targets.",
      hi: "आयु के अनुसार वजन की करीबी निगरानी करें; बाजार वजन लक्ष्यों के आधार पर कटाई रसद की योजना बनाना शुरू करें।",
      bn: "বয়স অনুযায়ী ওজন ঘনিষ্ঠভাবে পর্যবেক্ষণ করুন; বাজার ওজন লক্ষ্যমাত্রার ভিত্তিতে কাটাইয়ের পরিকল্পনা শুরু করুন।",
    },
    mandatory: ["daily-mortality", "daily-feed-check", "daily-env", "daily-water", "weight-weekly"],
    cautions: [
      {
        en: "Cardiac and ascites risks increase after day 28; avoid sudden high-energy diet switches without gradual transition.",
        hi: "दिन 28 के बाद हृदय और जलोदर जोखिम बढ़ते हैं; धीरे-धीरे संक्रमण के बिना अचानक उच्च-ऊर्जा आहार परिवर्तन से बचें।",
        bn: "দিন ২৮-এর পর হার্ট ও পেটে পানি জমার ঝুঁকি বাড়ে; ধীরে ধীরে রূপান্তর ছাড়া হঠাৎ উচ্চ-শক্তির খাদ্য পরিবর্তন এড়িয়ে চলুন।",
      },
      {
        en: "Maintain clean, cool water at all times; water deprivation even for 2–3 hours reduces feed intake and growth significantly.",
        hi: "हमेशा साफ, ठंडा पानी उपलब्ध रखें; 2–3 घंटे भी पानी की कमी फ़ीड खपत और विकास को काफी कम करती है।",
        bn: "সর্বদা পরিষ্কার, ঠান্ডা পানি রাখুন; ২–৩ ঘন্টার পানি-বঞ্চনাও ফিড গ্রহণ এবং বৃদ্ধি উল্লেখযোগ্যভাবে কমায়।",
      },
    ],
    watchFor: [
      {
        en: "Birds found dead with no prior signs (sudden death syndrome risk increases in fast-growing birds).",
        hi: "पूर्व संकेत के बिना मृत पाए गए पक्षी (तेजी से बढ़ने वाले पक्षियों में अचानक मृत्यु सिंड्रोम का जोखिम बढ़ता है)।",
        bn: "পূর্ব লক্ষণ ছাড়া মৃত পাওয়া পাখি (দ্রুত বর্ধনশীল পাখিতে হঠাৎ মৃত্যু সিন্ড্রোমের ঝুঁকি বাড়ে)।",
        incidentHint: {
          en: "Birds found dead with no prior visible signs — possible sudden death syndrome",
          hi: "पूर्व दृश्य संकेत के बिना मृत पाए गए पक्षी — संभावित अचानक मृत्यु सिंड्रोम",
          bn: "পূর্ব দৃশ্যমান লক্ষণ ছাড়া মৃত পাওয়া পাখি — সম্ভাব্য হঠাৎ মৃত্যু সিন্ড্রোম",
        },
      },
    ],
  },
  {
    id: "pre-harvest",
    days: [35, 42],
    label: { en: "Pre-Harvest (Days 35–42)", hi: "पूर्व-कटाई (दिन 35–42)", bn: "কাটাইপূর্ব (দিন ৩৫–৪২)" },
    focus: {
      en: "Confirm target weight, finalise harvest date, and prepare logistics for live-bird transport.",
      hi: "लक्ष्य वजन की पुष्टि करें, कटाई की तारीख अंतिम करें और जीवित पक्षी परिवहन की रसद तैयार करें।",
      bn: "লক্ষ্য ওজন নিশ্চিত করুন, কাটাইয়ের তারিখ চূড়ান্ত করুন এবং জীবন্ত পাখি পরিবহনের লজিস্টিক্স প্রস্তুত করুন।",
    },
    mandatory: ["daily-mortality", "daily-feed-check", "daily-env", "daily-water", "harvest-prep"],
    cautions: [
      {
        en: "Coordinate with the buyer or processor at least 3–5 days in advance to confirm live-weight targets and pickup schedule.",
        hi: "जीवित वजन लक्ष्य और पिकअप शेड्यूल की पुष्टि के लिए कम से कम 3–5 दिन पहले खरीदार या प्रोसेसर से समन्वय करें।",
        bn: "জীবন্ত ওজন লক্ষ্য এবং পিকআপ সময়সূচি নিশ্চিত করতে কমপক্ষে ৩–৫ দিন আগে ক্রেতা বা প্রসেসরের সাথে সমন্বয় করুন।",
      },
      {
        en: "Avoid any unnecessary stressors (loud noise, disturbance, sudden light changes) in the last 48 hours before harvest.",
        hi: "कटाई से पहले अंतिम 48 घंटों में किसी भी अनावश्यक तनाव (तेज आवाज, गड़बड़ी, अचानक प्रकाश परिवर्तन) से बचें।",
        bn: "কাটাইয়ের আগের শেষ ৪৮ ঘন্টায় যেকোনো অপ্রয়োজনীয় চাপ (জোরে শব্দ, বিঘ্ন, হঠাৎ আলো পরিবর্তন) এড়িয়ে চলুন।",
      },
    ],
    watchFor: [
      {
        en: "Weight gain stalling or mortality spiking in the final week — may indicate late-stage health or feed issue.",
        hi: "अंतिम सप्ताह में वजन बढ़ना रुकना या मृत्यु दर बढ़ना — अंतिम चरण स्वास्थ्य या फ़ीड समस्या का संकेत हो सकता है।",
        bn: "শেষ সপ্তাহে ওজন বৃদ্ধি থেমে যাওয়া বা মৃত্যু বাড়া — দেরি-পর্যায়ের স্বাস্থ্য বা ফিড সমস্যার ইঙ্গিত হতে পারে।",
        incidentHint: {
          en: "Weight gain stalling or mortality spike in the final week before harvest",
          hi: "कटाई से पहले अंतिम सप्ताह में वजन बढ़ना रुकना या मृत्यु दर में उछाल",
          bn: "কাটাইয়ের আগের শেষ সপ্তাহে ওজন বৃদ্ধি থেমে যাওয়া বা মৃত্যু বৃদ্ধি",
        },
      },
    ],
  },
  {
    id: "extended",
    days: [43, 999],
    label: { en: "Extended Batch (Day 43+)", hi: "विस्तारित बैच (दिन 43+)", bn: "বর্ধিত ব্যাচ (দিন ৪৩+)" },
    focus: {
      en: "Batch is beyond standard harvest window — reassess market conditions and confirm harvest plan urgently.",
      hi: "बैच मानक कटाई विंडो से परे है — बाजार स्थितियों का पुनर्मूल्यांकन करें और कटाई योजना तत्काल पुष्टि करें।",
      bn: "ব্যাচ মানক কাটাই উইন্ডোর বাইরে — বাজারের অবস্থা পুনর্মূল্যায়ন করুন এবং কাটাইয়ের পরিকল্পনা জরুরিভাবে নিশ্চিত করুন।",
    },
    mandatory: ["daily-mortality", "daily-feed-check", "daily-env", "daily-water"],
    cautions: [
      {
        en: "FCR degrades rapidly after day 42; every additional day increases feed cost per kg of liveweight.",
        hi: "दिन 42 के बाद FCR तेजी से खराब होती है; प्रत्येक अतिरिक्त दिन जीवित वजन प्रति किग्रा फ़ीड लागत बढ़ाता है।",
        bn: "দিন ৪২-এর পর FCR দ্রুত খারাপ হয়; প্রতিটি অতিরিক্ত দিন জীবন্ত ওজন প্রতি কেজি ফিড খরচ বাড়ায়।",
      },
    ],
    watchFor: [
      {
        en: "Any sudden increase in mortality or health signs — immune senescence increases disease vulnerability in extended batches.",
        hi: "मृत्यु दर या स्वास्थ्य संकेतों में कोई अचानक वृद्धि — प्रतिरक्षा वृद्धावस्था विस्तारित बैच में बीमारी की संवेदनशीलता बढ़ाती है।",
        bn: "মৃত্যু বা স্বাস্থ্য লক্ষণে যেকোনো হঠাৎ বৃদ্ধি — ইমিউন বার্ধক্য বর্ধিত ব্যাচে রোগের সংবেদনশীলতা বাড়ায়।",
        incidentHint: {
          en: "Sudden mortality increase or new health signs in extended batch (day 43+)",
          hi: "विस्तारित बैच में अचानक मृत्यु वृद्धि या नए स्वास्थ्य संकेत (दिन 43+)",
          bn: "বর্ধিত ব্যাচে (দিন ৪৩+) হঠাৎ মৃত্যু বৃদ্ধি বা নতুন স্বাস্থ্য লক্ষণ",
        },
      },
    ],
  },
];

export const LIFECYCLE_MILESTONES = [
  { day: 0,  icon: "Bird",       label: { en: "Placement",    hi: "रखवाली",        bn: "স্থাপন" } },
  { day: 7,  icon: "Scale",      label: { en: "1st weight",   hi: "पहला वजन",      bn: "১ম ওজন" } },
  { day: 14, icon: "Flame",      label: { en: "Brooding ends",hi: "ब्रूडिंग खत्म", bn: "ব্রুডিং শেষ" } },
  { day: 28, icon: "TrendingUp", label: { en: "Wk 4 weight",  hi: "सप्ताह 4 वजन", bn: "সপ্তাহ ৪ ওজন" } },
  { day: 42, icon: "Package",    label: { en: "Harvest",      hi: "कटाई",          bn: "কাটাই" } },
];

export function getPlanForDay(batchDay) {
  const d = batchDay ?? 0;
  return PHASES.find(p => d >= p.days[0] && d <= p.days[1]) || PHASES[PHASES.length - 1];
}

/* Mirror of server templateFires() — for UI preview only, never writes to DB */
const TEMPLATE_PREVIEW = [
  { id: "day0-setup",         title: { en: "Day 0: Confirm placement",    hi: "दिन 0: रखवाली पुष्टि",       bn: "দিন ০: স্থাপন নিশ্চিত" },          category: "milestone",   triggerType: "on_day",       day: 0 },
  { id: "daily-mortality",    title: { en: "Record mortality & culls",     hi: "मृत्यु व छंटाई दर्ज करें",   bn: "মৃত্যু ও বাতিল রেকর্ড করুন" },    category: "daily_ops",   triggerType: "daily",        dayFrom: 0 },
  { id: "daily-feed-check",   title: { en: "Feed check & consumption",     hi: "फ़ीड जाँच और खपत",           bn: "ফিড পরীক্ষা ও ব্যবহার" },          category: "feed",        triggerType: "daily",        dayFrom: 0 },
  { id: "daily-env",          title: { en: "Environment check",            hi: "वातावरण जाँच",               bn: "পরিবেশ পরীক্ষা" },                 category: "daily_ops",   triggerType: "daily",        dayFrom: 0 },
  { id: "daily-water",        title: { en: "Water quality check",          hi: "जल गुणवत्ता जाँच",           bn: "পানির গুণমান পরীক্ষা" },           category: "daily_ops",   triggerType: "daily",        dayFrom: 0 },
  { id: "brooding-check",     title: { en: "Brooding temperature check",   hi: "ब्रूडिंग तापमान जाँच",      bn: "ব্রুডিং তাপমাত্রা পরীক্ষা" },     category: "daily_ops",   triggerType: "daily",        dayFrom: 0, dayTo: 14, poultryTypes: ["broiler", "country_chicken"] },
  { id: "weight-d7",          title: { en: "Day 7 weight check",           hi: "दिन 7 वजन जाँच",             bn: "দিন ৭ ওজন পরীক্ষা" },              category: "weight",      triggerType: "on_day",       day: 7 },
  { id: "weight-weekly",      title: { en: "Weekly weight check",          hi: "साप्ताहिक वजन जाँच",         bn: "সাপ্তাহিক ওজন পরীক্ষা" },         category: "weight",      triggerType: "every_n_days", everyNDays: 7, startDay: 14 },
  { id: "biosecurity-weekly", title: { en: "Biosecurity check",            hi: "जैव सुरक्षा जाँच",           bn: "জৈব-নিরাপত্তা পরীক্ষা" },         category: "biosecurity", triggerType: "every_n_days", everyNDays: 7, startDay: 7 },
  { id: "cleaning-periodic",  title: { en: "Litter / pen cleaning",        hi: "लिटर / पेन सफाई",            bn: "লিটার / কলম পরিষ্কার" },           category: "biosecurity", triggerType: "every_n_days", everyNDays: 3, startDay: 3 },
];

function _templateFiresOnDay(t, batchDay, poultryType) {
  if (t.dayFrom != null && batchDay < t.dayFrom) return false;
  if (t.dayTo   != null && batchDay > t.dayTo)   return false;
  if (t.poultryTypes && !t.poultryTypes.includes(poultryType)) return false;
  if (t.triggerType === "daily")        return true;
  if (t.triggerType === "on_day")       return batchDay === t.day;
  if (t.triggerType === "every_n_days") return batchDay >= t.startDay && (batchDay - t.startDay) % t.everyNDays === 0;
  return false;
}

export function previewTasksForDay(targetDay, poultryType = "broiler") {
  return TEMPLATE_PREVIEW
    .filter(t => _templateFiresOnDay(t, targetDay, poultryType))
    .map(t => ({ id: t.id, title: t.title, category: t.category }));
}
