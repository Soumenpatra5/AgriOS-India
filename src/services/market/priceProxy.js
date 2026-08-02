/* Live price proxy — calls api/prices.js (data.gov.in / Agmarknet).
   Returns { unavailable: true } until DATAGOV_API_KEY is set on the server,
   or when the feed has no record for the crop. Callers degrade gracefully to
   the curated MSP / seasonal bands. */

import { authFetch } from "../firebase/authFetch.js";
import { profileMemory } from "../../ai/memory/profileMemory.js";

/* Strip grade/variety parentheticals: "Paddy (Common)" -> "Paddy". */
export function commodityOf(crop) {
  return (crop?.name || "").split("(")[0].trim();
}

/* Best-effort farmer state from the saved profile (free-form: district/state). */
function farmerState() {
  const loc = profileMemory.get().location || "";
  return loc.trim();
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
