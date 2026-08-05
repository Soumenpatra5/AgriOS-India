import { useState, useEffect, useCallback } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";
import { useApp } from "../store/AppStore.jsx";
import { storage } from "../utils/storage.js";

const STEPS = [
  {
    icon: "MessageCircle",
    accent: "primary",
    title: { en: "AI Assistants", hi: "AI सहायक", bn: "AI সহায়ক" },
    body: { en: "Ask anything about farming — our AI experts cover crops, livestock, weather, loans and more.", hi: "खेती के बारे में कुछ भी पूछें — AI विशेषज्ञ फसल, पशुपालन, मौसम, ऋण सब बताएंगे।", bn: "চাষ নিয়ে যেকোনো প্রশ্ন করুন — AI বিশেষজ্ঞরা ফসল, পশুপালন, আবহাওয়া, ঋণ সব বলবেন।" },
  },
  {
    icon: "BookOpen",
    accent: "blue",
    title: { en: "Farm Ledger", hi: "खेत का खाता", bn: "খামারের খাতা" },
    body: { en: "Track income and expenses. Export as CSV for bank visits.", hi: "आय और खर्च ट्रैक करें। बैंक जाने के लिए CSV निर्यात करें।", bn: "আয় ও খরচ হিসাব রাখুন। ব্যাংকে যেতে CSV রপ্তানি করুন।" },
  },
  {
    icon: "CloudSun",
    accent: "blue",
    title: { en: "Live Weather", hi: "लाइव मौसम", bn: "লাইভ আবহাওয়া" },
    body: { en: "GPS auto-detects your location for real-time forecasts and spray windows.", hi: "GPS आपका स्थान पहचानकर लाइव मौसम और स्प्रे का समय बताता है।", bn: "GPS আপনার অবস্থান শনাক্ত করে লাইভ আবহাওয়া ও স্প্রে-র সময় জানায়।" },
  },
  {
    icon: "Microscope",
    accent: "red",
    title: { en: "Disease Detection", hi: "रोग पहचान", bn: "রোগ নির্ণয়" },
    body: { en: "Take a photo of your crop or animal — AI diagnoses the problem instantly.", hi: "फसल या पशु की फोटो खींचें — AI तुरंत रोग पहचानता है।", bn: "ফসল বা পশুর ছবি তুলুন — AI তৎক্ষণাৎ রোগ চিহ্নিত করে।" },
  },
  {
    icon: "Mic",
    accent: "orange",
    title: { en: "Voice Input", hi: "वॉइस इनपुट", bn: "ভয়েস ইনপুট" },
    body: { en: "Tap the mic icon on any text field to speak instead of type — works in Hindi, Bengali & more.", hi: "किसी भी फील्ड पर माइक दबाकर बोलें — हिंदी, बांग्ला सब चलता है।", bn: "যেকোনো ফিল্ডে মাইক টিপে বলুন — হিন্দি, বাংলা সব চলবে।" },
  },
];

export default function OnboardingTour() {
  const { tc } = useApp();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!storage.get("tour_done")) setVisible(true);
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else { setVisible(false); storage.set("tour_done", true); }
  }, [step]);

  const skip = useCallback(() => {
    setVisible(false);
    storage.set("tour_done", true);
  }, []);

  if (!visible) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center",
      background: "rgba(0,0,0,.55)", animation: "ag-fade .2s var(--ag-ease)" }}>
      <div style={{ width: "min(340px, 90vw)", background: T.surface, borderRadius: T.rXl,
        padding: 28, boxShadow: T.shadowLg, animation: "ag-pop .3s var(--ag-ease)", textAlign: "center" }}>

        <div style={{ width: 60, height: 60, borderRadius: 18, margin: "0 auto 18px",
          background: T[s.accent + "Soft"] || T.primarySoft, color: T[s.accent] || T.primary,
          display: "grid", placeItems: "center" }}>
          <Icon name={s.icon} size={30} />
        </div>

        <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 700, color: T.ink }}>{tc(s.title)}</div>
        <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 8, lineHeight: 1.6 }}>{tc(s.body)}</div>

        {/* dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "20px 0 18px" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3,
              background: i === step ? T.primary : T.lineSoft, transition: "all .2s" }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {!isLast && (
            <button onClick={skip}
              style={{ flex: 1, padding: "12px 0", borderRadius: T.rMd, border: `1px solid ${T.line}`,
                background: "none", cursor: "pointer", fontFamily: T.body, fontSize: 14, fontWeight: 600, color: T.inkSoft }}>
              {tc({ en: "Skip", hi: "छोड़ें", bn: "এড়িয়ে যান" })}
            </button>
          )}
          <button onClick={next}
            style={{ flex: 1, padding: "12px 0", borderRadius: T.rMd, border: "none",
              background: T.primary, color: "#fff", cursor: "pointer", fontFamily: T.body, fontSize: 14, fontWeight: 600 }}>
            {isLast ? tc({ en: "Get Started", hi: "शुरू करें", bn: "শুরু করুন" }) : tc({ en: "Next", hi: "अगला", bn: "পরবর্তী" })}
          </button>
        </div>
      </div>
    </div>
  );
}
