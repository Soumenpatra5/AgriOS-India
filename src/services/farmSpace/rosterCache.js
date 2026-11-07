/* Client-side herd roster cache for offline bulk milk entry.
 *
 * Caches active milking animals per farm space so farmers opening
 * DairyMilkEntry or GoatMilkEntry inside network-dead barns or sheds
 * can view their herd and log yields into the offline queue without
 * encountering blocking full-screen fetch errors. */

import { storage } from "../../utils/storage.js";

const PREFIX = "roster:";

export const rosterCache = {
  save(spaceId, domain, animals) {
    if (!spaceId || !domain || !Array.isArray(animals)) return;
    storage.set(`${PREFIX}${spaceId}:${domain}`, {
      animals,
      updatedAt: Date.now(),
    });
  },

  get(spaceId, domain) {
    if (!spaceId || !domain) return null;
    const data = storage.get(`${PREFIX}${spaceId}:${domain}`, null);
    if (!data?.animals || !Array.isArray(data.animals)) return null;
    return data;
  },

  clear(spaceId, domain) {
    if (spaceId && domain) {
      storage.remove(`${PREFIX}${spaceId}:${domain}`);
    }
  },
};
