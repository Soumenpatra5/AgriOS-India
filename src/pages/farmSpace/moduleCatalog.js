// Module UI Dictionary
// Mirrors the server-side modules.js but includes UI strings, icons, and permissions.

export const MODULE_CATALOG = {
  // Required/Core Modules
  farmSpaceTeam: {
    kind: "farmSpaceTeam",
    perm: "farm.members.view",
    icon: "Users",
    a: "blue",
    label: { en: "Team", hi: "टीम", bn: "দল" },
    desc: { en: "Members & roles", hi: "सदस्य और भूमिकाएँ", bn: "সদস্য এবং ভূমিকা" }
  },
  farmSpaceTasks: {
    kind: "farmSpaceTasks",
    perm: "farm.tasks.view",
    icon: "ClipboardList",
    a: "blue",
    label: { en: "Tasks", hi: "कार्य", bn: "কাজ" },
    desc: { en: "Assign & track", hi: "सौंपें और ट्रैक करें", bn: "বরাদ্দ এবং ট্র্যাক" }
  },
  farmSpaceAttendance: {
    kind: "farmSpaceAttendance",
    perm: "farm.attendance.view",
    icon: "CalendarCheck",
    a: "primary",
    label: { en: "Attendance", hi: "उपस्थिति", bn: "উপস্থিতি" },
    desc: { en: "Who is working today", hi: "आज कौन काम कर रहा है", bn: "আজ কে কাজ করছে" }
  },
  farmSpaceAnnouncements: {
    kind: "farmSpaceAnnouncements",
    perm: "farm.view",
    icon: "Megaphone",
    a: "orange",
    label: { en: "Announcements", hi: "घोषणाएँ", bn: "ঘোষণা" },
    desc: { en: "Notices for the farm", hi: "फार्म के लिए सूचनाएं", bn: "খামারের জন্য বিজ্ঞপ্তি" }
  },
  farmSpaceChat: {
    kind: "farmSpaceChat",
    perm: "farm.chat.view",
    icon: "MessageCircle",
    a: "blue",
    label: { en: "Farm chat", hi: "फार्म चैट", bn: "খামার চ্যাট" },
    desc: { en: "Talk to the team", hi: "टीम से बात करें", bn: "দলের সাথে কথা বলুন" }
  },
  farmSpaceActivity: {
    kind: "farmSpaceActivity",
    perm: "farm.view",
    icon: "Activity",
    a: "primary",
    label: { en: "Activity", hi: "गतिविधि", bn: "কর্মকাণ্ড" },
    desc: { en: "What happened recently", hi: "हाल ही में क्या हुआ", bn: "সম্প্রতি কি হয়েছে" }
  },
  farmSpaceNotifications: {
    kind: "farmSpaceNotifications",
    perm: "farm.view",
    icon: "Bell",
    a: "orange",
    label: { en: "Notifications", hi: "सूचनाएँ", bn: "বিজ্ঞপ্তি" },
    desc: { en: "Alerts for hives, ponds, fields & tasks", hi: "अलर्ट", bn: "সতর্কতা" }
  },

  // Optional Operational Modules
  poultryDashboard: {
    kind: "poultryDashboard",
    perm: "farm.poultry.view",
    icon: "Bird",
    a: "orange",
    label: { en: "Poultry", hi: "पोल्ट्री", bn: "হাঁস-মুরগি" },
    desc: { en: "Broiler batch tracking & records", hi: "ब्रॉयलर बैच ट्रैकिंग और रिकॉर्ड", bn: "ব্রয়লার ব্যাচ ট্র্যাকিং এবং রেকর্ড" }
  },
  dairyDashboard: {
    kind: "dairyDashboard",
    perm: "farm.dairy.view",
    icon: "Milk",
    a: "blue",
    label: { en: "Dairy", hi: "डेयरी", bn: "দুগ্ধ" },
    desc: { en: "Animal herd, milk records & history", hi: "पशु झुंड, दूध रिकॉर्ड और इतिहास", bn: "পশুর পাল, দুধের রেকর্ড এবং ইতিহাস" }
  },
  goatDashboard: {
    kind: "goatDashboard",
    perm: "farm.goat.view",
    icon: "Beef",
    a: "primary",
    label: { en: "Goat & Sheep", hi: "बकरी और भेड़", bn: "ছাগল ও ভেড়া" },
    desc: { en: "Small ruminant herd, milk & weight records", hi: "छोटे जुगाली करने वाले झुंड, दूध और वजन रिकॉर्ड", bn: "ছোট রুমিন্যান্ট পাল, দুধ এবং ওজনের রেকর্ড" }
  },
  pigDashboard: {
    kind: "pigDashboard",
    perm: "farm.pig.view",
    icon: "PiggyBank",
    a: "orange",
    label: { en: "Pig & Swine", hi: "सुअर और स्वाइन", bn: "শূকর ও সোয়াইন" },
    desc: { en: "Swine herd, weight & health records", hi: "स्वाइन झुंड, वजन और स्वास्थ्य रिकॉर्ड", bn: "সোয়াইন পাল, ওজন এবং স্বাস্থ্য রেকর্ড" }
  },
  fishDashboard: {
    kind: "fishDashboard",
    perm: "farm.fish.view",
    icon: "Fish",
    a: "blue",
    label: { en: "Fish & Aqua", hi: "मछली और एक्वा", bn: "মাছ এবং অ্যাকোয়া" },
    desc: { en: "Pond management, feed, water quality", hi: "तालाब प्रबंधन, फ़ीड, पानी की गुणवत्ता", bn: "পুকুর ব্যবস্থাপনা, ফিড, জলের গুণমান" }
  },
  beeDashboard: {
    kind: "beeDashboard",
    perm: "farm.bee.view",
    icon: "Hexagon",
    a: "orange",
    label: { en: "Beekeeping", hi: "मधुमक्खी पालन", bn: "মৌমাছি পালন" },
    desc: { en: "Hive management, inspections, honey harvest", hi: "छत्ता प्रबंधन, निरीक्षण, शहद की फसल", bn: "মৌচাক ব্যবস্থাপনা, পরিদর্শন, মধু ফসল" }
  },
  cropDashboard: {
    kind: "cropDashboard",
    perm: "farm.crop.view",
    icon: "Sprout",
    a: "primary",
    label: { en: "Crop & Fields", hi: "फसल और खेत", bn: "ফসল ও মাঠ" },
    desc: { en: "Field management, sowing, activities, harvest", hi: "क्षेत्र प्रबंधन, बुवाई, गतिविधियां, फसल", bn: "মাঠ ব্যবস্থাপনা, বপন, কার্যক্রম, ফসল" }
  },
  farmSpaceAnalytics: {
    kind: "farmSpaceAnalytics",
    perm: "farm.view",
    icon: "BarChart2",
    a: "primary",
    label: { en: "Analytics", hi: "एनालिटिक्स", bn: "বিশ্লেষণ" },
    desc: { en: "Cross-module revenue, cost & profit trends", hi: "क्रॉस-मॉड्यूल राजस्व, लागत और लाभ रुझान", bn: "ক্রস-মডিউল রাজস্ব, খরচ এবং লাভের প্রবণতা" }
  }
};

export const CORE_MODULES_ORDER = [
  "farmSpaceTeam",
  "farmSpaceTasks",
  "farmSpaceAttendance",
  "farmSpaceAnnouncements",
  "farmSpaceChat",
  "farmSpaceActivity",
  "farmSpaceNotifications",
];

export const OPTIONAL_MODULES_ORDER = [
  "poultryDashboard",
  "dairyDashboard",
  "goatDashboard",
  "pigDashboard",
  "fishDashboard",
  "beeDashboard",
  "cropDashboard",
  "farmSpaceAnalytics",
];
