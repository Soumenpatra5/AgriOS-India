import { useEffect, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { notificationService } from "../services/notifications/notificationService.js";

const STATE_LABEL = {
  granted: { en: "Allowed", hi: "अनुमति", bn: "অনুমোদিত" },
  denied:  { en: "Blocked", hi: "अवरुद्ध", bn: "অবরুদ্ধ" },
  prompt:  { en: "Ask", hi: "पूछें", bn: "জিজ্ঞাসা" },
  unknown: { en: "Unknown", hi: "अज्ञात", bn: "অজানা" },
};
const STATE_COLOR = { granted: "primary", denied: "red", prompt: "orange", unknown: "inkSoft" };

async function queryPerm(name) {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const r = await navigator.permissions.query({ name });
    return r.state; // granted | denied | prompt
  } catch { return "unknown"; }
}

export default function Permissions() {
  const { pop, tc, toast } = useApp();
  const [notif, setNotif] = useState(typeof Notification !== "undefined" ? Notification.permission : "unknown");
  const [loc, setLoc] = useState("unknown");
  const [cam, setCam] = useState("unknown");

  const refresh = async () => {
    setNotif(typeof Notification !== "undefined" ? Notification.permission : "unknown");
    setLoc(await queryPerm("geolocation"));
    setCam(await queryPerm("camera"));
  };
  useEffect(() => { refresh(); }, []);

  const askNotif = async () => {
    const r = await notificationService.requestPermission();
    setNotif(r);
    toast(r === "granted" ? tc({ en: "Notifications allowed", hi: "सूचनाएँ अनुमत", bn: "বিজ্ঞপ্তি অনুমোদিত" }) : tc({ en: "Enable in browser settings", hi: "ब्राउज़र सेटिंग्स में चालू करें", bn: "ব্রাউজার সেটিংসে চালু করুন" }), r === "granted" ? "success" : "info");
  };
  const askLoc = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(() => { setLoc("granted"); toast(tc({ en: "Location allowed", hi: "स्थान अनुमत", bn: "অবস্থান অনুমোদিত" }), "success"); },
      () => { setLoc("denied"); toast(tc({ en: "Location blocked", hi: "स्थान अवरुद्ध", bn: "অবস্থান অবরুদ্ধ" }), "info"); });
  };

  const PERMS = [
    { icon: "Bell", label: { en: "Notifications", hi: "सूचनाएँ", bn: "বিজ্ঞপ্তি" }, sub: { en: "Weather, price & reminder alerts", hi: "मौसम, मूल्य और रिमाइंडर अलर्ट", bn: "আবহাওয়া, দাম ও রিমাইন্ডার সতর্কতা" }, state: notif, ask: notif !== "granted" ? askNotif : null },
    { icon: "MapPin", label: { en: "Location", hi: "स्थान", bn: "অবস্থান" }, sub: { en: "Local weather & nearby services", hi: "स्थानीय मौसम और आस-पास सेवाएँ", bn: "স্থানীয় আবহাওয়া ও কাছাকাছি সেবা" }, state: loc, ask: loc !== "granted" ? askLoc : null },
    { icon: "Camera", label: { en: "Camera", hi: "कैमरा", bn: "ক্যামেরা" }, sub: { en: "Photos for disease diagnosis", hi: "रोग निदान के लिए फ़ोटो", bn: "রোগ নির্ণয়ের জন্য ছবি" }, state: cam, ask: null },
  ];

  return (
    <>
      <AppBar title={tc({ en: "Permissions", hi: "अनुमतियाँ", bn: "অনুমতি" })} onBack={pop}
        action={<button onClick={refresh} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, cursor: "pointer", color: T.ink, display: "flex" }}><Icon name="RefreshCw" size={18} /></button>} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 12, animation: "ag-fade .25s var(--ag-ease)" }}>
        {PERMS.map((p, i) => {
          const st = STATE_LABEL[p.state] || STATE_LABEL.unknown;
          const col = T[STATE_COLOR[p.state] || "inkSoft"] || T.inkSoft;
          return (
            <Card key={i} style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: T.surface2, color: T.inkSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name={p.icon} size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{tc(p.label)}</div>
                <div style={{ fontSize: 12.5, color: T.inkSoft }}>{tc(p.sub)}</div>
              </div>
              {p.ask ? (
                <button onClick={p.ask} style={{ background: T.primarySoft, color: T.primary, border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontFamily: T.body, fontSize: 12.5, fontWeight: 600 }}>
                  {tc({ en: "Allow", hi: "अनुमति", bn: "অনুমতি" })}
                </button>
              ) : (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: col, background: `${col}18`, padding: "4px 10px", borderRadius: 999 }}>{tc(st)}</span>
              )}
            </Card>
          );
        })}
        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({ en: "Blocked permissions can only be re-enabled from your browser's site settings.", hi: "अवरुद्ध अनुमतियाँ केवल ब्राउज़र की साइट सेटिंग्स से फिर से चालू की जा सकती हैं।", bn: "অবরুদ্ধ অনুমতি শুধু ব্রাউজারের সাইট সেটিংস থেকে পুনরায় চালু করা যায়।" })}
        </div>
      </div>
    </>
  );
}
