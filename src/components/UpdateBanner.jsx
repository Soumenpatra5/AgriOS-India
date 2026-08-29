import { useState, useEffect } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";
import { useApp } from "../store/AppStore.jsx";
import { onUpdateAvailable, applyUpdate } from "../services/pwa/pwaUpdate.js";

/* Shown when a newer service-worker version has installed and is waiting.
   Tapping "Update" activates it and reloads the app onto the new build. */
export default function UpdateBanner() {
  const { tc } = useApp();
  const [show, setShow] = useState(false);

  useEffect(() => onUpdateAvailable(() => setShow(true)), []);

  if (!show) return null;

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(76px + env(safe-area-inset-bottom))", zIndex: 40,
      display: "flex", justifyContent: "center", padding: "0 12px", pointerEvents: "none" }}>
      <div style={{ width: "100%", maxWidth: 436, pointerEvents: "auto",
        display: "flex", alignItems: "center", gap: 11, padding: "11px 12px 11px 14px",
        background: T.ink, color: T.bg, borderRadius: T.rLg, boxShadow: T.shadowLg,
        animation: "ag-rise .3s var(--ag-ease)" }}>
        <Icon name="Sparkles" size={18} style={{ flexShrink: 0, opacity: .9 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tc({ en: "Update available", hi: "अपडेट उपलब्ध", bn: "আপডেট উপলব্ধ" })}</div>
          <div style={{ fontSize: 11.5, opacity: .8 }}>{tc({ en: "A new version of AgriOS is ready.", hi: "AgriOS का नया संस्करण तैयार है।", bn: "AgriOS-এর নতুন সংস্করণ প্রস্তুত।" })}</div>
        </div>
        <button onClick={applyUpdate}
          style={{ flexShrink: 0, background: T.primary, color: T.onPrimary, border: "none", borderRadius: 10,
            padding: "8px 15px", cursor: "pointer", fontFamily: T.body, fontSize: 13, fontWeight: 700 }}>
          {tc({ en: "Update", hi: "अपडेट", bn: "আপডেট" })}
        </button>
        <button onClick={() => setShow(false)} aria-label={tc({ en: "Dismiss", hi: "हटाएँ", bn: "সরান" })}
          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: T.bg, opacity: .6, display: "flex", padding: 4 }}>
          <Icon name="X" size={16} />
        </button>
      </div>
    </div>
  );
}
