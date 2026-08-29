/* Nearby services — finds vets, markets, banks, fuel, agri-supply shops etc.
   around a coordinate using the keyless OpenStreetMap Overpass API. Results are
   cached (offline-first) and sorted by distance. Category → OSM tag mapping
   lives here so the UI stays declarative. */

import { ttlCache } from "../cache/ttlCache.js";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const TTL = 6 * 60 * 60 * 1000; // 6h — POIs rarely move

/* The `[timeout:20]` in the query is Overpass's SERVER-side budget for running
   the query — it does nothing for a connection that never gets that far. The
   public instance is free and heavily loaded, and when it is saturated the
   socket simply stalls: observed hanging past 30s with no response and no
   error. Without a deadline of our own the request never settles and the
   screen sits on a spinner forever, which is what a farmer sees as "not
   working". Bound it here so a stalled instance becomes a retryable error. */
const REQUEST_TIMEOUT_MS = 12000;

/* category id → { label, icon, accent, overpass filters } */
/* label stays English — it is the stored value, the text in CSV exports and
   the key reports group on. i18n is what the UI shows. */
export const NEARBY_CATEGORIES = [
  { id: "vet",     label: "Veterinary", icon: "Stethoscope", accent: "red",     filters: ['node["amenity"="veterinary"]'], i18n: { en: "Veterinary", hi: "पशु चिकित्सा", bn: "পশুচিকিৎসা" } },
  { id: "market",  label: "Markets",    icon: "Store",       accent: "orange",  filters: ['node["amenity"="marketplace"]', 'node["shop"="farm"]'], i18n: { en: "Markets", hi: "बाज़ार", bn: "বাজার" } },
  { id: "agri",    label: "Agri supply",icon: "Sprout",      accent: "primary", filters: ['node["shop"="agrarian"]', 'node["shop"="garden_centre"]'], i18n: { en: "Agri supply", hi: "कृषि आपूर्ति", bn: "কৃষি উপকরণ" } },
  { id: "bank",    label: "Banks & ATM",icon: "Building2",   accent: "blue",    filters: ['node["amenity"="bank"]', 'node["amenity"="atm"]'], i18n: { en: "Banks & ATM", hi: "बैंक व ATM", bn: "ব্যাঙ্ক ও ATM" } },
  { id: "fuel",    label: "Fuel",       icon: "Truck",       accent: "yellow",  filters: ['node["amenity"="fuel"]'], i18n: { en: "Fuel", hi: "ईंधन", bn: "জ্বালানি" } },
  { id: "hospital",label: "Health",     icon: "ShieldCheck", accent: "red",     filters: ['node["amenity"="hospital"]', 'node["amenity"="clinic"]'], i18n: { en: "Health", hi: "स्वास्थ्य", bn: "স্বাস্থ্য" } },
];

export function getCategory(id) {
  return NEARBY_CATEGORIES.find((c) => c.id === id) || NEARBY_CATEGORIES[0];
}

/* Haversine distance in km. */
function distanceKm(aLat, aLon, bLat, bLon) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function buildQuery(category, lat, lon, radiusM) {
  const around = `(around:${radiusM},${lat},${lon})`;
  const body = category.filters.map((f) => `${f}${around};`).join("");
  return `[out:json][timeout:20];(${body});out body 40;`;
}

export const nearbyService = {
  categories: NEARBY_CATEGORIES,

  /* Returns [{ id, name, lat, lon, distanceKm, category }], nearest first. */
  async find({ categoryId, lat, lon, radiusKm = 15, force = false }, { signal, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
    const category = getCategory(categoryId);
    const ck = `nearby:${categoryId}:${lat.toFixed(2)},${lon.toFixed(2)}:${radiusKm}`;

    if (!force) {
      const fresh = ttlCache.get(ck);
      if (fresh) return fresh;
    }

    /* Our own deadline, chained to the caller's signal so an unmounting screen
       still cancels. timedOut is tracked separately because an AbortError
       cannot say which of the two aborted it. */
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
    const relay = () => ctrl.abort();
    signal?.addEventListener("abort", relay, { once: true });

    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(buildQuery(category, lat, lon, radiusKm * 1000)),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`overpass error (${res.status})`);
      const d = await res.json();
      const items = (d.elements || [])
        .filter((e) => e.lat && e.lon)
        .map((e) => ({
          id: String(e.id),
          name: e.tags?.name || category.label,
          address: [e.tags?.["addr:street"], e.tags?.["addr:city"]].filter(Boolean).join(", "),
          phone: e.tags?.phone || e.tags?.["contact:phone"] || null,
          lat: e.lat,
          lon: e.lon,
          distanceKm: Math.round(distanceKm(lat, lon, e.lat, e.lon) * 10) / 10,
          category: categoryId,
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 30);
      ttlCache.set(ck, items, TTL);
      return items;
    } catch (err) {
      /* Stale POIs beat no POIs — a vet that was there six hours ago is still
         almost certainly there. Only when there is nothing cached does the
         caller get an error, flagged so the UI can say the map service is
         slow rather than blaming the farmer's connection. */
      const cached = ttlCache.getStale(ck);
      if (cached?.value) return cached.value;
      if (timedOut) {
        const e = new Error("overpass timed out");
        e.timedOut = true;
        throw e;
      }
      throw err;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", relay);
    }
  },
};
