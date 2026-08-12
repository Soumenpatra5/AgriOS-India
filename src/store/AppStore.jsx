import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storage } from "../utils/storage.js";
import { makeT, pickLang } from "../i18n/strings.js";
import { LOCALES } from "../constants/languages.js";
import { backDepth, resolveBack } from "../navigation/backNav.js";
import { roleService } from "../services/rbac/roleService.js";
import { can as rbacCan } from "../services/rbac/permissions.js";

/* Firebase is loaded lazily so its ~900kB of SDK stays off the initial render
   path — splash, language and onboarding screens never touch it. */
const loadAuth = () => import("../services/firebase/auth.js");
const loadSync = () => import("../services/firebase/syncManager.js");
const loadFcm = () => import("../services/notifications/fcmService.js");

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

/* Volatile UI state lives in its own contexts so a toast (every action, and an
   auto-dismiss every 2.6s) or a network flip doesn't re-render all ~120
   useApp() consumers — only the toast host / offline bar (M5). The stable
   toast()/dismissToast() functions stay in useApp so their many callers are
   untouched. */
const ToastsCtx = createContext([]);
const OnlineCtx = createContext(true);
export const useToasts = () => useContext(ToastsCtx);
export const useOnline = () => useContext(OnlineCtx);

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
  const [role, setRoleState] = useState(() => roleService.getRole()); // device-local access role (M7)

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

  /* Device-local access role (M7). `can(cap)` gates sensitive UI; `setRole`
     persists. Elevation is PIN-checked by callers via roleService.switchNeedsPin. */
  const setRole = useCallback((r) => setRoleState(roleService.setRole(r)), []);
  const can = useCallback((cap) => rbacCan(role, cap), [role]);

  const push = useCallback((screen) => setStack((s) => [...s, screen]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const switchTab = useCallback((tk) => { setStack([]); setTab(tk); }, []);

  /* ── Browser/hardware Back integration (H5) ───────────────────────────────
     Mirror the app's back-able depth into the History API so the Back button
     pops a pushed screen (or returns to Home from a tab) instead of leaving the
     PWA. Pure decisions live in navigation/backNav.js; the refs below keep the
     browser history and the app stack in sync without feedback loops:
       - a forward nav pushes history entries;
       - an app-initiated back (an in-app Back button / switchTab / logout)
         consumes them via history.go, suppressing the popstate it triggers;
       - a browser/hardware Back runs the in-app back and skips re-consuming,
         since the browser already moved. */
  const navRef = useRef({ stage, tab, stack });
  const depthRef = useRef(0);
  const ignorePopRef = useRef(false);   // true while consuming our own history.go
  const browserBackRef = useRef(false); // true when a decrease came from a Back press
  useEffect(() => { navRef.current = { stage, tab, stack }; });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => {
      if (ignorePopRef.current) { ignorePopRef.current = false; return; }
      const action = resolveBack(navRef.current);
      if (action === "pop") { browserBackRef.current = true; pop(); }
      else if (action === "home") { browserBackRef.current = true; switchTab("home"); }
      // "exit": nothing to intercept — let the browser navigate away.
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [pop, switchTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const depth = backDepth({ stage, tab, stack });
    const prev = depthRef.current;
    if (depth === prev) return;
    depthRef.current = depth;
    if (depth > prev) {
      for (let i = prev; i < depth; i++) window.history.pushState({ agDepth: i + 1 }, "");
    } else if (browserBackRef.current) {
      browserBackRef.current = false; // Back already consumed the entry
    } else {
      ignorePopRef.current = true;    // app-initiated back: consume the browser entries
      window.history.go(depth - prev);
    }
  }, [stage, tab, stack]);

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

  // `toasts` and `online` are deliberately NOT in this value (nor its deps), so
  // it stays referentially stable across toast/network changes — they flow
  // through the dedicated contexts below instead.
  const value = useMemo(() => ({
    lang, setLang, t, tc, locale,
    user, login, logout, updateUser,
    stage, setStage: setStageP, finishOnboarding,
    tab, switchTab, stack, push, pop,
    toast, dismissToast,
    role, setRole, can,
  }), [lang, setLang, t, tc, locale, user, login, logout, updateUser, stage, setStageP, finishOnboarding,
      tab, switchTab, stack, push, pop, toast, dismissToast, role, setRole, can]);

  return (
    <AppCtx.Provider value={value}>
      <OnlineCtx.Provider value={online}>
        <ToastsCtx.Provider value={toasts}>
          {children}
        </ToastsCtx.Provider>
      </OnlineCtx.Provider>
    </AppCtx.Provider>
  );
}
