/* Open-Meteo weather provider — production-grade, keyless source.
   Uses ECMWF IFS 0.25° model with GFS fallback. Returns the app's
   normalized weather shape so the UI is provider-independent. */

import { describeWeather } from "../wmo.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const CURRENT_PARAMS = [
  "temperature_2m", "relative_humidity_2m", "apparent_temperature",
  "precipitation", "weather_code", "wind_speed_10m", "wind_direction_10m",
  "wind_gusts_10m", "surface_pressure", "cloud_cover", "dew_point_2m",
  "is_day",
];

const HOURLY_PARAMS = [
  "temperature_2m", "apparent_temperature", "precipitation",
  "precipitation_probability", "weather_code", "wind_speed_10m",
  "wind_gusts_10m", "relative_humidity_2m", "cloud_cover",
  "dew_point_2m", "visibility",
];

const DAILY_PARAMS = [
  "weather_code", "temperature_2m_max", "temperature_2m_min",
  "apparent_temperature_max", "apparent_temperature_min",
  "precipitation_probability_max", "precipitation_sum",
  "precipitation_hours", "wind_speed_10m_max", "wind_gusts_10m_max",
  "sunrise", "sunset", "uv_index_max",
];

function buildUrl(lat, lon, model) {
  const p = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    timezone: "auto",
    current: CURRENT_PARAMS.join(","),
    hourly: HOURLY_PARAMS.join(","),
    daily: DAILY_PARAMS.join(","),
    forecast_days: "10",
  });
  if (model) p.set("models", model);
  return `${FORECAST_URL}?${p.toString()}`;
}

export const openMeteoProvider = {
  id: "open-meteo",
  label: "Open-Meteo",
  requiresKey: false,

  async fetchWeather({ lat, lon }, { signal } = {}) {
    let res = await fetch(buildUrl(lat, lon, "ecmwf_ifs025"), { signal });
    if (!res.ok) throw new Error(`weather provider error (${res.status})`);
    let d = await res.json();

    // GFS fallback: if ECMWF returns null temperature, retry without model
    if (d.current?.temperature_2m == null) {
      res = await fetch(buildUrl(lat, lon, null), { signal });
      if (!res.ok) throw new Error(`weather fallback error (${res.status})`);
      d = await res.json();
      d._model = "gfs_seamless";
    } else {
      d._model = "ecmwf_ifs025";
    }

    return normalize(d, lat, lon);
  },
};

function normalize(d, lat, lon) {
  const cur = d.current || {};
  const curDesc = describeWeather(cur.weather_code);

  // Hourly — next 48 hours from current hour
  const H = d.hourly || {};
  const nowIdx = Math.max(0, (H.time || []).findIndex((t) => new Date(t) >= new Date()));
  const hourly = (H.time || []).slice(nowIdx, nowIdx + 48).map((time, i) => {
    const k = nowIdx + i;
    const desc = describeWeather(H.weather_code?.[k]);
    return {
      time,
      temp: Math.round(H.temperature_2m?.[k] ?? 0),
      feelsLike: Math.round(H.apparent_temperature?.[k] ?? H.temperature_2m?.[k] ?? 0),
      precip: H.precipitation?.[k] ?? 0,
      precipProb: H.precipitation_probability?.[k] ?? null,
      humidity: H.relative_humidity_2m?.[k] ?? null,
      windSpeed: Math.round(H.wind_speed_10m?.[k] ?? 0),
      windGust: Math.round(H.wind_gusts_10m?.[k] ?? 0),
      cloudCover: H.cloud_cover?.[k] ?? null,
      dewPoint: H.dew_point_2m?.[k] != null ? Math.round(H.dew_point_2m[k]) : null,
      visibility: H.visibility?.[k] != null ? Math.round(H.visibility[k] / 1000) : null, // km
      weatherCode: H.weather_code?.[k],
      condition: desc.label, conditionI18n: desc.i18n,
      icon: desc.icon,
    };
  });

  // Daily — 10 days
  const D = d.daily || {};
  const daily = (D.time || []).map((date, i) => ({
    date,
    tempMax: Math.round(D.temperature_2m_max?.[i] ?? 0),
    tempMin: Math.round(D.temperature_2m_min?.[i] ?? 0),
    feelsLikeMax: Math.round(D.apparent_temperature_max?.[i] ?? D.temperature_2m_max?.[i] ?? 0),
    feelsLikeMin: Math.round(D.apparent_temperature_min?.[i] ?? D.temperature_2m_min?.[i] ?? 0),
    precipProb: D.precipitation_probability_max?.[i] ?? null,
    precipSum: D.precipitation_sum?.[i] ?? 0,
    precipHours: D.precipitation_hours?.[i] ?? 0,
    windMax: Math.round(D.wind_speed_10m_max?.[i] ?? 0),
    windGustMax: Math.round(D.wind_gusts_10m_max?.[i] ?? 0),
    uvMax: D.uv_index_max?.[i] ?? null,
    sunrise: D.sunrise?.[i],
    sunset: D.sunset?.[i],
    weatherCode: D.weather_code?.[i],
    condition: describeWeather(D.weather_code?.[i]).label, conditionI18n: describeWeather(D.weather_code?.[i]).i18n,
    icon: describeWeather(D.weather_code?.[i]).icon,
  }));

  return {
    location: { lat, lon, timezone: d.timezone },
    current: {
      temp: Math.round(cur.temperature_2m ?? 0),
      feelsLike: Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 0),
      humidity: cur.relative_humidity_2m ?? null,
      precip: cur.precipitation ?? 0,
      windSpeed: Math.round(cur.wind_speed_10m ?? 0),
      windDir: cur.wind_direction_10m ?? null,
      windGust: Math.round(cur.wind_gusts_10m ?? 0),
      pressure: cur.surface_pressure != null ? Math.round(cur.surface_pressure) : null,
      cloudCover: cur.cloud_cover ?? null,
      dewPoint: cur.dew_point_2m != null ? Math.round(cur.dew_point_2m) : null,
      visibility: null, // not available in Open-Meteo current
      isDay: cur.is_day === 1,
      weatherCode: cur.weather_code,
      condition: curDesc.label, conditionI18n: curDesc.i18n,
      icon: curDesc.icon,
      time: cur.time,
    },
    hourly,
    daily,
    model: d._model || "unknown",
    provider: "open-meteo",
    updatedAt: Date.now(),
  };
}
