/* AgriOS weather proxy — optional serverless function for KEYED weather
   providers (e.g. OpenWeather). The API key lives ONLY here, never in the
   browser. The default app path uses keyless Open-Meteo directly and does not
   touch this function at all.

   Setup (only if you want a keyed provider): add OPENWEATHER_API_KEY in
   Vercel → Project → Settings → Environment Variables. Until then this returns
   503 and the client falls back to Open-Meteo automatically. */

import { verifyToken } from "./_middleware/verifyAuth.js";
import { rateLimit } from "./_lib/rateLimit.js";

const OW_URL = "https://api.openweathermap.org/data/2.5/forecast";
const RATE = { windowMs: 60_000, max: 30 };

const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);

export default async function handler(req, res) {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: { message: "Unauthorized" } });
  if (req.method !== "POST") return res.status(405).json({ error: { message: "POST only" } });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const rateLimitKey = `weather:${decoded?.sub || ip}`;
  if (await rateLimit({ key: rateLimitKey, max: RATE.max, windowMs: RATE.windowMs })) {
    return res.status(429).json({ error: { message: "Too many requests. Please wait a minute." } });
  }

  const { provider = "openweather", lat, lon } = req.body || {};
  if (num(lat) === null || num(lon) === null) {
    return res.status(400).json({ error: { message: "valid lat/lon required" } });
  }
  if (provider !== "openweather") {
    return res.status(400).json({ error: { message: "unknown provider" } });
  }

  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return res.status(503).json({ error: { message: "Keyed weather provider is not configured on the server." } });
  }

  const url = `${OW_URL}?lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
  const upstream = await fetch(url);
  if (!upstream.ok) {
    console.error(`OpenWeather upstream error: status=${upstream.status}`);
    return res.status(upstream.status).json({ error: { message: "Weather data is currently unavailable." } });
  }
  const d = await upstream.json();
  // Minimal normalization to the app shape. Extend when this provider is adopted.
  const first = d.list?.[0] || {};
  res.status(200).json({
    location: { lat, lon, timezone: d.city?.timezone },
    current: {
      temp: Math.round(first.main?.temp),
      feelsLike: Math.round(first.main?.feels_like),
      humidity: first.main?.humidity,
      windSpeed: Math.round((first.wind?.speed || 0) * 3.6),
      windDir: first.wind?.deg,
      pressure: first.main?.pressure ?? null,
      isDay: true,
      weatherCode: 2,
      condition: first.weather?.[0]?.description || "—",
      icon: "CloudSun",
      time: first.dt_txt,
    },
    hourly: [],
    daily: [],
    provider: "openweather",
    updatedAt: Date.now(),
  });
}
