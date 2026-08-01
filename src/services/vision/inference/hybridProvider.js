/* Hybrid provider — tries local first, falls back to cloud.
   Future A/B testing and automatic rollback live here. */

import { localProvider }       from "./localProvider.js";
import { cloudVisionProvider } from "./cloudVisionProvider.js";

export const hybridProvider = {
  id:   "hybrid",
  name: "Hybrid (Local + Cloud)",

  isAvailable() {
    return localProvider.isAvailable() || cloudVisionProvider.isAvailable();
  },

  getCapabilities() {
    return [...new Set([...localProvider.getCapabilities(), ...cloudVisionProvider.getCapabilities()])];
  },

  async infer(imageBase64, metadata = {}, context = {}) {
    if (localProvider.isAvailable()) {
      try {
        const result = await localProvider.infer(imageBase64, metadata, context);
        return { ...result, strategy: "local" };
      } catch { /* fall through to cloud */ }
    }

    if (!cloudVisionProvider.isAvailable()) {
      throw new Error("No inference provider available. Check your network connection.");
    }

    const result = await cloudVisionProvider.infer(imageBase64, metadata, context);
    return { ...result, strategy: "cloud" };
  },
};
