/* OpenWeather provider adapter (keyed) — routed through the serverless proxy so
   the API key NEVER reaches the browser. The proxy (api/weather.js) reads
   OPENWEATHER_API_KEY from the environment. Disabled until that key is set;
   the registry falls back to Open-Meteo automatically.

   This file exists to prove the provider seam: swapping weather sources is a
   registry change, not a rewrite. Wire the normalize() when the key is added. */

const PROXY_URL = "/api/weather";

export const openWeatherProvider = {
  id: "openweather",
  label: "OpenWeather",
  requiresKey: true,

  async fetchWeather({ lat, lon }, { signal } = {}) {
    const { authFetch } = await import("../../firebase/authFetch.js");
    const res = await authFetch(PROXY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "openweather", lat, lon }),
      signal,
    });
    if (res.status === 503) throw new Error("provider not configured on server");
    if (!res.ok) throw new Error(`weather proxy error (${res.status})`);
    // The proxy is expected to return the app's normalized shape.
    return res.json();
  },
};
