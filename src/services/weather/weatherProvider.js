/* Weather provider registry — the seam that keeps the app independent of any
   single weather source. Default is keyless Open-Meteo (ECMWF model); keyed
   providers can be added without changing UI or business logic.

   Future providers (implement fetchWeather({ lat, lon }) → normalized shape):
   • IMD (India Meteorological Department) — official Indian govt forecasts
   • Tomorrow.io — hyperlocal minute-level precipitation
   • WeatherAPI — backup commercial provider */

import { openMeteoProvider } from "./providers/openMeteo.js";
import { openWeatherProvider } from "./providers/openWeather.js";

const PROVIDERS = {
  [openMeteoProvider.id]: openMeteoProvider,
  [openWeatherProvider.id]: openWeatherProvider,
};

const MODEL_PREFS = {
  "open-meteo": ["ecmwf_ifs025", "gfs_seamless"],
};

const DEFAULT_ID = openMeteoProvider.id;

export function getWeatherProvider(id = DEFAULT_ID) {
  return PROVIDERS[id] || PROVIDERS[DEFAULT_ID];
}

export function listWeatherProviders() {
  return Object.values(PROVIDERS).map(({ id, label, requiresKey }) => ({ id, label, requiresKey }));
}

export function getModelPreference(providerId = DEFAULT_ID) {
  return MODEL_PREFS[providerId] || [];
}
