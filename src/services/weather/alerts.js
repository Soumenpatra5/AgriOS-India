/* Severe weather alert engine — turns a normalized forecast into farmer-facing
   alerts with severity ranking and trilingual support.
   Pure function, no I/O, easy to unit-test.
   Severity: critical | danger | warn | info | good. */

import { isThunder, isHeavyRain, isFog, isHail } from "./wmo.js";

const hrs = (hourly, n) => (hourly || []).slice(0, n);
const RANK = { critical: 0, danger: 1, warn: 2, info: 3, good: 4 };

export function buildAlerts(weather) {
  if (!weather) return [];
  const alerts = [];
  const cur = weather.current || {};
  const next48 = hrs(weather.hourly, 48);
  const next24 = hrs(weather.hourly, 24);
  const days = weather.daily || [];
  const today = days[0] || {};

  const maxPrecipProb = Math.max(0, ...next24.map(h => h.precipProb ?? 0));
  const totalPrecip48 = next48.reduce((s, h) => s + (h.precip ?? 0), 0);
  const thunderSoon = next48.some(h => isThunder(h.weatherCode));
  const heavyRainSoon = next48.some(h => isHeavyRain(h.weatherCode));
  const hailSoon = next48.some(h => isHail(h.weatherCode));
  const fogSoon = next24.slice(0, 12).some(h => isFog(h.weatherCode));
  const maxWind = Math.max(cur.windSpeed || 0, cur.windGust || 0, today.windMax || 0, today.windGustMax || 0);
  const tempMax = today.tempMax ?? cur.temp ?? 30;
  const tempMin = today.tempMin ?? cur.temp ?? 20;
  const uvMax = today.uvMax ?? 0;

  // --- CRITICAL: Cyclone risk ---
  if (thunderSoon && heavyRainSoon && maxWind >= 40) {
    push(alerts, "cyclone-risk", "critical", "AlertTriangle",
      { en: "Cyclone / severe storm risk", hi: "चक्रवात / गंभीर तूफान का खतरा", bn: "ঘূর্ণিঝড় / তীব্র ঝড়ের ঝুঁকি" },
      { en: "Extreme weather conditions detected — thunderstorms with heavy rain and very high winds. Seek shelter immediately. Secure livestock and equipment. Do not venture into open fields.", hi: "अत्यंत खराब मौसम — गरज के साथ भारी बारिश और बहुत तेज़ हवा। तुरंत आश्रय लें। पशु और उपकरण सुरक्षित करें।", bn: "চরম আবহাওয়া — বজ্রপাত সহ ভারী বৃষ্টি ও অত্যন্ত তীব্র বাতাস। এখনই আশ্রয় নিন। পশু ও যন্ত্রপাতি সুরক্ষিত করুন।" });
  }

  // --- CRITICAL: Hailstorm ---
  if (hailSoon) {
    push(alerts, "hailstorm", "critical", "CloudHail",
      { en: "Hailstorm warning", hi: "ओलावृष्टि चेतावनी", bn: "শিলাবৃষ্টি সতর্কতা" },
      { en: "Hail expected. Cover standing crops with protective nets if possible. Move vehicles and livestock under covered shelter.", hi: "ओले पड़ने की संभावना। खड़ी फसलों को जाल से ढकें। वाहन और पशुओं को ढकी जगह में ले जाएँ।", bn: "শিলাবৃষ্টির সম্ভাবনা। দাঁড়িয়ে থাকা ফসল জাল দিয়ে ঢাকুন। যানবাহন ও পশু ঢাকা জায়গায় নিন।" });
  }

  // --- DANGER: Thunderstorm / Lightning ---
  if (thunderSoon && !hailSoon) {
    push(alerts, "thunderstorm", "danger", "CloudLightning",
      { en: "Thunderstorm & lightning risk", hi: "गरज और बिजली का खतरा", bn: "বজ্রপাত ও বিদ্যুতের ঝুঁকি" },
      { en: "Thunderstorms expected within 48h. Avoid open fields, tall trees, and metal structures. Unplug irrigation pumps during the storm.", hi: "48 घंटों में गरज की संभावना। खुले मैदान, ऊँचे पेड़ और धातु संरचनाओं से बचें। तूफान के दौरान सिंचाई पंप बंद करें।", bn: "৪৮ ঘণ্টায় বজ্রপাতের সম্ভাবনা। খোলা মাঠ, লম্বা গাছ ও ধাতব কাঠামো থেকে দূরে থাকুন। ঝড়ের সময় সেচ পাম্প বন্ধ করুন।" });
  }

  // --- DANGER: Flood risk ---
  if (totalPrecip48 >= 50 || (heavyRainSoon && (today.precipSum ?? 0) >= 40)) {
    push(alerts, "flood-risk", "danger", "Waves",
      { en: "Flood risk — very heavy rain", hi: "बाढ़ का खतरा — बहुत भारी बारिश", bn: "বন্যার ঝুঁকি — অত্যন্ত ভারী বৃষ্টি" },
      { en: `Expected ${Math.round(totalPrecip48)}mm rainfall in 48h. Low-lying fields may flood. Clear drainage channels and move stored grain to higher ground.`, hi: `48 घंटों में ${Math.round(totalPrecip48)} मिमी बारिश अपेक्षित। निचले खेतों में बाढ़ आ सकती है। नालियाँ साफ़ करें और अनाज ऊँची जगह रखें।`, bn: `৪৮ ঘণ্টায় ${Math.round(totalPrecip48)} মিমি বৃষ্টি প্রত্যাশিত। নিচু জমিতে বন্যা হতে পারে। নিকাশি পরিষ্কার করুন ও শস্য উঁচু জায়গায় রাখুন।` });
  }

  // --- DANGER: Heat wave ---
  if (tempMax >= 42 || (days.length >= 2 && days[0].tempMax >= 40 && days[1].tempMax >= 40)) {
    push(alerts, "heat-wave", "danger", "Thermometer",
      { en: "Heat wave alert", hi: "लू की चेतावनी", bn: "তাপপ্রবাহ সতর্কতা" },
      { en: `Temperature reaching ${tempMax}°C. Irrigate morning/evening only. Give livestock shade and extra water. Avoid field work between 11AM-4PM.`, hi: `तापमान ${tempMax}°C तक। केवल सुबह/शाम सिंचाई करें। पशुओं को छाया और अतिरिक्त पानी दें। 11-4 बजे खेत में काम न करें।`, bn: `তাপমাত্রা ${tempMax}°C পর্যন্ত। শুধু সকাল/সন্ধ্যায় সেচ দিন। পশুদের ছায়া ও বাড়তি জল দিন। সকাল ১১-বিকেল ৪টা মাঠে কাজ করবেন না।` });
  }

  // --- WARN: Heavy rain ---
  if ((heavyRainSoon || maxPrecipProb >= 70) && !alerts.find(a => a.id === "flood-risk")) {
    push(alerts, "heavy-rain", "warn", "Umbrella",
      { en: "Heavy rain expected", hi: "भारी बारिश की संभावना", bn: "ভারী বৃষ্টির সম্ভাবনা" },
      { en: `Rain likely within 48h (${maxPrecipProb}% chance). Hold off on spraying — chemicals will wash off. Cover harvested grain.`, hi: `48 घंटों में बारिश (${maxPrecipProb}% संभावना)। छिड़काव रोकें — रसायन बह जाएँगे। कटे अनाज को ढकें।`, bn: `৪৮ ঘণ্টায় বৃষ্টি (${maxPrecipProb}% সম্ভাবনা)। স্প্রে বন্ধ রাখুন — রাসায়নিক ধুয়ে যাবে। কাটা শস্য ঢেকে দিন।` });
  }

  // --- WARN: Cold wave ---
  if (tempMin <= 4 || (days.length >= 2 && days[0].tempMin <= 6 && days[1].tempMin <= 6)) {
    push(alerts, "cold-wave", "warn", "Snowflake",
      { en: "Cold wave / frost risk", hi: "शीत लहर / पाला का खतरा", bn: "শীতলহর / তুষারপাতের ঝুঁকি" },
      { en: `Temperature dropping to ${tempMin}°C. Protect nurseries with mulch. Light irrigation can reduce frost damage. Keep poultry sheds warm.`, hi: `तापमान ${tempMin}°C तक गिर रहा है। मल्चिंग से नर्सरी बचाएँ। हल्की सिंचाई पाले का नुकसान कम करती है।`, bn: `তাপমাত্রা ${tempMin}°C পর্যন্ত নামছে। মালচিং দিয়ে নার্সারি রক্ষা করুন। হালকা সেচ তুষারপাতের ক্ষতি কমায়।` });
  }

  // --- WARN: Strong wind ---
  if (maxWind >= 30) {
    push(alerts, "strong-wind", "warn", "Wind",
      { en: "Strong winds", hi: "तेज़ हवा", bn: "তীব্র বাতাস" },
      { en: `Winds up to ${maxWind} km/h. Avoid drone and boom spraying — drift wastes chemicals. Secure shade nets and poultry shed roofing.`, hi: `हवा ${maxWind} किमी/घंटा तक। ड्रोन और बूम छिड़काव से बचें। शेड नेट और मुर्गी शेड की छत को सुरक्षित करें।`, bn: `বাতাস ${maxWind} কিমি/ঘণ্টা পর্যন্ত। ড্রোন ও বুম স্প্রে থেকে বিরত থাকুন। শেড নেট ও হাঁস-মুরগির শেডের ছাদ সুরক্ষিত করুন।` });
  }

  // --- WARN: Dense fog ---
  if (fogSoon) {
    push(alerts, "dense-fog", "warn", "CloudFog",
      { en: "Dense fog expected", hi: "घना कोहरा अपेक्षित", bn: "ঘন কুয়াশা প্রত্যাশিত" },
      { en: "Visibility will be very low. Delay pesticide spraying until fog lifts. Drive slowly on rural roads.", hi: "दृश्यता बहुत कम होगी। कोहरा छँटने तक कीटनाशक छिड़काव स्थगित करें।", bn: "দৃশ্যমানতা খুব কম হবে। কুয়াশা কাটা পর্যন্ত কীটনাশক স্প্রে স্থগিত করুন।" });
  }

  // --- WARN: High UV ---
  if (uvMax >= 10) {
    push(alerts, "high-uv", "warn", "Sun",
      { en: "Very high UV index", hi: "बहुत अधिक UV सूचकांक", bn: "অত্যন্ত উচ্চ UV সূচক" },
      { en: `UV index ${uvMax}. Wear protective clothing in the field. Irrigate in evening to reduce evaporation. Workers should take breaks in shade.`, hi: `UV सूचकांक ${uvMax}। खेत में सुरक्षात्मक कपड़े पहनें। शाम को सिंचाई करें।`, bn: `UV সূচক ${uvMax}। মাঠে প্রতিরক্ষামূলক কাপড় পরুন। সন্ধ্যায় সেচ দিন।` });
  }

  // --- WARN: Fungal disease pressure ---
  if ((cur.humidity ?? 0) >= 85 && cur.temp >= 20 && cur.temp <= 32 && maxPrecipProb >= 40) {
    push(alerts, "disease", "warn", "Bug",
      { en: "Fungal disease pressure", hi: "फफूंद रोग का दबाव", bn: "ছত্রাক রোগের চাপ" },
      { en: "Warm, humid and wet — conditions favour blast, blight and mildew. Scout crops and consider preventive fungicide after rain.", hi: "गर्म, नम और गीला — ब्लास्ट, झुलसा और फफूंदी के अनुकूल। फसल जाँचें और बारिश बाद रोगनाशक लगाएँ।", bn: "উষ্ণ, আর্দ্র ও ভেজা — ব্লাস্ট, ব্লাইট ও মিলডিউ অনুকূল। ফসল পরীক্ষা করুন ও বৃষ্টি পরে ছত্রাকনাশক দিন।" });
  }

  // --- GOOD: Spray window ---
  if (maxPrecipProb <= 20 && maxWind < 15 && cur.temp <= 34 && !fogSoon && !alerts.find(a => a.severity === "danger" || a.severity === "critical")) {
    push(alerts, "spray-ok", "good", "SprayCan",
      { en: "Good spraying window", hi: "छिड़काव के लिए अच्छा समय", bn: "স্প্রে করার উপযুক্ত সময়" },
      { en: "Low rain chance, gentle wind, moderate temperature — ideal for pesticide or foliar nutrient application.", hi: "कम बारिश, हल्की हवा, मध्यम तापमान — कीटनाशक या पत्ती पोषण के लिए आदर्श।", bn: "কম বৃষ্টি, মৃদু বাতাস, মাঝারি তাপমাত্রা — কীটনাশক বা পাতার পুষ্টির জন্য আদর্শ।" });
  }

  // Sort by severity rank
  alerts.sort((a, b) => (RANK[a.severity] ?? 5) - (RANK[b.severity] ?? 5));
  return alerts;
}

function push(arr, id, severity, icon, titleI18n, bodyI18n) {
  arr.push({
    id, severity, icon,
    title: titleI18n.en,
    body: bodyI18n.en,
    titleI18n,
    bodyI18n,
  });
}
