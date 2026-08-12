/* Persists the current device-local role and the Owner's PIN. The PIN is stored
   as a SHA-256 hash — this is a casual-access gate for a shared device, not a
   defense against someone with devtools, which is the right threat model for an
   offline single-device app. */

import { storage } from "../../utils/storage.js";
import { ROLES, DEFAULT_ROLE, requiresPin } from "./permissions.js";

const ROLE_KEY = "rbac:role";
const PIN_KEY = "rbac:pinHash";

async function hashPin(pin) {
  const data = new TextEncoder().encode("agrios-rbac:" + String(pin));
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const roleService = {
  getRole() {
    const r = storage.get(ROLE_KEY, DEFAULT_ROLE);
    return ROLES.includes(r) ? r : DEFAULT_ROLE;
  },
  setRole(role) {
    if (ROLES.includes(role)) storage.set(ROLE_KEY, role);
    return this.getRole();
  },

  hasPin() { return !!storage.get(PIN_KEY, null); },
  async setPin(pin) { storage.set(PIN_KEY, await hashPin(pin)); },
  async verifyPin(pin) {
    const stored = storage.get(PIN_KEY, null);
    return !!stored && stored === (await hashPin(pin));
  },
  clearPin() { storage.remove(PIN_KEY); },

  /* Whether switching to `target` from the current role needs the PIN. */
  switchNeedsPin(target) {
    return requiresPin(this.getRole(), target, this.hasPin());
  },
};
