import { ThemeProvider } from "./theme/ThemeProvider.jsx";
import { PreferencesProvider } from "./customize/PreferencesProvider.jsx";
import { AppProvider } from "./store/AppStore.jsx";
import ScreenRouter from "./navigation/ScreenRouter.jsx";

/* Composition root. PreferencesProvider sits inside ThemeProvider so it can
   react to the resolved light/dark theme, and applies all user customization
   (accent, card style, display size, …) on top. */
export default function App() {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <AppProvider>
          <ScreenRouter />
        </AppProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}
