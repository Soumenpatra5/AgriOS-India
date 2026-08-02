import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { preferences } from "./preferences.js";
import { applyAppearance } from "./appearance.js";
import { useTheme } from "../theme/ThemeProvider.jsx";
import { onAuthChange } from "../services/firebase/auth.js";
import { savePrefsCloud, loadPrefsCloud } from "./prefsSync.js";

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

  // Cloud sync: pull on sign-in (new-device restore), push on change (debounced).
  useEffect(() => onAuthChange(async (user) => {
    if (!user) return;
    const cloud = await loadPrefsCloud();
    if (cloud) preferences.replace(cloud);
  }), []);

  const saveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePrefsCloud(preferences.all()), 800);
    return () => clearTimeout(saveTimer.current);
  }, [prefs]);

  const set        = useCallback((path, value) => preferences.set(path, value), []);
  const reset      = useCallback(() => preferences.reset(), []);
  const exportPrefs = useCallback(() => preferences.export(), []);
  const importPrefs = useCallback((json) => preferences.import(json), []);

  return (
    <PrefsCtx.Provider value={{ prefs, set, reset, exportPrefs, importPrefs }}>
      {/* Global appearance CSS driven by the vars applyAppearance() sets. */}
      <style>{`
        #root { zoom: var(--ag-zoom, 1); }
        :root[data-contrast="high"] {
          --ag-line: color-mix(in srgb, var(--ag-ink) 34%, transparent);
          --ag-line-soft: color-mix(in srgb, var(--ag-ink) 22%, transparent);
          --ag-ink-soft: color-mix(in srgb, var(--ag-ink) 78%, var(--ag-bg));
        }
      `}</style>
      {children}
    </PrefsCtx.Provider>
  );
}
