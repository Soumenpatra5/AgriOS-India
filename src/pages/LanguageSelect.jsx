import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { Button } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { LANGUAGES } from "../constants/languages.js";
import LanguagePicker from "../components/LanguagePicker.jsx";
import { storage } from "../utils/storage.js";

export default function LanguageSelect() {
  const { setLang, setStage, t, tc } = useApp();
  const [sel, setSel] = useState(storage.get("lang", "en"));

  const cont = () => { setLang(sel); setStage(storage.get("onboarded") ? (storage.get("user") ? "app" : "auth") : "onboarding"); };
  const selPartial = !LANGUAGES.find((l) => l.code === sel)?.t;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "40px 22px 24px" }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: T.primarySoft, color: T.primary, display: "grid", placeItems: "center", marginBottom: 18 }}>
        <Icon name="Languages" size={24} />
      </div>
      <h1 style={{ fontFamily: T.display, fontSize: 27, fontWeight: 800, margin: "0 0 6px", color: T.ink }}>{t("chooseLang")}</h1>
      <p style={{ fontSize: 14, color: T.inkSoft, margin: "0 0 22px" }}>{t("chooseLangSub")}</p>

      <LanguagePicker value={sel} onSelect={setSel} style={{ flex: 1, alignContent: "start" }} />

      {selPartial && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 16, padding: "10px 12px", borderRadius: T.rMd, background: T.orangeSoft }}>
          <Icon name="Info" size={15} style={{ color: T.orange, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.5 }}>
            {tc({
              en: "The app menus show in English for this language for now — AI advice still replies in your language. Full translation is coming.",
              hi: "इस भाषा के लिए ऐप मेन्यू अभी अंग्रेज़ी में दिखेंगे — AI सलाह फिर भी आपकी भाषा में मिलेगी। पूरा अनुवाद जल्द आ रहा है।",
              bn: "এই ভাষার জন্য অ্যাপ মেনু এখন ইংরেজিতে দেখাবে — AI পরামর্শ তবুও আপনার ভাষায় উত্তর দেবে। সম্পূর্ণ অনুবাদ শীঘ্রই আসছে।",
            })}
          </div>
        </div>
      )}

      <Button full size="lg" onClick={cont} style={{ marginTop: 20 }}>{t("continue")}</Button>
    </div>
  );
}
