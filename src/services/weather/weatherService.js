/* Weather service — the single entry point the UI and the AI tool both use.
   Production-grade: caching (offline-first), retry with backoff, request timeout,
   provider selection, alert + farm advice derivation, background refresh.
   Keeps the app independent of any specific weather API. */

import { getWeatherProvider } from "./weatherProvider.js";
import { buildAlerts } from "./alerts.js";
import { buildFarmAdvice } from "./farmAdvisor.js";
import { ttlCache } from "../cache/ttlCache.js";

const TTL = 15 * 60 * 1000; // 15 min
const TIMEOUT = 15_000; // 15s request timeout
const MAX_RETRIES = 2;

const key = (lat, lon) => `weather:${lat.toFixed(2)},${lon.toFixed(2)}`;

async function withRetry(fn, retries = MAX_RETRIES) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

export const weatherService = {
  /* Returns { weather, alerts, advice, fromCache, stale }.
     - Serves fresh cache instantly when available.
     - Falls back to the last cached value if the network fails (rural reality).
     - Retries with exponential backoff on transient failures. */
  async get({ lat, lon, providerId, force = false } = {}) {
    if (lat == null || lon == null) throw new Error("weatherService.get: lat/lon required");
    const ck = key(lat, lon);

    if (!force) {
      const fresh = ttlCache.get(ck);
      if (fresh) return derive(fresh, true, false);
    }

    try {
      const weather = await withRetry(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT);
        const provider = getWeatherProvider(providerId);
        return provider.fetchWeather({ lat, lon }, { signal: controller.signal })
          .finally(() => clearTimeout(timer));
      });
      ttlCache.set(ck, weather, TTL);
      return derive(weather, false, false);
    } catch (err) {
      const cached = ttlCache.getStale(ck);
      if (cached?.value) return derive(cached.value, true, true);
      throw err;
    }
  },

  /* Register a background refresh that fires when the page becomes visible
     again and cache is stale. Returns cleanup function. */
  setupBackgroundRefresh(onRefresh) {
    const handler = () => {
      if (document.visibilityState !== "visible") return;
      onRefresh?.();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  },

  /* Compact summary string for the AI weather tool. */
  async summaryFor({ lat, lon, name }) {
    const { weather, alerts, advice } = await this.get({ lat, lon });
    const c = weather.current;
    const today = weather.daily?.[0] || {};
    const lines = [
      `Location: ${name || `${lat.toFixed(2)}, ${lon.toFixed(2)}`}`,
      `Model: ${weather.model || "unknown"}`,
      `Now: ${c.temp}°C (feels ${c.feelsLike}°C), ${c.condition}, humidity ${c.humidity}%, wind ${c.windSpeed} km/h (gust ${c.windGust}).`,
      `Dew point: ${c.dewPoint ?? "?"}°C, cloud cover: ${c.cloudCover ?? "?"}%.`,
      `Today: high ${today.tempMax}°C / low ${today.tempMin}°C, rain chance ${today.precipProb ?? "?"}%, UV ${today.uvMax ?? "?"}.`,
    ];
    if (today.sunrise) lines.push(`Sunrise: ${today.sunrise.split("T")[1] || today.sunrise}, Sunset: ${today.sunset?.split("T")[1] || today.sunset}.`);
    if (weather.daily?.length >= 3) {
      const outlook = weather.daily.slice(1, 4).map(d => `${d.date}: ${d.condition} ${d.tempMax}°/${d.tempMin}°`).join("; ");
      lines.push(`3-day outlook: ${outlook}.`);
    }
    if (alerts.length) lines.push("Alerts: " + alerts.map(a => a.title).join("; ") + ".");
    if (advice.length) lines.push("Farm advice: " + advice.slice(0, 3).map(a => a.title.en).join("; ") + ".");
    return lines.join("\n");
  },
};

function derive(weather, fromCache, stale) {
  return {
    weather,
    alerts: buildAlerts(weather),
    advice: buildFarmAdvice(weather),
    fromCache,
    stale,
  };
}
