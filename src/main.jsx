import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { registerSW } from "./services/pwa/pwaUpdate.js";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary variant="root">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

registerSW();
