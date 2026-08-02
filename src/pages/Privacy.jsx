import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card, BottomSheet } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { storage } from "../utils/storage.js";

function Row({ icon, label, sub, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "13px 12px", background: "none",
        border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: danger ? T.redSoft : T.surface2, color: danger ? T.red : T.inkSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: danger ? T.red : T.ink }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, color: T.inkSoft }}>{sub}</div>}
      </div>
      <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
    </button>
  );
}

export default function Privacy() {
  const { pop, tc, toast, push } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);

  const downloadData = () => {
    const data = {};
    for (const k of Object.keys(localStorage)) if (k.startsWith("agrios:")) data[k] = localStorage.getItem(k);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "agrios-my-data.json"; a.click();
    URL.revokeObjectURL(url);
    toast(tc({ en: "Your data downloaded", hi: "आपका डेटा डाउनलोड हुआ", bn: "আপনার তথ্য ডাউনলোড হয়েছে" }), "success");
  };

  const clearData = () => {
    storage.clear();
    setConfirmClear(false);
    toast(tc({ en: "Local data cleared", hi: "स्थानीय डेटा साफ़ हुआ", bn: "স্থানীয় তথ্য মুছে ফেলা হয়েছে" }), "success");
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <>
      <AppBar title={tc({ en: "Privacy", hi: "गोपनीयता", bn: "গোপনীয়তা" })} onBack={pop} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 18, animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* summary */}
        <Card style={{ display: "flex", gap: 12 }}>
          <Icon name="ShieldCheck" size={22} style={{ color: T.primary, flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.6 }}>
            {tc({ en: "Your farm data stays on your device and syncs privately to your account. We never sell your data, and photos you send for diagnosis are used only to answer your question.",
                  hi: "आपका खेत डेटा आपके डिवाइस पर रहता है और निजी रूप से आपके खाते में सिंक होता है। हम आपका डेटा कभी नहीं बेचते, और निदान के लिए भेजी गई फ़ोटो केवल आपके प्रश्न का उत्तर देने के लिए उपयोग होती हैं।",
                  bn: "আপনার খামারের তথ্য আপনার ডিভাইসে থাকে ও ব্যক্তিগতভাবে আপনার অ্যাকাউন্টে সিঙ্ক হয়। আমরা কখনও আপনার তথ্য বিক্রি করি না, এবং রোগ নির্ণয়ের জন্য পাঠানো ছবি শুধু আপনার প্রশ্নের উত্তর দিতে ব্যবহৃত হয়।" })}
          </div>
        </Card>

        {/* controls */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .4, marginBottom: 10, padding: "0 2px" }}>{tc({ en: "Your data", hi: "आपका डेटा", bn: "আপনার তথ্য" })}</div>
          <Card pad={6} style={{ display: "flex", flexDirection: "column" }}>
            <Row icon="Download" label={tc({ en: "Download my data", hi: "मेरा डेटा डाउनलोड करें", bn: "আমার তথ্য ডাউনলোড করুন" })} sub={tc({ en: "Everything stored on this device", hi: "इस डिवाइस पर सहेजा सब कुछ", bn: "এই ডিভাইসে সংরক্ষিত সব" })} onClick={downloadData} />
            <div style={{ borderTop: `1px solid ${T.lineSoft}` }} />
            <Row icon="CloudOff" label={tc({ en: "Offline & sync settings", hi: "ऑफ़लाइन और सिंक सेटिंग्स", bn: "অফলাইন ও সিঙ্ক সেটিংস" })} sub={tc({ en: "Control cloud syncing", hi: "क्लाउड सिंक नियंत्रित करें", bn: "ক্লাউড সিঙ্ক নিয়ন্ত্রণ করুন" })} onClick={() => push({ kind: "personalize" })} />
            <div style={{ borderTop: `1px solid ${T.lineSoft}` }} />
            <Row icon="Trash2" label={tc({ en: "Clear local data", hi: "स्थानीय डेटा साफ़ करें", bn: "স্থানীয় তথ্য মুছুন" })} sub={tc({ en: "Remove everything from this device", hi: "इस डिवाइस से सब हटाएँ", bn: "এই ডিভাইস থেকে সব সরান" })} onClick={() => setConfirmClear(true)} danger />
          </Card>
        </div>

        <div style={{ textAlign: "center", fontSize: 11.5, color: T.inkFaint, lineHeight: 1.6 }}>
          {tc({ en: "AgriOS India · Privacy is handled per Indian data-protection norms.", hi: "AgriOS India · गोपनीयता भारतीय डेटा-सुरक्षा मानकों के अनुसार।", bn: "AgriOS India · গোপনীয়তা ভারতীয় তথ্য-সুরক্ষা নিয়ম অনুযায়ী।" })}
        </div>
      </div>

      <BottomSheet open={confirmClear} onClose={() => setConfirmClear(false)} title={tc({ en: "Clear local data?", hi: "स्थानीय डेटा साफ़ करें?", bn: "স্থানীয় তথ্য মুছবেন?" })}>
        <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5, marginBottom: 16 }}>
          {tc({ en: "This removes all app data from this device and signs you out. Data synced to your account can be restored on next sign-in.",
                hi: "यह इस डिवाइस से सारा ऐप डेटा हटाता है और आपको साइन आउट करता है। आपके खाते में सिंक डेटा अगली बार साइन इन पर बहाल हो सकता है।",
                bn: "এটি এই ডিভাইস থেকে সমস্ত অ্যাপ ডেটা মুছে দেয় ও আপনাকে সাইন আউট করে। আপনার অ্যাকাউন্টে সিঙ্ক করা তথ্য পরবর্তী সাইন-ইনে পুনরুদ্ধার হতে পারে।" })}
        </div>
        <button onClick={clearData}
          style={{ width: "100%", padding: "13px", borderRadius: T.pill, border: "none", background: T.red, color: "#fff", fontFamily: T.body, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          {tc({ en: "Clear everything", hi: "सब साफ़ करें", bn: "সব মুছুন" })}
        </button>
      </BottomSheet>
    </>
  );
}
