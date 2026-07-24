/* AI Farm Weather Advisor — generates dynamic, category-specific farming
   recommendations from weather conditions. Pure function, no I/O.
   Every recommendation is computed from live data, never hardcoded. */

import { isThunder, isHeavyRain, isFog, isHail } from "./wmo.js";

const hrs = (hourly, n) => (hourly || []).slice(0, n);

export function buildFarmAdvice(weather) {
  if (!weather) return [];
  const advice = [];
  const cur = weather.current || {};
  const next48 = hrs(weather.hourly, 48);
  const days = weather.daily || [];
  const today = days[0] || {};

  const maxPrecipProb = Math.max(0, ...next48.map(h => h.precipProb ?? 0));
  const totalPrecip48 = next48.reduce((s, h) => s + (h.precip ?? 0), 0);
  const maxWind = Math.max(cur.windSpeed || 0, cur.windGust || 0, today.windMax || 0, today.windGustMax || 0);
  const maxHumidity = Math.max(cur.humidity || 0, ...next48.slice(0, 24).map(h => h.humidity ?? 0));
  const thunderSoon = next48.some(h => isThunder(h.weatherCode));
  const heavyRainSoon = next48.some(h => isHeavyRain(h.weatherCode));
  const fogSoon = next48.slice(0, 12).some(h => isFog(h.weatherCode));
  const hailSoon = next48.some(h => isHail(h.weatherCode));
  const uvHigh = (today.uvMax ?? 0) >= 8;
  const tempMax = today.tempMax ?? cur.temp ?? 30;
  const tempMin = today.tempMin ?? cur.temp ?? 20;

  // Heat wave: ≥42°C
  const heatWave = tempMax >= 42 || (days.length >= 2 && days[0].tempMax >= 40 && days[1].tempMax >= 40);
  // Cold wave: ≤4°C
  const coldWave = tempMin <= 4 || (days.length >= 2 && days[0].tempMin <= 6 && days[1].tempMin <= 6);
  // Cyclone risk: thunder + heavy rain + high wind
  const cycloneRisk = thunderSoon && heavyRainSoon && maxWind >= 40;

  // --- SPRAYING ---
  if (heavyRainSoon || maxPrecipProb >= 70) {
    advice.push(mk("spray-rain", "spraying", "danger", "CloudRain",
      { en: "Avoid spraying — rain expected", hi: "छिड़काव न करें — बारिश की संभावना", bn: "স্প্রে করবেন না — বৃষ্টির সম্ভাবনা" },
      { en: `${maxPrecipProb}% rain chance in next 48h. Pesticides and foliar nutrients will wash off. Wait for a dry window of at least 4 hours after rain.`, hi: `अगले 48 घंटों में ${maxPrecipProb}% बारिश की संभावना। कीटनाशक और पोषक तत्व बह जाएँगे। बारिश के बाद कम से कम 4 घंटे सूखा मौसम प्रतीक्षा करें।`, bn: `পরবর্তী ৪৮ ঘণ্টায় ${maxPrecipProb}% বৃষ্টির সম্ভাবনা। কীটনাশক ও পুষ্টি ধুয়ে যাবে। বৃষ্টির পরে কমপক্ষে ৪ ঘণ্টা শুকনো আবহাওয়ার জন্য অপেক্ষা করুন।` }));
  } else if (maxWind >= 25) {
    advice.push(mk("spray-wind", "spraying", "warn", "Wind",
      { en: "Avoid spraying — strong wind", hi: "छिड़काव न करें — तेज़ हवा", bn: "স্প্রে করবেন না — তীব্র বাতাস" },
      { en: `Wind gusts up to ${maxWind} km/h. Spray drift will waste chemicals and may harm neighbouring crops. Also avoid drone spraying.`, hi: `हवा ${maxWind} किमी/घंटा तक। रसायन बर्बाद होगा और पड़ोसी फसलों को नुकसान हो सकता है। ड्रोन छिड़काव से भी बचें।`, bn: `বাতাস ${maxWind} কিমি/ঘণ্টা পর্যন্ত। রাসায়নিক নষ্ট হবে ও পার্শ্ববর্তী ফসলের ক্ষতি হতে পারে। ড্রোন স্প্রে থেকেও বিরত থাকুন।` }));
  } else if (fogSoon) {
    advice.push(mk("spray-fog", "spraying", "warn", "CloudFog",
      { en: "Delay spraying — fog expected", hi: "छिड़काव स्थगित — कोहरे की संभावना", bn: "স্প্রে স্থগিত — কুয়াশার সম্ভাবনা" },
      { en: "Dense fog reduces spray effectiveness. Wait for fog to lift before applying pesticides or foliar sprays.", hi: "घना कोहरा छिड़काव प्रभावशीलता कम करता है। कीटनाशक लगाने से पहले कोहरे के छँटने की प्रतीक्षा करें।", bn: "ঘন কুয়াশা স্প্রের কার্যকারিতা কমায়। কীটনাশক প্রয়োগের আগে কুয়াশা কাটার অপেক্ষা করুন।" }));
  } else if (maxPrecipProb <= 20 && maxWind < 15 && cur.temp <= 34 && !fogSoon) {
    advice.push(mk("spray-ok", "spraying", "good", "SprayCan",
      { en: "Good spraying window", hi: "छिड़काव के लिए अच्छा समय", bn: "স্প্রে করার উপযুক্ত সময়" },
      { en: "Low rain chance, gentle wind, moderate temperature. Ideal conditions for pesticide or foliar application.", hi: "कम बारिश, हल्की हवा, मध्यम तापमान। कीटनाशक या पत्ती पोषण के लिए आदर्श।", bn: "কম বৃষ্টি, মৃদু বাতাস, মাঝারি তাপমাত্রা। কীটনাশক বা পাতার পুষ্টির জন্য আদর্শ।" }));
  }

  // --- FERTILIZER ---
  if (heavyRainSoon || totalPrecip48 >= 30) {
    advice.push(mk("fert-rain", "fertilizer", "danger", "Droplets",
      { en: "Delay fertilizer — heavy rain ahead", hi: "उर्वरक देरी करें — भारी बारिश आ रही है", bn: "সার দেওয়া স্থগিত — ভারী বৃষ্টি আসছে" },
      { en: "Fertilizer will leach into waterways causing waste and pollution. Apply after rain stops and soil drains.", hi: "उर्वरक बह जाएगा जिससे बर्बादी और प्रदूषण होगा। बारिश रुकने और मिट्टी सूखने के बाद डालें।", bn: "সার ধুয়ে জলপথে যাবে, অপচয় ও দূষণ ঘটবে। বৃষ্টি থামার পর ও মাটি শুকিয়ে গেলে দিন।" }));
  } else if (heatWave) {
    advice.push(mk("fert-heat", "fertilizer", "warn", "Thermometer",
      { en: "Reduce nitrogen fertilizer in heat", hi: "गर्मी में नाइट्रोजन उर्वरक कम करें", bn: "গরমে নাইট্রোজেন সার কমান" },
      { en: "High temperatures cause rapid nitrogen volatilization. Apply urea in the evening and irrigate immediately after.", hi: "उच्च तापमान से नाइट्रोजन तेजी से उड़ जाता है। शाम को यूरिया डालें और तुरंत सिंचाई करें।", bn: "উচ্চ তাপমাত্রায় নাইট্রোজেন দ্রুত উড়ে যায়। সন্ধ্যায় ইউরিয়া দিন ও সাথে সাথে সেচ দিন।" }));
  }

  // --- HARVEST ---
  if (heavyRainSoon || totalPrecip48 >= 20) {
    advice.push(mk("harvest-rain", "harvest", "danger", "Wheat",
      { en: "Harvest immediately if crop is ready", hi: "फसल तैयार हो तो तुरंत कटाई करें", bn: "ফসল তৈরি হলে এখনই কাটুন" },
      { en: "Heavy rain will damage standing mature crops and harvested grain in the field. Cover harvested produce immediately.", hi: "भारी बारिश खड़ी पकी फसल और खेत में रखे अनाज को नुकसान पहुँचाएगी। कटा हुआ अनाज तुरंत ढकें।", bn: "ভারী বৃষ্টি দাঁড়িয়ে থাকা পাকা ফসল ও মাঠে রাখা শস্যের ক্ষতি করবে। কাটা ফসল এখনই ঢেকে দিন।" }));
  }
  if (maxHumidity >= 85 && cur.temp >= 20) {
    advice.push(mk("harvest-dry", "harvest", "warn", "Sun",
      { en: "Dry harvested grain properly", hi: "कटे अनाज को ठीक से सुखाएँ", bn: "কাটা শস্য ভালো করে শুকান" },
      { en: "High humidity slows drying and promotes mold growth on stored grain. Use mechanical dryers if available.", hi: "उच्च आर्द्रता सुखाने को धीमा करती है और भंडारित अनाज में फफूंद बढ़ाती है। यदि संभव हो तो मशीनी ड्रायर का उपयोग करें।", bn: "উচ্চ আর্দ্রতা শুকানো ধীর করে ও সংরক্ষিত শস্যে ছত্রাক বাড়ায়। সম্ভব হলে যান্ত্রিক ড্রায়ার ব্যবহার করুন।" }));
  }

  // --- SOWING ---
  if (coldWave) {
    advice.push(mk("sow-cold", "sowing", "warn", "Snowflake",
      { en: "Protect nurseries and seedlings", hi: "नर्सरी और पौध की रक्षा करें", bn: "নার্সারি ও চারা রক্ষা করুন" },
      { en: `Temperatures dropping to ${tempMin}°C. Cover seedbeds with plastic mulch or straw. Delay transplanting until the cold wave passes.`, hi: `तापमान ${tempMin}°C तक गिर रहा है। बीजों की क्यारियों को प्लास्टिक या भूसे से ढकें। ठंड लहर गुजरने तक रोपाई टालें।`, bn: `তাপমাত্রা ${tempMin}°C পর্যন্ত নামছে। বীজতলা প্লাস্টিক বা খড় দিয়ে ঢাকুন। শীতলহর কাটা পর্যন্ত রোপণ স্থগিত করুন।` }));
  }

  // --- IRRIGATION ---
  if (heatWave) {
    advice.push(mk("irr-heat", "irrigation", "danger", "Droplets",
      { en: "Increase irrigation — heat stress", hi: "सिंचाई बढ़ाएँ — लू का तनाव", bn: "সেচ বাড়ান — তাপ চাপ" },
      { en: `Temperature reaching ${tempMax}°C. Irrigate in early morning (5-7 AM) or evening (6-8 PM). Avoid midday watering — evaporation wastes water.`, hi: `तापमान ${tempMax}°C तक। सुबह 5-7 या शाम 6-8 बजे सिंचाई करें। दोपहर में पानी न दें — वाष्पीकरण से पानी बर्बाद होता है।`, bn: `তাপমাত্রা ${tempMax}°C পর্যন্ত। সকাল ৫-৭ বা সন্ধ্যা ৬-৮টায় সেচ দিন। দুপুরে পানি দেবেন না — বাষ্পীভবনে জল নষ্ট হয়।` }));
  } else if (heavyRainSoon && totalPrecip48 >= 25) {
    advice.push(mk("irr-rain", "irrigation", "info", "CloudRain",
      { en: "Skip irrigation — rain incoming", hi: "सिंचाई छोड़ें — बारिश आ रही है", bn: "সেচ বাদ দিন — বৃষ্টি আসছে" },
      { en: "Natural rainfall will provide sufficient moisture. Save water and energy by skipping the next irrigation cycle.", hi: "प्राकृतिक वर्षा पर्याप्त नमी देगी। अगली सिंचाई छोड़कर पानी और ऊर्जा बचाएँ।", bn: "প্রাকৃতিক বৃষ্টি পর্যাপ্ত আর্দ্রতা দেবে। পরবর্তী সেচ বাদ দিয়ে জল ও শক্তি সাশ্রয় করুন।" }));
  }
  if (uvHigh) {
    advice.push(mk("irr-uv", "irrigation", "warn", "Sun",
      { en: "Irrigate in evening — high UV", hi: "शाम को सिंचाई करें — उच्च UV", bn: "সন্ধ্যায় সেচ দিন — উচ্চ UV" },
      { en: `UV index ${today.uvMax}. Irrigate in the evening to reduce evaporation loss and prevent leaf burn from water droplets acting as lenses.`, hi: `UV सूचकांक ${today.uvMax}। शाम को सिंचाई करें ताकि वाष्पीकरण कम हो और पानी की बूँदों से पत्ती जलन न हो।`, bn: `UV সূচক ${today.uvMax}। সন্ধ্যায় সেচ দিন যাতে বাষ্পীভবন কম হয় ও জলবিন্দু থেকে পাতা পোড়া না হয়।` }));
  }

  // --- LIVESTOCK ---
  if (heatWave) {
    advice.push(mk("live-heat", "livestock", "danger", "Thermometer",
      { en: "Protect livestock from heat stress", hi: "पशुओं को लू से बचाएँ", bn: "পশুদের তাপ থেকে রক্ষা করুন" },
      { en: "Provide shade, cold drinking water, and fans in sheds. Reduce feed during peak heat. Add electrolytes to poultry water. Avoid transport during midday.", hi: "छाया, ठंडा पीने का पानी और शेड में पंखे दें। चरम गर्मी में चारा कम करें। मुर्गी के पानी में इलेक्ट्रोलाइट मिलाएँ।", bn: "ছায়া, ঠান্ডা পানীয় জল ও শেডে পাখা দিন। চরম গরমে খাবার কমান। হাঁস-মুরগির জলে ইলেক্ট্রোলাইট যোগ করুন।" }));
  }
  if (coldWave) {
    advice.push(mk("live-cold", "livestock", "warn", "Snowflake",
      { en: "Keep livestock warm", hi: "पशुओं को गर्म रखें", bn: "পশুদের উষ্ণ রাখুন" },
      { en: "Maintain poultry shed temperature above 20°C. Add extra bedding straw. Provide warm drinking water to dairy cattle.", hi: "मुर्गी शेड का तापमान 20°C से ऊपर रखें। अतिरिक्त भूसा बिछाएँ। दुधारू पशुओं को गुनगुना पानी दें।", bn: "হাঁস-মুরগির শেড ২০°C-র উপরে রাখুন। অতিরিক্ত খড় বিছান। দুগ্ধ গবাদিকে কুসুম গরম জল দিন।" }));
  }
  if (cycloneRisk || (maxWind >= 50 && thunderSoon)) {
    advice.push(mk("live-storm", "livestock", "critical", "AlertTriangle",
      { en: "Emergency — secure all livestock", hi: "आपातकाल — सभी पशुओं को सुरक्षित करें", bn: "জরুরি — সব পশু সুরক্ষিত করুন" },
      { en: "Severe storm approaching. Move all animals to secure shelter. Check shed roofing and tie-downs. Stock emergency feed and water.", hi: "गंभीर तूफान आ रहा है। सभी जानवरों को मज़बूत आश्रय में ले जाएँ। शेड की छत और बंधन जाँचें।", bn: "তীব্র ঝড় আসছে। সব পশুকে নিরাপদ আশ্রয়ে নিন। শেডের ছাদ ও বাঁধন পরীক্ষা করুন।" }));
  }

  // --- FISH POND ---
  if (heavyRainSoon && totalPrecip48 >= 40) {
    advice.push(mk("fish-rain", "fishPond", "danger", "Waves",
      { en: "Check fish pond bunds", hi: "मछली तालाब की मेड़ जाँचें", bn: "মাছের পুকুরের বাঁধ পরীক্ষা করুন" },
      { en: "Heavy rainfall may cause pond overflow and fish escape. Reinforce bunds, install overflow pipes, and raise net barriers.", hi: "भारी बारिश से तालाब उफन सकता है और मछली भाग सकती है। मेड़ मज़बूत करें और जाल लगाएँ।", bn: "ভারী বৃষ্টিতে পুকুর উপচে মাছ পালাতে পারে। বাঁধ শক্ত করুন ও জাল লাগান।" }));
  }
  if (heatWave) {
    advice.push(mk("fish-heat", "fishPond", "warn", "Thermometer",
      { en: "Monitor pond oxygen levels", hi: "तालाब ऑक्सीजन स्तर जाँचें", bn: "পুকুরের অক্সিজেন মাত্রা পরীক্ষা করুন" },
      { en: "Hot weather reduces dissolved oxygen. Run aerators, reduce feeding, and watch for fish surfacing (gasping) — a sign of oxygen depletion.", hi: "गर्मी से घुलित ऑक्सीजन कम होती है। एरेटर चलाएँ, चारा कम करें, मछली ऊपर आकर हवा लेती दिखे तो सतर्क रहें।", bn: "গরমে দ্রবীভূত অক্সিজেন কমে। এয়ারেটর চালান, খাবার কমান, মাছ উপরে উঠে হাঁপালে সতর্ক হন।" }));
  }

  // --- BEEKEEPING ---
  if (heavyRainSoon) {
    advice.push(mk("bee-rain", "beekeeping", "warn", "CloudRain",
      { en: "Protect beehives from rain", hi: "मधुमक्खी के छत्ते बारिश से बचाएँ", bn: "মৌচাক বৃষ্টি থেকে রক্ষা করুন" },
      { en: "Rain reduces foraging time and can waterlog hives. Tilt hives slightly forward for drainage and provide rain covers.", hi: "बारिश चारागाह समय कम करती है। जल निकासी के लिए छत्ते आगे झुकाएँ और वर्षा कवर लगाएँ।", bn: "বৃষ্টি চারণ সময় কমায়। জল নিষ্কাশনের জন্য মৌচাক সামনে কাত করুন ও বৃষ্টি আবরণ দিন।" }));
  }
  if (heatWave) {
    advice.push(mk("bee-heat", "beekeeping", "warn", "Sun",
      { en: "Shade beehives in extreme heat", hi: "अत्यधिक गर्मी में छत्तों को छाया दें", bn: "তীব্র গরমে মৌচাকে ছায়া দিন" },
      { en: "Place hives under shade or use wet cloth covers. Provide water source near hives. Bees expend energy cooling the hive instead of foraging.", hi: "छत्ते छाया में रखें या गीला कपड़ा ढकें। छत्तों के पास पानी रखें।", bn: "মৌচাক ছায়ায় রাখুন বা ভেজা কাপড়ে ঢাকুন। চাকের কাছে জলের ব্যবস্থা রাখুন।" }));
  }

  // --- DISEASE PRESSURE (cross-category) ---
  if (maxHumidity >= 85 && cur.temp >= 20 && cur.temp <= 32 && maxPrecipProb >= 40) {
    advice.push(mk("disease-risk", "spraying", "warn", "Bug",
      { en: "High fungal disease risk", hi: "फफूंद रोग का उच्च जोखिम", bn: "ছত্রাক রোগের উচ্চ ঝুঁকি" },
      { en: "Warm, humid, wet conditions favour blast, blight, and downy mildew. Scout crops closely and apply preventive fungicide after rain stops.", hi: "गर्म, नम, गीली स्थितियाँ ब्लास्ट, झुलसा और डाउनी मिल्ड्यू को बढ़ावा देती हैं। फसलों की जाँच करें और बारिश रुकने के बाद रोगनाशक छिड़कें।", bn: "উষ্ণ, আর্দ্র, ভেজা পরিস্থিতি ব্লাস্ট, ব্লাইট ও ডাউনি মিলডিউ বাড়ায়। ফসল পরীক্ষা করুন ও বৃষ্টি থামলে প্রতিরোধক ছত্রাকনাশক দিন।" }));
  }

  // Sort by severity
  const RANK = { critical: 0, danger: 1, warn: 2, info: 3, good: 4 };
  advice.sort((a, b) => (RANK[a.severity] ?? 5) - (RANK[b.severity] ?? 5));

  return advice;
}

function mk(id, category, severity, icon, title, body) {
  return { id, category, severity, icon, title, body };
}
