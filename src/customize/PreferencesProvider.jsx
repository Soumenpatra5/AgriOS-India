import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { preferences } from "./preferences.js";
import { applyAppearance } from "./appearance.js";
import { useTheme } from "../theme/ThemeProvider.jsx";

/* Firebase (auth + firestore) loaded lazily — preference cloud sync is a
   background nicety and must not block the initial render. */
const loadAuth = () => import("../services/firebase/auth.js");
const loadPrefsSync = () => import("./prefsSync.js");

const PrefsCtx = createContext(null);
export const usePrefs = () => useContext(PrefsCtx);

export function PreferencesProvider({ children }) {
  const theme = useTheme();
  const [prefs, setPrefs] = useState(() => preferences.all());

  // Re-render on any preference change.
  useEffect(() => preferences.subscribe(setPrefs), []);

  // Keep the base theme (light/dark/system) in sync with the pref.
  useEffect(() => {
    if (prefs.appearance.theme !== theme.mode) theme.setTheme(prefs.appearance.theme);
  }, [prefs.appearance.theme]);

  // Apply appearance CSS vars whenever appearance or the resolved theme changes.
  useEffect(() => {
    applyAppearance(prefs.appearance, theme.resolved);
  }, [prefs.appearance, theme.resolved]);

  // Accessibility: reduce motion.
  useEffect(() => {
    document.documentElement.dataset.motion = prefs.accessibility.reduceMotion ? "reduce" : "full";
  }, [prefs.accessibility.reduceMotion]);

  // Cloud sync: pull on sign-in (new-device restore), push on change (debounced).
  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    /* Deferred past first paint, and prefsSync — whose static firestore
       import is what used to drag the 620KB Firestore chunk into every
       boot, signed-in or not — is now imported only once a signed-in user
       is actually observed. A signed-out visitor pays for the (much
       smaller) auth module at idle and nothing more. */
    const timer = setTimeout(() => {
      loadAuth().then(({ onAuthChange }) => {
        if (cancelled) return;
        unsub = onAuthChange(async (user) => {
          if (!user) return;
          const { loadPrefsCloud } = await loadPrefsSync();
          const cloud = await loadPrefsCloud();
          if (cloud) preferences.replace(cloud);
        });
      }).catch(() => {});
    }, 3000);
    return () => { cancelled = true; clearTimeout(timer); unsub(); };
  }, []);

  const saveTimer = useRef(null);
  const initialPrefsSkipped = useRef(false);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    /* The mount run carries the prefs that were just loaded from disk —
       pushing those re-wrote identical data to Firestore on every single
       app open. Only actual changes after boot are worth a write. */
    if (!initialPrefsSkipped.current) { initialPrefsSkipped.current = true; return; }
    // "off" = local only: don't push preferences to the cloud.
    if (prefs.offline.mode === "off") return;
    saveTimer.current = setTimeout(() => {
      loadPrefsSync().then(({ savePrefsCloud }) => savePrefsCloud(preferences.all())).catch(() => {});
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [prefs]);

  const set        = useCallback((path, value) => preferences.set(path, value), []);
  const reset      = useCallback(() => preferences.reset(), []);
  const exportPrefs = useCallback(() => preferences.export(), []);
  const importPrefs = useCallback((json) => preferences.import(json), []);

  /* Memoized on prefs (the callbacks are already stable) — an inline object
     here handed every usePrefs consumer a fresh value whenever this provider
     re-rendered for an unrelated reason (a theme change via useTheme),
     re-rendering Home, BottomNav and the rest for nothing. */
  const value = useMemo(() => ({ prefs, set, reset, exportPrefs, importPrefs }),
    [prefs, set, reset, exportPrefs, importPrefs]);

  return (
    <PrefsCtx.Provider value={value}>
      {/* Global appearance CSS driven by the vars applyAppearance() sets. */}
      <style>{`
        #root { zoom: var(--ag-zoom, 1); }
        :root[data-contrast="high"] {
          --ag-line: color-mix(in srgb, var(--ag-ink) 34%, transparent);
          --ag-line-soft: color-mix(in srgb, var(--ag-ink) 22%, transparent);
          --ag-ink-soft: color-mix(in srgb, var(--ag-ink) 78%, var(--ag-bg));
        }
        :root[data-motion="reduce"] *, :root[data-motion="reduce"] *::before, :root[data-motion="reduce"] *::after {
          animation-duration: .001ms !important; animation-iteration-count: 1 !important;
          transition-duration: .001ms !important; scroll-behavior: auto !important;
        }
      `}</style>
      {children}
    </PrefsCtx.Provider>
  );
}
