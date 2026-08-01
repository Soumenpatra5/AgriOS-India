import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { storage } from "../utils/storage.js";
import { makeT, pickLang } from "../i18n/strings.js";
import { LOCALES } from "../constants/languages.js";
import { onAuthChange, logout as fbLogout } from "../services/firebase/auth.js";
import { initSync, onLogin as syncOnLogin, onLogout as syncOnLogout } from "../services/firebase/syncManager.js";
import { fcmService } from "../services/notifications/fcmService.js";

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
    initSync();
    return onAuthChange((fbUser) => {
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
      }
    });
  }, []);

  const t = useMemo(() => makeT(lang), [lang]);
  const tc = useCallback((obj) => pickLang(lang, obj), [lang]);
  const locale = LOCALES[lang] || "en-IN";

  const setLang = useCallback((code) => { setLangState(code); storage.set("lang", code); }, []);

  const setStageP = useCallback((s) => setStage(s), []);
  const finishOnboarding = useCallback(() => { storage.set("onboarded", true); setStage("auth"); }, []);
  const login = useCallback((u) => {
    storage.set("user", u); setUser(u); setStage("app"); setTab("home");
    syncOnLogin(u).catch(() => {});
  }, []);
  const logout = useCallback(async () => {
    await fbLogout();
    syncOnLogout();
    storage.remove("user");
    setUser(null);
    setStack([]);
    setStage("auth");
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
    fcmService.init((payload) => {
      const { title, body } = payload.notification || {};
      if (title) toast(title + (body ? `: ${body}` : ""), "info");
    }).catch(() => {});
  }, [user, toast]);

  const value = useMemo(() => ({
    lang, setLang, t, tc, locale,
    user, login, logout,
    stage, setStage: setStageP, finishOnboarding,
    tab, switchTab, stack, push, pop,
    toasts, toast, dismissToast, online,
  }), [lang, setLang, t, tc, locale, user, login, logout, stage, setStageP, finishOnboarding,
      tab, switchTab, stack, push, pop, toasts, toast, dismissToast, online]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
