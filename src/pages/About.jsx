import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";

function LinkRow({ icon, label, onClick, last }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 12px", cursor: "pointer", borderTop: last ? `1px solid ${T.lineSoft}` : "none" }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: T.surface2, color: T.inkSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={18} />
      </div>
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: T.ink }}>{label}</span>
      <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
    </div>
  );
}

export default function About() {
  const { pop, tc, toast, push } = useApp();
  const [taps, setTaps] = useState(0);
  const [devMode, setDevMode] = useState(() => { try { return JSON.parse(localStorage.getItem("agrios:devMode")) === true; } catch { return false; } });

  const tapVersion = () => {
    const n = taps + 1; setTaps(n);
    if (n >= 7) {
      const next = !devMode; setDevMode(next);
      if (next) localStorage.setItem("agrios:devMode", "true"); else localStorage.removeItem("agrios:devMode");
      toast(next ? tc({ en: "Developer mode enabled", hi: "डेवलपर मोड चालू", bn: "ডেভেলপার মোড চালু হয়েছে" }) : tc({ en: "Developer mode disabled", hi: "डेवलपर मोड बंद", bn: "ডেভেলপার মোড বন্ধ হয়েছে" }), "info");
      setTaps(0);
    } else if (n >= 4) {
      toast(tc({ en: `${7 - n} taps to developer mode`, hi: `डेवलपर मोड तक ${7 - n} टैप`, bn: `ডেভেলপার মোডে ${7 - n} ট্যাপ বাকি` }), "info");
    }
  };

  return (
    <>
      <AppBar title={tc({ en: "About", hi: "परिचय", bn: "সম্পর্কে" })} onBack={pop} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 16, animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* hero */}
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, padding: "28px 20px" }}>
          <div style={{ width: 66, height: 66, borderRadius: 20, background: `linear-gradient(150deg, ${T.primary}, ${T.primaryDark})`, color: "#fff", display: "grid", placeItems: "center" }}>
            <Icon name="Sprout" size={32} />
          </div>
          <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 800, color: T.ink }}>AgriOS India</div>
          <button onClick={tapVersion} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, fontFamily: T.body, fontSize: 13 }}>v2.0.0</button>
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6, maxWidth: 300 }}>
            {tc({ en: "An AI-powered farm operating system built for Indian farmers — weather, diagnosis, records, prices, schemes and advice in your language.",
                  hi: "भारतीय किसानों के लिए बना एक AI-संचालित फार्म ऑपरेटिंग सिस्टम — मौसम, निदान, रिकॉर्ड, भाव, योजनाएँ और सलाह आपकी भाषा में।",
                  bn: "ভারতীয় কৃষকদের জন্য তৈরি একটি AI-চালিত ফার্ম অপারেটিং সিস্টেম — আবহাওয়া, রোগ নির্ণয়, রেকর্ড, দর, স্কিম ও পরামর্শ আপনার ভাষায়।" })}
          </div>
        </Card>

        <Card pad={6}>
          <LinkRow icon="LifeBuoy" label={tc({ en: "Support & FAQ", hi: "सहायता और सामान्य प्रश्न", bn: "সহায়তা ও প্রশ্ন" })} onClick={() => push({ kind: "support" })} />
          <LinkRow icon="Lock" label={tc({ en: "Privacy", hi: "गोपनीयता", bn: "গোপনীয়তা" })} onClick={() => push({ kind: "privacy" })} last />
        </Card>

        {/* KVK note */}
        <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: T.rMd, background: T.yellowSoft }}>
          <Icon name="Info" size={16} style={{ color: T.yellow, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.55 }}>
            {tc({ en: "AI advice can be wrong. For medicine, pesticide doses and animal treatment, always confirm with your local agriculture officer, vet, or KVK.",
                  hi: "AI सलाह गलत हो सकती है। दवा, कीटनाशक की मात्रा और पशु उपचार के लिए हमेशा स्थानीय कृषि अधिकारी, पशु चिकित्सक या KVK से पुष्टि करें।",
                  bn: "AI পরামর্শ ভুল হতে পারে। ওষুধ, কীটনাশকের মাত্রা ও পশু চিকিৎসার জন্য সর্বদা স্থানীয় কৃষি অফিসার, পশু চিকিৎসক বা KVK-র সঙ্গে নিশ্চিত করুন।" })}
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 11.5, color: T.inkFaint, lineHeight: 1.7 }}>
          {tc({ en: "Made for Indian farmers · English · हिन्दी · বাংলা", hi: "भारतीय किसानों के लिए · English · हिन्दी · বাংলা", bn: "ভারতীয় কৃষকদের জন্য · English · हिन्दी · বাংলা" })}
          <br />© 2026 AgriOS India
        </div>
      </div>
    </>
  );
}
