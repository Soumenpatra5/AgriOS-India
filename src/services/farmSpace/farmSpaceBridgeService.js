/* Local ERP ↔ Cloud Farm Space Bridge Service — Phase 1: Land Parcels → Farm Fields.
 *
 * Coordinates between device-local IndexedDB land parcels and Farm Space backend:
 * - Reads local parcels via landService without mutating them.
 * - Dispatches bridge.preview and bridge.publishFields through farmSpaceApi.
 * - Stores local bridge audit metadata in localStorage under a dedicated namespace,
 *   completely isolating it from IndexedDB and Firestore sync.
 */

import { landService } from "../land/landService.js";
import { animalService } from "../livestock/livestockService.js";
import { farmSpaceApi } from "./farmSpaceApi.js";

const BRIDGE_STORAGE_PREFIX = "agrios_bridge_fields_";

function getLocalBridgeMap(spaceId) {
  if (!spaceId) return {};
  try {
    const raw = localStorage.getItem(`${BRIDGE_STORAGE_PREFIX}${spaceId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalBridgeMap(spaceId, map) {
  if (!spaceId) return;
  try {
    localStorage.setItem(`${BRIDGE_STORAGE_PREFIX}${spaceId}`, JSON.stringify(map));
  } catch {
    // Ignore storage quota or environment errors
  }
}

export const farmSpaceBridgeService = {
  /**
   * Fetches local ERP parcels safely without modifying them.
   * @param {string|null} farmId Optional filter by local farm ID
   * @returns {Promise<Array>} List of local parcel records
   */
  async getLocalParcels(farmId = null) {
    const list = await landService.getAll(farmId);
    return Array.isArray(list) ? list : [];
  },

  /**
   * Fetches local ERP animals safely without modifying them.
   * For goat/sheep, fetches both species since they share the small-ruminant cloud register.
   * NEVER mutates IndexedDB.
   * @param {string} enterprise 'dairy' | 'goat' | 'sheep' | 'pig'
   * @returns {Promise<Array>} List of local animal records
   */
  async getLocalAnimals(enterprise) {
    if (!enterprise) return [];
    if (enterprise === "goat" || enterprise === "sheep") {
      const goats = await animalService.getAll("goat");
      const sheep = await animalService.getAll("sheep");
      return [...(goats || []), ...(sheep || [])];
    }
    const list = await animalService.getAll(enterprise);
    return Array.isArray(list) ? list : [];
  },

  /**
   * Runs a server-side preview comparison for the given parcels against the target Farm Space.
   * NEVER mutates local parcel records.
   * @param {Object} params
   * @param {string} params.spaceId Target Farm Space ID
   * @param {Array} params.parcels Local parcel records to evaluate
   * @returns {Promise<Object>} { spaceId, summary, items }
   */
  async preview({ spaceId, parcels }) {
    if (!spaceId) throw new Error("spaceId is required for bridge preview");
    if (!Array.isArray(parcels)) throw new Error("parcels array is required");

    return farmSpaceApi.bridgePreview(spaceId, parcels);
  },

  /**
   * Runs a server-side preview comparison for livestock against the target Farm Space.
   * NEVER mutates local animal records.
   * @param {Object} params
   * @param {string} params.spaceId Target Farm Space ID
   * @param {string} params.enterprise 'dairy' | 'goat' | 'pig'
   * @param {Array} params.animals Local animal records to evaluate
   * @returns {Promise<Object>} { spaceId, enterprise, summary, items }
   */
  async previewLivestock({ spaceId, enterprise, animals }) {
    if (!spaceId) throw new Error("spaceId is required for bridge livestock preview");
    if (!enterprise) throw new Error("enterprise is required for bridge livestock preview");
    if (!Array.isArray(animals)) throw new Error("animals array is required");

    return farmSpaceApi.bridgePreviewLivestock(spaceId, enterprise, animals);
  },

  /**
   * Publishes selected parcels to the target Farm Space.
   * @param {Object} params
   * @param {string} params.spaceId Target Farm Space ID
   * @param {Array} params.parcels Local parcel records to publish
   * @param {boolean} params.overwrite Whether to overwrite fields that exist with differences
   * @returns {Promise<Object>} { success, spaceId, created, updated, skipped, total }
   */
  async publish({ spaceId, parcels, overwrite = false }) {
    if (!spaceId) throw new Error("spaceId is required for bridge publish");
    if (!Array.isArray(parcels) || parcels.length === 0) {
      return { success: true, spaceId, created: [], updated: [], skipped: [], total: 0 };
    }

    const result = await farmSpaceApi.bridgePublishFields(spaceId, parcels, overwrite);

    // Save local metadata durable mapping (does NOT mutate IndexedDB or touch Firestore sync)
    const currentMap = getLocalBridgeMap(spaceId);
    const now = new Date().toISOString();

    for (const item of (result.created || [])) {
      currentMap[item.clientUuid] = {
        cloudFieldId: item.id,
        name: item.name,
        lastPublishedAt: now,
        status: "created",
      };
    }
    for (const item of (result.updated || [])) {
      currentMap[item.clientUuid] = {
        cloudFieldId: item.id,
        name: item.name,
        lastPublishedAt: now,
        status: "updated",
      };
    }
    for (const item of (result.skipped || [])) {
      if (item.reason === "already_synced") {
        currentMap[item.clientUuid] = {
          cloudFieldId: item.id,
          name: item.name,
          lastVerifiedAt: now,
          status: "synced",
        };
      }
    }

    setLocalBridgeMap(spaceId, currentMap);

    return result;
  },

  /**
   * Publishes selected livestock to the target Farm Space.
   * @param {Object} params
   * @param {string} params.spaceId Target Farm Space ID
   * @param {string} params.enterprise 'dairy' | 'goat' | 'pig'
   * @param {Array} params.animals Local animal records to publish
   * @param {boolean} params.overwrite Whether to overwrite fields that exist with differences
   * @returns {Promise<Object>} { success, spaceId, enterprise, created, updated, skipped, total }
   */
  async publishLivestock({ spaceId, enterprise, animals, overwrite = false }) {
    if (!spaceId) throw new Error("spaceId is required for bridge livestock publish");
    if (!enterprise) throw new Error("enterprise is required for bridge livestock publish");
    if (!Array.isArray(animals) || animals.length === 0) {
      return { success: true, spaceId, enterprise, created: [], updated: [], skipped: [], total: 0 };
    }

    const result = await farmSpaceApi.bridgePublishLivestock(spaceId, enterprise, animals, overwrite);

    // Save local metadata durable mapping (does NOT mutate IndexedDB or touch Firestore sync)
    const storageKey = `agrios_bridge_livestock_${enterprise}_${spaceId}`;
    try {
      const currentMap = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const now = new Date().toISOString();
      for (const item of (result.created || [])) {
        currentMap[item.clientUuid] = { cloudId: item.id, name: item.name, lastPublishedAt: now, status: "created" };
      }
      for (const item of (result.updated || [])) {
        currentMap[item.clientUuid] = { cloudId: item.id, name: item.name, lastPublishedAt: now, status: "updated" };
      }
      for (const item of (result.skipped || [])) {
        if (item.reason === "already_synced") {
          currentMap[item.clientUuid] = { cloudId: item.id, name: item.name, lastVerifiedAt: now, status: "synced" };
        }
      }
      localStorage.setItem(storageKey, JSON.stringify(currentMap));
    } catch {
      // Ignore storage errors
    }

    return result;
  },

  /**
   * Retrieves durable bridge mapping for the target space from local storage.
   * @param {string} spaceId
   * @returns {Object}
   */
  getBridgeMetadata(spaceId) {
    return getLocalBridgeMap(spaceId);
  },
};
