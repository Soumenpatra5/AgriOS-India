/* Live price proxy — calls api/prices.js (data.gov.in / Agmarknet).
   Returns { unavailable: true } until DATAGOV_API_KEY is set on the server,
   or when the feed has no record for the crop. Callers degrade gracefully to
   the curated MSP / seasonal bands. */

import { authFetch } from "../firebase/authFetch.js";
import { profileMemory } from "../../ai/memory/profileMemory.js";
import { preferences } from "../../customize/preferences.js";

/* Strip grade/variety parentheticals: "Paddy (Common)" -> "Paddy". */
export function commodityOf(crop) {
  return (crop?.name || "").split("(")[0].trim();
}

/* Farmer state — the region set in Personalize wins; otherwise fall back to the
   free-form location saved in the profile. */
function farmerState() {
  const region = (preferences.get("region.state", "") || "").trim();
  if (region) return region;
  return (profileMemory.get().location || "").trim();
}

export async function fetchLivePrice(crop, { market = "", signal } = {}) {
  const commodity = commodityOf(crop);
  if (!commodity) return { unavailable: true };
  try {
    const res = await authFetch("/api/prices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commodity, state: farmerState(), market }),
      signal,
    });
    if (!res.ok) return { unavailable: true };
    return await res.json();
  } catch {
    return { unavailable: true };
  }
}
