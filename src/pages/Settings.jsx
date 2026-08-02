import { useState } from "react";
import { T, useTheme } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card, BottomSheet } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { LANGUAGES } from "../constants/languages.js";
import { notificationService } from "../services/notifications/notificationService.js";
import { fcmService } from "../services/notifications/fcmService.js";

function Row({ icon, label, children, onClick, last }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 12px",
      borderTop: last ? "none" : `1px solid ${T.lineSoft}`, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: T.surface2, color: T.inkSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={17} />
      </div>
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width: 46, height: 28, borderRadius: 999, border: "none", cursor: "pointer", padding: 3, flexShrink: 0,
        background: on ? T.primary : T.line, transition: "background .2s var(--ag-ease)" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", transform: `translateX(${on ? 18 : 0}px)`,
        transition: "transform .2s var(--ag-ease)", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
    </button>
  );
}

export default function Settings() {
  const { t, tc, pop, push, lang, setLang, toast } = useApp();
  const { mode, setTheme } = useTheme();
  const [notif, setNotif] = useState(() => notificationService.isEnabled());
  const [topicPrefs, setTopicPrefs] = useState(() => fcmService.getTopicPrefs());
  const [langSheet, setLangSheet] = useState(false);
  // Developer mode is toggled by the 7-tap version easter egg on the About page.
  const devMode = (() => { try { return JSON.parse(localStorage.getItem("agrios:devMode")) === true; } catch { return false; } })();
  const current = LANGUAGES.find((l) => l.code === lang);

  const setNotifP = async (v) => {
    if (v && notificationService.getPermission() !== "granted") {
      const result = await notificationService.requestPermission();
      const granted = result === "granted";
      setNotif(granted);
      toast(granted ? tc({ en: "Notifications enabled", hi: "सूचनाएँ चालू", bn: "বিজ্ঞপ্তি চালু হয়েছে" }) : tc({ en: "Blocked — enable in browser settings", hi: "ब्लॉक — ब्राउज़र सेटिंग्स में चालू करें", bn: "ব্লক — ব্রাউজার সেটিংসে চালু করুন" }), granted ? "success" : "info");
      return;
    }
    notificationService.setEnabled(v);
    setNotif(v);
    toast(v ? tc({ en: "Notifications on", hi: "सूचनाएँ चालू", bn: "বিজ্ঞপ্তি চালু" }) : tc({ en: "Notifications off", hi: "सूचनाएँ बंद", bn: "বিজ্ঞপ্তি বন্ধ" }), "success");
  };

  const themeOpts = [
    { k: "light", label: t("light"), icon: "Sun" },
    { k: "dark", label: t("dark"), icon: "Moon" },
    { k: "system", label: t("system"), icon: "SmartphoneNfc" },
  ];

  return (
    <>
      <AppBar title={t("settings")} onBack={pop} />
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 18, animation: "ag-fade .25s var(--ag-ease)" }}>
        {/* theme */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .4, marginBottom: 10, padding: "0 2px" }}>{t("theme")}</div>
          <div style={{ display: "flex", gap: 10 }}>
            {themeOpts.map((o) => {
              const on = mode === o.k;
              return (
                <button key={o.k} onClick={() => setTheme(o.k)}
                  style={{ flex: 1, display: "grid", justifyItems: "center", gap: 8, padding: "16px 8px", borderRadius: T.rLg, cursor: "pointer", fontFamily: T.body,
                    background: on ? T.primarySoft : T.surface, border: `1.5px solid ${on ? T.primary : T.line}`, transition: "all .18s var(--ag-ease)" }}>
                  <Icon name={o.icon} size={22} style={{ color: on ? T.primary : T.inkSoft }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: on ? T.primary : T.inkSoft }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Card pad={6}>
          <Row icon="SlidersHorizontal" label={tc({ en: "Personalize", hi: "अनुकूलित करें", bn: "ব্যক্তিগতকরণ" })} onClick={() => push({ kind: "personalize" })}>
            <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
          </Row>
          <Row icon="Bell" label={t("notifications")}><Toggle on={notif} onChange={setNotifP} /></Row>
          {notif && (
            <>
              {[
                { key: "order_updates", icon: "Package", label: { en: "Order Updates", hi: "ऑर्डर अपडेट", bn: "অর্ডার আপডেট" } },
                { key: "weather_alerts", icon: "CloudRain", label: { en: "Weather Alerts", hi: "मौसम अलर्ट", bn: "আবহাওয়া সতর্কতা" } },
                { key: "price_changes", icon: "TrendingUp", label: { en: "Price Changes", hi: "मूल्य परिवर्तन", bn: "মূল্য পরিবর্তন" } },
              ].map((topic) => (
                <Row key={topic.key} icon={topic.icon} label={tc(topic.label)}>
                  <Toggle on={topicPrefs[topic.key] ?? true} onChange={(v) => {
                    setTopicPrefs((p) => ({ ...p, [topic.key]: v }));
                    fcmService.setTopicPref(topic.key, v);
                  }} />
                </Row>
              ))}
            </>
          )}
          <Row icon="Languages" label={t("language")} onClick={() => setLangSheet(true)}>
            <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 600 }}>{current?.native} <Icon name="ChevronRight" size={16} style={{ verticalAlign: -3, color: T.inkFaint }} /></span>
          </Row>
          {devMode && (
            <Row icon="Key" label={tc({ en: "API Key Manager", hi: "API कुंजी प्रबंधक", bn: "API কী ম্যানেজার" })} onClick={() => push({ kind: "apiKeyManager" })}>
              <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
            </Row>
          )}
          <Row icon="ShieldCheck" label={t("security")} onClick={() => push({ kind: "security" })}>
            <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
          </Row>
          <Row icon="SlidersHorizontal" label={t("permissions")} onClick={() => push({ kind: "permissions" })} last>
            <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
          </Row>
        </Card>

        <Card pad={6}>
          <Row icon="Info" label={t("about")} onClick={() => push({ kind: "about" })} last>
            <span style={{ fontSize: 13, color: T.inkFaint }}>v2.0.0 <Icon name="ChevronRight" size={16} style={{ verticalAlign: -3, color: T.inkFaint }} /></span>
          </Row>
        </Card>
      </div>

      <BottomSheet open={langSheet} onClose={() => setLangSheet(false)} title={t("language")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {LANGUAGES.map((l) => {
            const on = l.code === lang;
            return (
              <button key={l.code} onClick={() => { setLang(l.code); setLangSheet(false); toast(tc({ en: "Language updated", hi: "भाषा बदली गई", bn: "ভাষা পরিবর্তন হয়েছে" }), "success"); }}
                style={{ textAlign: "left", padding: "13px 15px", borderRadius: T.rLg, cursor: "pointer", fontFamily: T.body,
                  border: `1.5px solid ${on ? T.primary : T.line}`, background: on ? T.primarySoft : T.surface }}>
                <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700, color: on ? T.primary : T.ink }}>{l.native}</div>
                <div style={{ fontSize: 12, color: T.inkSoft }}>{l.label}</div>
              </button>

            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
