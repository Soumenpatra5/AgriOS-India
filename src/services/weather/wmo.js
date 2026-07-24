/* WMO weather-interpretation codes → human condition + app icon name.
   Shared by every weather provider so the UI never sees provider-specific codes.
   Icon names resolve through src/components/Icon.jsx (lucide-react). */

const MAP = {
  0:  { label: "Clear sky",            icon: "Sun" },
  1:  { label: "Mainly clear",         icon: "Sun" },
  2:  { label: "Partly cloudy",        icon: "CloudSun" },
  3:  { label: "Overcast",             icon: "Cloud" },
  45: { label: "Fog",                  icon: "CloudFog" },
  48: { label: "Rime fog",             icon: "CloudFog" },
  51: { label: "Light drizzle",        icon: "CloudDrizzle" },
  53: { label: "Drizzle",              icon: "CloudDrizzle" },
  55: { label: "Heavy drizzle",        icon: "CloudDrizzle" },
  56: { label: "Freezing drizzle",     icon: "CloudDrizzle" },
  57: { label: "Freezing drizzle",     icon: "CloudDrizzle" },
  61: { label: "Light rain",           icon: "CloudRain" },
  63: { label: "Rain",                 icon: "CloudRain" },
  65: { label: "Heavy rain",           icon: "CloudRain" },
  66: { label: "Freezing rain",        icon: "CloudRain" },
  67: { label: "Freezing rain",        icon: "CloudRain" },
  71: { label: "Light snow",           icon: "Snowflake" },
  73: { label: "Snow",                 icon: "Snowflake" },
  75: { label: "Heavy snow",           icon: "Snowflake" },
  77: { label: "Snow grains",          icon: "Snowflake" },
  80: { label: "Light showers",        icon: "CloudRain" },
  81: { label: "Showers",              icon: "CloudRain" },
  82: { label: "Violent showers",      icon: "CloudRain" },
  85: { label: "Snow showers",         icon: "Snowflake" },
  86: { label: "Snow showers",         icon: "Snowflake" },
  95: { label: "Thunderstorm",         icon: "CloudLightning" },
  96: { label: "Thunderstorm + hail",  icon: "CloudLightning" },
  99: { label: "Thunderstorm + hail",  icon: "CloudLightning" },
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
