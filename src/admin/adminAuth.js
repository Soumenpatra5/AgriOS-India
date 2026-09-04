/* Admin panel gate.

   Scope, stated honestly: this panel is entirely device-local — every page
   under src/admin reads the visitor's OWN browser storage (agrios-admin
   IndexedDB, localStorage feature flags) and there is no /api/admin on the
   server. The PIN therefore protects a local dashboard, not other users'
   data. That is also why a build-time VITE_ variable is acceptable here at
   all: anything VITE_ is visible in the shipped JS bundle, which would be
   unforgivable for a real credential but is tolerable for a lock on a
   local-only surface.

   No default. With VITE_ADMIN_PIN unset the panel refuses every PIN, so a
   deployment that never configured one — production today — simply has the
   panel disabled instead of guarded by a PIN printed in the repository,
   which is what this replaced. */
const KEY = "agrios-admin:auth";
/* Read at call time, not module scope, so tests can stub the env and so a
   missing value is re-checked on every attempt rather than frozen at import. */
const configuredPin = () => import.meta.env.VITE_ADMIN_PIN || null;

const ss = typeof sessionStorage !== "undefined" ? sessionStorage : { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = v; }, removeItem(k) { delete this._m[k]; } };

export const adminAuth = {
  login(pin) {
    const expected = configuredPin();
    if (!expected || pin !== expected) return false;
    ss.setItem(KEY, JSON.stringify({ loggedIn: true, at: Date.now() }));
    return true;
  },
  logout() {
    ss.removeItem(KEY);
  },
  isLoggedIn() {
    try {
      const raw = ss.getItem(KEY);
      return raw ? JSON.parse(raw).loggedIn === true : false;
    } catch { return false; }
  },
};
