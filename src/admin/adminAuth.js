const KEY = "agrios-admin:auth";
const PIN = "admin123";

const ss = typeof sessionStorage !== "undefined" ? sessionStorage : { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = v; }, removeItem(k) { delete this._m[k]; } };

export const adminAuth = {
  login(pin) {
    if (pin !== PIN) return false;
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
