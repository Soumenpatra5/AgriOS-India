/* API Key Manager — central service for multi-key management.

   Keys are stored in localStorage with lightweight obfuscation (not true
   encryption — browser JS can't secure secrets from a determined local
   attacker, but this prevents casual exposure in DevTools).

   The storage layer is isolated behind load/save helpers so it can be
   swapped for Firestore, Supabase, or any backend without touching the
   rest of this module. */

const STORE_KEY = "agrios:apiKeys";
const ACTIVE_KEY = "agrios:activeKeyId";
const HEALTH_KEY = "agrios:keyHealth";

// ── lightweight obfuscation ──────────────────────────────────────────
const _enc = (s) => btoa(s.split("").reverse().join(""));
const _dec = (s) => { try { return atob(s).split("").reverse().join(""); } catch { return ""; } };

// ── storage helpers (swap this section for a DB adapter) ─────────────
function loadKeys() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}
function saveKeys(keys) { localStorage.setItem(STORE_KEY, JSON.stringify(keys)); }
function loadHealth() {
  try { return JSON.parse(localStorage.getItem(HEALTH_KEY)) || {}; }
  catch { return {}; }
}
function saveHealth(h) { localStorage.setItem(HEALTH_KEY, JSON.stringify(h)); }

// ── helpers ──────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// ── listeners ────────────────────────────────────────────────────────
const listeners = new Set();
function notify() { listeners.forEach((fn) => { try { fn(); } catch { /* */ } }); }

// ── public API ───────────────────────────────────────────────────────
export const keyManager = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  listKeys() {
    return loadKeys().map((k) => ({ ...k, key: _dec(k.key) }));
  },

  getKey(id) {
    const k = loadKeys().find((k) => k.id === id);
    return k ? { ...k, key: _dec(k.key) } : null;
  },

  addKey({ name, key, provider = "openai", notes = "" }) {
    const keys = loadKeys();
    const entry = {
      id: uid(),
      name: name || `Key ${keys.length + 1}`,
      key: _enc(key),
      provider,
      status: "active",
      notes,
      dateAdded: new Date().toISOString(),
      lastUsed: null,
    };
    keys.push(entry);
    saveKeys(keys);
    if (keys.length === 1) localStorage.setItem(ACTIVE_KEY, entry.id);
    notify();
    return entry.id;
  },

  updateKey(id, updates) {
    const keys = loadKeys();
    const idx = keys.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    if (updates.key) updates.key = _enc(updates.key);
    Object.assign(keys[idx], updates);
    saveKeys(keys);
    notify();
    return true;
  },

  deleteKey(id) {
    let keys = loadKeys();
    keys = keys.filter((k) => k.id !== id);
    saveKeys(keys);
    const activeId = localStorage.getItem(ACTIVE_KEY);
    if (activeId === id) {
      const next = keys.find((k) => k.status === "active");
      localStorage.setItem(ACTIVE_KEY, next?.id || "");
    }
    const health = loadHealth();
    delete health[id];
    saveHealth(health);
    notify();
    return true;
  },

  getActiveKeyId() {
    return localStorage.getItem(ACTIVE_KEY) || "";
  },

  setActiveKey(id) {
    const keys = loadKeys();
    if (!keys.find((k) => k.id === id)) return false;
    localStorage.setItem(ACTIVE_KEY, id);
    notify();
    return true;
  },

  getActiveKey() {
    const id = this.getActiveKeyId();
    if (!id) return null;
    return this.getKey(id);
  },

  // Failover: find the next healthy active key
  rotateKey(failedId) {
    const keys = this.listKeys();
    const health = loadHealth();
    const candidates = keys.filter(
      (k) => k.id !== failedId && k.status === "active" && (health[k.id]?.failures || 0) < 5,
    );
    if (!candidates.length) return null;
    const next = candidates[0];
    this.setActiveKey(next.id);
    return next;
  },

  // ── health tracking ──────────────────────────────────────────────
  recordSuccess(id) {
    const health = loadHealth();
    health[id] = {
      ...health[id],
      lastSuccess: new Date().toISOString(),
      lastError: health[id]?.lastError || null,
      failures: 0,
      requests: (health[id]?.requests || 0) + 1,
    };
    saveHealth(health);
    const keys = loadKeys();
    const idx = keys.findIndex((k) => k.id === id);
    if (idx !== -1) { keys[idx].lastUsed = new Date().toISOString(); saveKeys(keys); }
  },

  recordFailure(id, errorMsg, httpStatus) {
    const health = loadHealth();
    health[id] = {
      ...health[id],
      lastError: { message: errorMsg, status: httpStatus, at: new Date().toISOString() },
      failures: (health[id]?.failures || 0) + 1,
      requests: (health[id]?.requests || 0) + 1,
    };
    saveHealth(health);
  },

  getHealth(id) {
    return loadHealth()[id] || { failures: 0, requests: 0, lastSuccess: null, lastError: null };
  },

  getAllHealth() {
    return loadHealth();
  },

  // Should we auto-failover based on this HTTP status?
  shouldFailover(httpStatus) {
    return httpStatus === 401 || httpStatus === 429 || httpStatus === 403;
  },
};
