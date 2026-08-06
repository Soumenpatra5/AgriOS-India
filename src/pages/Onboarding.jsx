import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { Button, accent } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { usePrefs } from "../customize/PreferencesProvider.jsx";
import { profileMemory } from "../ai/memory/profileMemory.js";
import { ONBOARDING } from "../constants/content.js";

export default function Onboarding() {
  const { finishOnboarding, t, tc, toast } = useApp();
  const { set } = usePrefs();
  const [i, setI] = useState(0);
  const [personalize, setPersonalize] = useState(false);

  const slide = ONBOARDING[i];
  const c = accent(slide?.accent || "primary");
  const lastSlide = i === ONBOARDING.length - 1;

  if (personalize) {
    return <PersonalizeStep set={set} finish={finishOnboarding} t={t} tc={tc} toast={toast} />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "18px 22px 24px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={finishOnboarding} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, fontFamily: T.body, fontSize: 14, fontWeight: 600, padding: 8 }}>
          {t("skip")}
        </button>
      </div>

      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", animation: "ag-rise .35s var(--ag-ease)" }}>
        <div style={{ width: 128, height: 128, borderRadius: 40, background: c.bg, color: c.fg, display: "grid", placeItems: "center", marginBottom: 30, boxShadow: T.shadowMd }}>
          <Icon name={slide.icon} size={60} strokeWidth={1.9} />
        </div>
        <h1 style={{ fontFamily: T.display, fontSize: 27, fontWeight: 800, margin: "0 0 12px", color: T.ink, maxWidth: 320, lineHeight: 1.2 }}>{tc(slide.title)}</h1>
        <p style={{ fontSize: 15, color: T.inkSoft, lineHeight: 1.6, maxWidth: 320, margin: 0 }}>{tc(slide.body)}</p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 7, marginBottom: 22 }}>
        {ONBOARDING.map((_, k) => (
          <div key={k} style={{ height: 7, width: k === i ? 24 : 7, borderRadius: 4, background: k === i ? T.primary : T.line, transition: "all .3s var(--ag-ease)" }} />
        ))}
      </div>

      <Button full size="lg" onClick={() => (lastSlide ? setPersonalize(true) : setI(i + 1))}>
        {t("next")}
      </Button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "12px 14px", borderRadius: T.rMd, border: `1px solid ${T.line}`,
          background: T.surface2, color: T.ink, fontFamily: T.body, fontSize: 14.5, outline: "none", boxSizing: "border-box" }} />
      {hint && <span style={{ fontSize: 11.5, color: T.inkFaint }}>{hint}</span>}
    </div>
  );
}

function PersonalizeStep({ set, finish, t, tc, toast }) {
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [crops, setCrops] = useState("");

  const save = () => {
    if (state.trim()) set("region.state", state.trim());
    if (district.trim()) set("region.district", district.trim());
    const loc = [district.trim(), state.trim()].filter(Boolean).join(", ");
    profileMemory.update({
      location: loc,
      crops: crops.split(",").map((s) => s.trim()).filter(Boolean),
    });
    toast(tc({ en: "All set — welcome!", hi: "सब तैयार — स्वागत है!", bn: "সব প্রস্তুত — স্বাগতম!" }), "success");
    finish();
  };

  const anything = state.trim() || district.trim() || crops.trim();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "18px 22px 24px", animation: "ag-rise .3s var(--ag-ease)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={finish} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, fontFamily: T.body, fontSize: 14, fontWeight: 600, padding: 8 }}>
          {t("skip")}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: T.primarySoft, color: T.primary, display: "grid", placeItems: "center", marginBottom: 18 }}>
          <Icon name="Sprout" size={30} />
        </div>
        <h1 style={{ fontFamily: T.display, fontSize: 25, fontWeight: 800, margin: "0 0 6px", color: T.ink, lineHeight: 1.2 }}>
          {tc({ en: "Tell us about your farm", hi: "अपने खेत के बारे में बताएँ", bn: "আপনার খামার সম্পর্কে বলুন" })}
        </h1>
        <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 24px" }}>
          {tc({ en: "This tailors weather, mandi prices and AI advice to you. You can skip and add it later.",
            hi: "इससे मौसम, मंडी भाव और AI सलाह आपके अनुसार बनती है। आप छोड़कर बाद में जोड़ सकते हैं।",
            bn: "এটি আবহাওয়া, মান্ডি দর ও AI পরামর্শ আপনার জন্য সাজায়। আপনি এড়িয়ে পরে যোগ করতে পারেন।" })}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label={tc({ en: "State", hi: "राज्य", bn: "রাজ্য" })} value={state} onChange={setState}
            placeholder={tc({ en: "e.g. West Bengal", hi: "जैसे पश्चिम बंगाल", bn: "যেমন পশ্চিমবঙ্গ" })} />
          <Field label={tc({ en: "District", hi: "ज़िला", bn: "জেলা" })} value={district} onChange={setDistrict}
            placeholder={tc({ en: "e.g. Hooghly", hi: "जैसे हुगली", bn: "যেমন হুগলি" })} />
          <Field label={tc({ en: "Main crops", hi: "मुख्य फसलें", bn: "প্রধান ফসল" })} value={crops} onChange={setCrops}
            placeholder={tc({ en: "Paddy, Potato, Mustard…", hi: "धान, आलू, सरसों…", bn: "ধান, আলু, সরিষা…" })}
            hint={tc({ en: "Comma separated", hi: "अल्पविराम से अलग करें", bn: "কমা দিয়ে আলাদা করুন" })} />
        </div>
      </div>

      <Button full size="lg" icon="Check" onClick={anything ? save : finish}>
        {t("getStarted")}
      </Button>
    </div>
  );
}
