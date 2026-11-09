/* Persistent Storage Coordinator
 *
 * In mobile browsers (especially Chromium on Android), IndexedDB defaults to
 * "best-effort" temporary storage quota. Under storage pressure (<10% free space
 * or OS storage cleaner sweeps), Android silently evicts best-effort databases.
 *
 * Calling navigator.storage.persist() requests durable/persistent quota,
 * exempting the AgriOS origin from silent automated eviction by the browser/OS.
 */

export async function requestPersistentStorage() {
  if (
    typeof navigator !== "undefined" &&
    navigator.storage &&
    typeof navigator.storage.persist === "function"
  ) {
    try {
      const isPersisted = typeof navigator.storage.persisted === "function"
        ? await navigator.storage.persisted()
        : false;

      if (!isPersisted) {
        return await navigator.storage.persist();
      }
      return isPersisted;
    } catch {
      // Best-effort: older browsers, restricted iframes, or private windows
      return false;
    }
  }
  return false;
}

export async function checkStorageEstimate() {
  if (
    typeof navigator !== "undefined" &&
    navigator.storage &&
    typeof navigator.storage.estimate === "function"
  ) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        usageBytes: estimate.usage || 0,
        quotaBytes: estimate.quota || 0,
        percentUsed: estimate.quota
          ? Number(((estimate.usage / estimate.quota) * 100).toFixed(1))
          : 0,
      };
    } catch {
      return null;
    }
  }
  return null;
}
