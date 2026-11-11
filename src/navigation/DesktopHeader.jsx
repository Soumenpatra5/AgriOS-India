import { useState, useRef, useEffect } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import { useTheme } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { useApp } from "../store/AppStore.jsx";
import { LANGUAGES } from "../constants/languages.js";
import DesktopCommandPalette from "./DesktopCommandPalette.jsx";

export default function DesktopHeader() {
  const { tc, lang, setLang, push } = useApp();
  const { resolved, setTheme } = useTheme();
  const [langOpen, setLangOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const langRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global Ctrl + K / Cmd + K shortcut to open command palette
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  const searchPlaceholder = tc({
    en: "Search crops, livestock, medicines, or schemes... (Ctrl + K)",
    hi: "फसल, पशु, दवा या योजनाएं खोजें... (Ctrl + K)",
    bn: "ফসল, পশু, ওষুধ বা সরকারি স্কিম খুঁজুন... (Ctrl + K)",
  });

  return (
    <header
      style={{
        height: 60,
        minHeight: 60,
        background: T.surface,
        borderBottom: `1px solid ${T.line}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        gap: 16,
        zIndex: 15,
        userSelect: "none",
      }}
    >
      {/* Global Search Bar */}
      <div style={{ flex: 1, maxWidth: 480, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: T.inkFaint,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="Search" size={16} />
        </div>
        <input
          type="search"
          placeholder={searchPlaceholder}
          aria-label={tc({ en: "Global search", hi: "वैश्विक खोज", bn: "গ্লোবাল সার্চ" })}
          onClick={() => setPaletteOpen(true)}
          onFocus={() => setPaletteOpen(true)}
          readOnly
          style={{
            width: "100%",
            height: 38,
            paddingLeft: 38,
            paddingRight: 70,
            background: T.surface2,
            border: `1px solid ${T.line}`,
            borderRadius: 12,
            fontSize: 12.5,
            color: T.ink,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: T.body,
            cursor: "pointer",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 10,
            fontWeight: 700,
            color: T.inkFaint,
            background: T.surface,
            border: `1px solid ${T.line}`,
            padding: "2px 6px",
            borderRadius: 6,
            pointerEvents: "none",
          }}
        >
          ⌘K
        </div>
      </div>

      {/* Action Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        
        {/* Language Picker Dropdown */}
        <div ref={langRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setLangOpen((o) => !o)}
            aria-expanded={langOpen}
            aria-label={tc({ en: "Select language", hi: "भाषा चुनें", bn: "ভাষা পরিবর্তন" })}
            style={{
              height: 36,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 12px",
              borderRadius: 10,
              background: T.surface2,
              border: `1px solid ${T.line}`,
              color: T.ink,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span>🌐</span>
            <span>{currentLang.native}</span>
            <span style={{ fontSize: 9, color: T.inkFaint }}>▼</span>
          </button>

          {langOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: 44,
                right: 0,
                width: 160,
                background: T.surface,
                border: `1px solid ${T.line}`,
                borderRadius: 12,
                boxShadow: T.shadowLg,
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                zIndex: 30,
              }}
            >
              {LANGUAGES.slice(0, 5).map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    setLang(l.code);
                    setLangOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: lang === l.code ? T.primarySoft : "transparent",
                    color: lang === l.code ? T.primary : T.ink,
                    fontSize: 12,
                    fontWeight: lang === l.code ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>{l.native}</span>
                  <span style={{ fontSize: 10, color: T.inkFaint }}>{l.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle (Light / Dark) */}
        <button
          type="button"
          onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
          aria-label={tc({ en: "Toggle dark mode", hi: "डार्क मोड टॉगल करें", bn: "ডার্ক মোড পরিবর্তন" })}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: T.surface2,
            border: `1px solid ${T.line}`,
            color: T.ink,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <Icon name={resolved === "dark" ? "Sun" : "Moon"} size={16} />
        </button>

        {/* Alerts / Notifications */}
        <button
          type="button"
          onClick={() => push({ kind: "alertsCenter" })}
          aria-label={tc({ en: "Notifications", hi: "सूचनाएं", bn: "বিজ্ঞপ্তি" })}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: T.surface2,
            border: `1px solid ${T.line}`,
            color: T.ink,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <Icon name="Bell" size={16} />
        </button>

        {/* Quick Add Button */}
        <button
          type="button"
          onClick={() => push({ kind: "feature", props: { title: "Quick Entry", desc: "Add new farm record", icon: "Plus", a: "farm" } })}
          style={{
            height: 36,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 14px",
            borderRadius: 10,
            background: T.primary,
            border: "none",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(18, 137, 78, 0.2)",
          }}
        >
          <Icon name="Plus" size={15} strokeWidth={2.6} />
          <span>{tc({ en: "New Record", hi: "नया रिकॉर्ड", bn: "নতুন রেকর্ড" })}</span>
        </button>

      </div>

      <DesktopCommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}
