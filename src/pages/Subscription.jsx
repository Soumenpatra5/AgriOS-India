import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";

const PREMIUM_FEATURES = [
  { en: "Unlimited AI assistant questions", hi: "असीमित AI सहायक प्रश्न", bn: "সীমাহীন AI সহায়ক প্রশ্ন" },
  { en: "All diagnostic domains & detailed reports", hi: "सभी निदान क्षेत्र और विस्तृत रिपोर्ट", bn: "সব রোগ নির্ণয় ক্ষেত্র ও বিস্তারিত রিপোর্ট" },
  { en: "Bank-format project reports (DPR)", hi: "बैंक-फ़ॉर्मेट परियोजना रिपोर्ट (DPR)", bn: "ব্যাংক-ফরম্যাট প্রকল্প রিপোর্ট (DPR)" },
  { en: "Priority weather & market alerts", hi: "प्राथमिकता मौसम और बाज़ार अलर्ट", bn: "অগ্রাধিকার আবহাওয়া ও বাজার সতর্কতা" },
];
const FREE_FEATURES = [
  { en: "Daily weather & spray advice", hi: "दैनिक मौसम और स्प्रे सलाह", bn: "দৈনিক আবহাওয়া ও স্প্রে পরামর্শ" },
  { en: "Farm diary & ledger", hi: "खेत डायरी और खाता", bn: "খামার ডায়েরি ও খাতা" },
  { en: "AI assistant (limited)", hi: "AI सहायक (सीमित)", bn: "AI সহায়ক (সীমিত)" },
  { en: "Government schemes & prices", hi: "सरकारी योजनाएँ और भाव", bn: "সরকারি স্কিম ও দর" },
];

function FeatureLine({ text, tc, on }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
      <Icon name={on ? "CheckCircle2" : "Circle"} size={17} style={{ color: on ? T.primary : T.inkFaint, flexShrink: 0 }} />
      <span style={{ fontSize: 13.5, color: on ? T.ink : T.inkSoft }}>{tc(text)}</span>
    </div>
  );
}

export default function Subscription() {
  const { pop, tc, toast } = useApp();

  return (
    <>
      <AppBar title={tc({ en: "Subscription", hi: "सदस्यता", bn: "সাবস্ক্রিপশন" })} onBack={pop} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 16, animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* current plan */}
        <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: T.surface2, color: T.inkSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name="User" size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{tc({ en: "Free plan", hi: "फ्री प्लान", bn: "ফ্রি প্ল্যান" })}</div>
            <div style={{ fontSize: 12.5, color: T.inkSoft }}>{tc({ en: "Your current plan", hi: "आपका वर्तमान प्लान", bn: "আপনার বর্তমান প্ল্যান" })}</div>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: T.primary, background: T.primarySoft, padding: "4px 10px", borderRadius: 999 }}>{tc({ en: "Active", hi: "सक्रिय", bn: "সক্রিয়" })}</span>
        </Card>

        <Card style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .4, marginBottom: 6 }}>{tc({ en: "Included free", hi: "फ्री में शामिल", bn: "ফ্রিতে অন্তর্ভুক্ত" })}</div>
          {FREE_FEATURES.map((f, i) => <FeatureLine key={i} text={f} tc={tc} on />)}
        </Card>

        {/* premium */}
        <div style={{ borderRadius: T.rLg, padding: 18, color: "#fff", background: `linear-gradient(125deg, #B8860B, #C9930B)`, boxShadow: T.shadowMd }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Icon name="Crown" size={24} />
            <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 800 }}>{tc({ en: "AgriOS Premium", hi: "AgriOS प्रीमियम", bn: "AgriOS প্রিমিয়াম" })}</div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, fontFamily: T.display }}>₹99<span style={{ fontSize: 14, fontWeight: 500, opacity: .9 }}>/{tc({ en: "month", hi: "माह", bn: "মাস" })}</span></div>
          <div style={{ marginTop: 10 }}>
            {PREMIUM_FEATURES.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0" }}>
                <Icon name="Check" size={16} strokeWidth={3} />
                <span style={{ fontSize: 13.5 }}>{tc(f)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => toast(tc({ en: "Premium is coming soon — we'll notify you.", hi: "प्रीमियम जल्द आ रहा है — हम आपको सूचित करेंगे।", bn: "প্রিমিয়াম শীঘ্রই আসছে — আমরা আপনাকে জানাব।" }), "info")}
            style={{ width: "100%", marginTop: 14, padding: "13px", borderRadius: T.pill, border: "none", background: "#fff", color: "#8a6608", fontFamily: T.body, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {tc({ en: "Notify me at launch", hi: "लॉन्च पर सूचित करें", bn: "লঞ্চে জানান" })}
          </button>
        </div>

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({ en: "No payment is taken now. Pricing is indicative and may change at launch.", hi: "अभी कोई भुगतान नहीं लिया जाता। मूल्य सांकेतिक है और लॉन्च पर बदल सकता है।", bn: "এখন কোনো পেমেন্ট নেওয়া হয় না। মূল্য নির্দেশক এবং লঞ্চে বদলাতে পারে।" })}
        </div>
      </div>
    </>
  );
}
