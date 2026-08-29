/* WMO weather-interpretation codes → human condition + app icon name.
   Shared by every weather provider so the UI never sees provider-specific codes.
   Icon names resolve through src/components/Icon.jsx (lucide-react). */

/* label stays English — the alert engine and farmAdvisor reason about it
   and it goes into AI prompts. i18n is what the UI shows. */
const MAP = {
  0:  { label: "Clear sky", i18n: { en: "Clear sky", hi: "साफ़ आसमान", bn: "পরিষ্কার আকাশ" },            icon: "Sun" },
  1:  { label: "Mainly clear", i18n: { en: "Mainly clear", hi: "मुख्यतः साफ़", bn: "প্রধানত পরিষ্কার" },         icon: "Sun" },
  2:  { label: "Partly cloudy", i18n: { en: "Partly cloudy", hi: "आंशिक बादल", bn: "আংশিক মেঘলা" },        icon: "CloudSun" },
  3:  { label: "Overcast", i18n: { en: "Overcast", hi: "घने बादल", bn: "সম্পূর্ণ মেঘলা" },             icon: "Cloud" },
  45: { label: "Fog", i18n: { en: "Fog", hi: "कोहरा", bn: "কুয়াশা" },                  icon: "CloudFog" },
  48: { label: "Rime fog", i18n: { en: "Rime fog", hi: "तुषार कोहरा", bn: "তুষার কুয়াশা" },             icon: "CloudFog" },
  51: { label: "Light drizzle", i18n: { en: "Light drizzle", hi: "हल्की बूँदाबाँदी", bn: "হালকা গুঁড়ি বৃষ্টি" },        icon: "CloudDrizzle" },
  53: { label: "Drizzle", i18n: { en: "Drizzle", hi: "बूँदाबाँदी", bn: "গুঁড়ি বৃষ্টি" },              icon: "CloudDrizzle" },
  55: { label: "Heavy drizzle", i18n: { en: "Heavy drizzle", hi: "तेज़ बूँदाबाँदी", bn: "ভারী গুঁড়ি বৃষ্টি" },        icon: "CloudDrizzle" },
  56: { label: "Freezing drizzle", i18n: { en: "Freezing drizzle", hi: "जमा देने वाली बूँदाबाँदी", bn: "জমাট গুঁড়ি বৃষ্টি" },     icon: "CloudDrizzle" },
  57: { label: "Freezing drizzle", i18n: { en: "Freezing drizzle", hi: "जमा देने वाली बूँदाबाँदी", bn: "জমাট গুঁড়ি বৃষ্টি" },     icon: "CloudDrizzle" },
  61: { label: "Light rain", i18n: { en: "Light rain", hi: "हल्की बारिश", bn: "হালকা বৃষ্টি" },           icon: "CloudRain" },
  63: { label: "Rain", i18n: { en: "Rain", hi: "बारिश", bn: "বৃষ্টি" },                 icon: "CloudRain" },
  65: { label: "Heavy rain", i18n: { en: "Heavy rain", hi: "भारी बारिश", bn: "ভারী বৃষ্টি" },           icon: "CloudRain" },
  66: { label: "Freezing rain", i18n: { en: "Freezing rain", hi: "जमा देने वाली बारिश", bn: "জমাট বৃষ্টি" },        icon: "CloudRain" },
  67: { label: "Freezing rain", i18n: { en: "Freezing rain", hi: "जमा देने वाली बारिश", bn: "জমাট বৃষ্টি" },        icon: "CloudRain" },
  71: { label: "Light snow", i18n: { en: "Light snow", hi: "हल्की बर्फ़", bn: "হালকা তুষার" },           icon: "Snowflake" },
  73: { label: "Snow", i18n: { en: "Snow", hi: "बर्फ़", bn: "তুষার" },                 icon: "Snowflake" },
  75: { label: "Heavy snow", i18n: { en: "Heavy snow", hi: "भारी बर्फ़", bn: "ভারী তুষার" },           icon: "Snowflake" },
  77: { label: "Snow grains", i18n: { en: "Snow grains", hi: "बर्फ़ के कण", bn: "তুষারকণা" },          icon: "Snowflake" },
  80: { label: "Light showers", i18n: { en: "Light showers", hi: "हल्की बौछार", bn: "হালকা বর্ষণ" },        icon: "CloudRain" },
  81: { label: "Showers", i18n: { en: "Showers", hi: "बौछार", bn: "বর্ষণ" },              icon: "CloudRain" },
  82: { label: "Violent showers", i18n: { en: "Violent showers", hi: "तेज़ बौछार", bn: "প্রবল বর্ষণ" },      icon: "CloudRain" },
  85: { label: "Snow showers", i18n: { en: "Snow showers", hi: "बर्फ़ की बौछार", bn: "তুষার বর্ষণ" },         icon: "Snowflake" },
  86: { label: "Snow showers", i18n: { en: "Snow showers", hi: "बर्फ़ की बौछार", bn: "তুষার বর্ষণ" },         icon: "Snowflake" },
  95: { label: "Thunderstorm", i18n: { en: "Thunderstorm", hi: "आँधी-तूफ़ान", bn: "বজ্রঝড়" },         icon: "CloudLightning" },
  96: { label: "Thunderstorm + hail", i18n: { en: "Thunderstorm + hail", hi: "आँधी + ओले", bn: "বজ্রঝড় + শিলা" },  icon: "CloudLightning" },
  99: { label: "Thunderstorm + hail", i18n: { en: "Thunderstorm + hail", hi: "आँधी + ओले", bn: "বজ্রঝড় + শিলা" },  icon: "CloudLightning" },
};

export function describeWeather(code) {
  return MAP[code] || { label: "—", icon: "CloudSun" };
}

/* Groupings the alert engine reasons about. */
export const isThunder = (c) => c >= 95;
export const isRain = (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;
export const isHeavyRain = (c) => c === 65 || c === 82 || c >= 95;
export const isSnow = (c) => (c >= 71 && c <= 77) || c === 85 || c === 86;
export const isFog = (c) => c === 45 || c === 48;
export const isHail = (c) => c === 96 || c === 99;
