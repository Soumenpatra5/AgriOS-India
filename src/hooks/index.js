/* Convenience hooks. All app state lives in the store; these are thin,
   intention-revealing selectors so screens don't reach into the whole store. */
import { useApp } from "../store/AppStore.jsx";
export { useTheme } from "../theme/ThemeProvider.jsx";
export { useApp };
export { useToasts, useOnline } from "../store/AppStore.jsx";

export const useToast = () => useApp().toast;
export const useNav = () => {
  const { push, pop, switchTab, tab, stack } = useApp();
  return { push, pop, switchTab, tab, stack };
};
export const useI18n = () => {
  const { t, lang, setLang, locale } = useApp();
  return { t, lang, setLang, locale };
};
