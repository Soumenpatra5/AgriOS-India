import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";

export default function Payments() {
  const { pop, tc, push } = useApp();

  return (
    <>
      <AppBar title={tc({ en: "Payments", hi: "भुगतान", bn: "পেমেন্ট" })} onBack={pop} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 16, animation: "ag-fade .25s var(--ag-ease)" }}>

        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "32px 20px" }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: T.surface2, color: T.inkSoft, display: "grid", placeItems: "center" }}>
            <Icon name="Wallet" size={28} />
          </div>
          <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: T.ink }}>{tc({ en: "No payment methods", hi: "कोई भुगतान विधि नहीं", bn: "কোনো পেমেন্ট পদ্ধতি নেই" })}</div>
          <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.6, maxWidth: 300 }}>
            {tc({ en: "The app is free to use. Payment options (UPI, cards) will appear here when AgriOS Premium launches.",
                  hi: "ऐप उपयोग के लिए मुफ़्त है। AgriOS Premium लॉन्च होने पर भुगतान विकल्प (UPI, कार्ड) यहाँ दिखेंगे।",
                  bn: "অ্যাপটি ব্যবহারে বিনামূল্যে। AgriOS Premium চালু হলে পেমেন্ট বিকল্প (UPI, কার্ড) এখানে দেখা যাবে।" })}
          </div>
        </Card>

        <button onClick={() => push({ kind: "subscription" })}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: 14, borderRadius: T.rLg, cursor: "pointer",
            background: T.primarySoft, color: T.primary, border: "none", fontFamily: T.body, fontSize: 14.5, fontWeight: 600 }}>
          <Icon name="Crown" size={18} /> {tc({ en: "See Premium plans", hi: "प्रीमियम प्लान देखें", bn: "প্রিমিয়াম প্ল্যান দেখুন" })}
        </button>

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({ en: "For security, payment details are never stored in the app.", hi: "सुरक्षा के लिए, भुगतान विवरण ऐप में कभी संग्रहीत नहीं होते।", bn: "নিরাপত্তার জন্য, পেমেন্ট বিবরণ কখনও অ্যাপে সংরক্ষিত হয় না।" })}
        </div>
      </div>
    </>
  );
}
