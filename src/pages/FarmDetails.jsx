import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import { AppBar, Card } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { usePrefs } from "../customize/PreferencesProvider.jsx";
import { FARMER_TYPES, TYPE_LABELS } from "../customize/farmerTypes.js";
import { profileMemory } from "../ai/memory/profileMemory.js";

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

export default function FarmDetails() {
  const { pop, tc, toast, user, updateUser } = useApp();
  const { prefs, set } = usePrefs();
  const p = profileMemory.get();

  const [name, setName]       = useState(user?.name || "");
  const [state, setState]     = useState(prefs.region.state || "");
  const [district, setDistrict] = useState(prefs.region.district || "");
  const [land, setLand]       = useState(p.landSize || "");
  const [crops, setCrops]     = useState((p.crops || []).join(", "));
  const [livestock, setLivestock] = useState((p.livestock || []).join(", "));

  const save = () => {
    if (name.trim()) updateUser({ name: name.trim() });
    set("region.state", state.trim());
    set("region.district", district.trim());
    const loc = [district.trim(), state.trim()].filter(Boolean).join(", ");
    profileMemory.update({
      location: loc,
      landSize: land.trim(),
      crops: crops.split(",").map((s) => s.trim()).filter(Boolean),
      livestock: livestock.split(",").map((s) => s.trim()).filter(Boolean),
    });
    toast(tc({ en: "Farm details saved", hi: "खेत विवरण सहेजा गया", bn: "খামার বিবরণ সংরক্ষিত হয়েছে" }), "success");
    pop();
  };

  return (
    <>
      <AppBar title={tc({ en: "Farm details", hi: "खेत विवरण", bn: "খামার বিবরণ" })} onBack={pop} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 16, animation: "ag-fade .25s var(--ag-ease)" }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label={tc({ en: "Your name", hi: "आपका नाम", bn: "আপনার নাম" })} value={name} onChange={setName}
            placeholder={tc({ en: "e.g. Soumen Patra", hi: "जैसे सौमेन पात्रा", bn: "যেমন সৌমেন পাত্র" })} />
          <Field label={tc({ en: "State", hi: "राज्य", bn: "রাজ্য" })} value={state} onChange={setState}
            placeholder={tc({ en: "e.g. West Bengal", hi: "जैसे पश्चिम बंगाल", bn: "যেমন পশ্চিমবঙ্গ" })}
            hint={tc({ en: "Used for mandi prices & advice", hi: "मंडी भाव और सलाह के लिए", bn: "মান্ডি দর ও পরামর্শের জন্য" })} />
          <Field label={tc({ en: "District", hi: "ज़िला", bn: "জেলা" })} value={district} onChange={setDistrict}
            placeholder={tc({ en: "e.g. Hooghly", hi: "जैसे हुगली", bn: "যেমন হুগলি" })} />
          <Field label={tc({ en: "Land size", hi: "ज़मीन का आकार", bn: "জমির আকার" })} value={land} onChange={setLand}
            placeholder={tc({ en: "e.g. 3 acre / 5 bigha", hi: "जैसे 3 एकड़ / 5 बीघा", bn: "যেমন ৩ একর / ৫ বিঘা" })} />
          <Field label={tc({ en: "Main crops", hi: "मुख्य फसलें", bn: "প্রধান ফসল" })} value={crops} onChange={setCrops}
            placeholder={tc({ en: "Paddy, Potato, Mustard…", hi: "धान, आलू, सरसों…", bn: "ধান, আলু, সরিষা…" })}
            hint={tc({ en: "Comma separated", hi: "अल्पविराम से अलग करें", bn: "কমা দিয়ে আলাদা করুন" })} />
          <Field label={tc({ en: "Livestock", hi: "पशुधन", bn: "পশুসম্পদ" })} value={livestock} onChange={setLivestock}
            placeholder={tc({ en: "Poultry, Dairy cow, Goat…", hi: "मुर्गी, गाय, बकरी…", bn: "মুরগি, গরু, ছাগল…" })}
            hint={tc({ en: "Comma separated", hi: "अल्पविराम से अलग करें", bn: "কমা দিয়ে আলাদা করুন" })} />
        </Card>

        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, marginBottom: 10, padding: "0 2px" }}>
            {tc({ en: "What do you farm?", hi: "आप क्या खेती करते हैं?", bn: "আপনি কী চাষ করেন?" })}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FARMER_TYPES.map((k) => {
              const on = prefs.farmerProfile.types[k] !== false;
              return (
                <button key={k} onClick={() => set(`farmerProfile.types.${k}`, !on)}
                  style={{ padding: "9px 14px", borderRadius: T.pill, cursor: "pointer", fontFamily: T.body, fontSize: 13.5, fontWeight: 600,
                    border: `1.5px solid ${on ? T.primary : T.line}`, background: on ? T.primarySoft : T.surface, color: on ? T.primary : T.inkSoft, transition: "all .16s var(--ag-ease)" }}>
                  {tc(TYPE_LABELS[k])}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 8, padding: "0 2px" }}>
            {tc({ en: "Diagnostics & livestock tailor to your enterprises.", hi: "निदान और पशुपालन आपके उद्यमों के अनुसार दिखेंगे।", bn: "রোগ নির্ণয় ও পশুপালন আপনার উদ্যোগ অনুযায়ী দেখাবে।" })}
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: T.inkFaint, lineHeight: 1.6, textAlign: "center" }}>
          {tc({ en: "These details personalize your AI advice, market prices and reminders.", hi: "ये विवरण आपकी AI सलाह, बाज़ार भाव और रिमाइंडर को व्यक्तिगत बनाते हैं।", bn: "এই বিবরণ আপনার AI পরামর্শ, বাজার দর ও রিমাইন্ডার ব্যক্তিগত করে।" })}
        </div>

        <button onClick={save}
          style={{ width: "100%", padding: "14px", borderRadius: T.pill, border: "none", background: T.primary, color: T.onPrimary,
            fontFamily: T.body, fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: T.shadowSm }}>
          {tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}
        </button>
      </div>
    </>
  );
}
