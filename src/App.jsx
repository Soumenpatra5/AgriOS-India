import { ThemeProvider } from "./theme/ThemeProvider.jsx";
import { AppProvider } from "./store/AppStore.jsx";
import ScreenRouter from "./navigation/ScreenRouter.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <ScreenRouter />
      </AppProvider>
    </ThemeProvider>
  );
}
