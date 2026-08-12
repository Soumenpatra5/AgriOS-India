import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { storage } from "../utils/storage.js";
import { makeT, pickLang } from "../i18n/strings.js";
import { LOCALES } from "../constants/languages.js";

/* Firebase is loaded lazily so its ~900kB of SDK stays off the initial render
   path — splash, language and onboarding screens never touch it. */
const loadAuth = () => import("../services/firebase/auth.js");
const loadSync = () => import("../services/firebase/syncManager.js");
const loadFcm = () => import("../services/notifications/fcmService.js");

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export const nextAfterSplash = () => {
  if (!storage.get("lang")) return "language";
  if (!storage.get("onboarded")) return "onboarding";
  if (!storage.get("user")) return "auth";
  return "app";
};

export function AppProvider({ children }) {
  const [lang, setLangState] = useState(() => storage.get("lang", "en"));
  const [user, setUser] = useState(() => storage.get("user", null));
  const [stage, setStage] = useState("splash");
  const [tab, setTab] = useState("home");
  const [stack, setStack] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const [{ onAuthChange }, { initSync }] = await Promise.all([loadAuth(), loadSync()]);
      if (cancelled) return;
      initSync();
      unsub = onAuthChange((fbUser) => {
        if (fbUser) {
          const stored = storage.get("user", null);
          if (stored && stored.uid === fbUser.uid) return;
          const u = {
            uid: fbUser.uid,
            phone: fbUser.phoneNumber?.replace("+91", "") || stored?.phone || "",
            email: fbUser.email || stored?.email || "",
            name: fbUser.displayName || stored?.name || "",
            photo: fbUser.photoURL || stored?.photo || "",
            provider: fbUser.providerData?.[0]?.providerId || stored?.provider || "",
            joined: stored?.joined || Date.now(),
          };
          storage.set("user", u);
          setUser(u);
        } else {
          storage.remove("user");
          setUser(null);
          // If auth drops while we're already inside the app (sign-out on
          // another tab, revoked/expired token, or a uid mismatch), don't leave
          // the shell rendering with a null user — clear the stack and return to
          // the auth screen. Pre-app stages (splash/language/onboarding) are
          // left untouched so first-run users aren't bounced.
          setStack([]);
          setStage((s) => (s === "app" ? "auth" : s));
        }
      });
    })();
    return () => { cancelled = true; unsub(); };
  }, []);

  const t = useMemo(() => makeT(lang), [lang]);
  const tc = useCallback((obj) => pickLang(lang, obj), [lang]);
  const locale = LOCALES[lang] || "en-IN";

  const setLang = useCallback((code) => { setLangState(code); storage.set("lang", code); }, []);

  const setStageP = useCallback((s) => setStage(s), []);
  const finishOnboarding = useCallback(() => { storage.set("onboarded", true); setStage("auth"); }, []);
  const login = useCallback((u) => {
    storage.set("user", u); setUser(u); setStage("app"); setTab("home");
    loadSync().then((m) => m.onLogin(u)).catch(() => {});
  }, []);
  const logout = useCallback(async () => {
    const [{ logout: fbLogout }, { onLogout }] = await Promise.all([loadAuth(), loadSync()]);
    await fbLogout();
    onLogout();
    storage.remove("user");
    setUser(null);
    setStack([]);
    setStage("auth");
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => { const next = { ...(prev || {}), ...patch }; storage.set("user", next); return next; });
  }, []);

  const push = useCallback((screen) => setStack((s) => [...s, screen]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const switchTab = useCallback((tk) => { setStack([]); setTab(tk); }, []);

  const toast = useCallback((message, kind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((q) => [...q, { id, message, kind }]);
    setTimeout(() => setToasts((q) => q.filter((x) => x.id !== id)), 2600);
  }, []);
  const dismissToast = useCallback((id) => setToasts((q) => q.filter((x) => x.id !== id)), []);

  useEffect(() => {
    if (!user) return;
    loadFcm().then(({ fcmService }) => {
      fcmService.init((payload) => {
        const { title, body } = payload.notification || {};
        if (title) toast(title + (body ? `: ${body}` : ""), "info");
      }).catch(() => {});
    }).catch(() => {});
  }, [user, toast]);

  const value = useMemo(() => ({
    lang, setLang, t, tc, locale,
    user, login, logout, updateUser,
    stage, setStage: setStageP, finishOnboarding,
    tab, switchTab, stack, push, pop,
    toasts, toast, dismissToast, online,
  }), [lang, setLang, t, tc, locale, user, login, logout, updateUser, stage, setStageP, finishOnboarding,
      tab, switchTab, stack, push, pop, toasts, toast, dismissToast, online]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
