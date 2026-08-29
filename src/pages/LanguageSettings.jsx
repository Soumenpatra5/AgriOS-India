/* Language, on its own screen.

   Profile → Language used to push the whole Settings screen, where language
   was one row among security, API keys and notifications; the farmer then had
   to find it, open a sheet, and Back returned them to Settings rather than to
   Profile. This is the destination that row always meant.

   No Save button: setLang() applies immediately and persists, which is what
   the rest of the app already does. A confirm step would only put a tap
   between the farmer and the thing they came here to change. */

import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import LanguagePicker, { deviceLanguage } from "../components/LanguagePicker.jsx";
import { LANGUAGES } from "../constants/languages.js";

export default function LanguageSettings() {
  const { pop, lang, setLang, t, tc, toast } = useApp();

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
  const suggested = deviceLanguage();
  const showSuggestion = suggested && suggested.code !== lang;

  const choose = (code) => {
    if (code === lang) { pop(); return; }
    setLang(code);
    toast(tc({ en: "Language updated", hi: "भाषा बदली गई", bn: "ভাষা পরিবর্তন হয়েছে" }), "success");
    /* Straight back to where they came from — Profile, or wherever else opened
       this. The stack does that for us; no route is hardcoded. */
    pop();
  };

  return (
    <>
      <AppBar title={t("language")} onBack={pop} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 16, animation: "ag-fade .25s var(--ag-ease)" }}>

        <Card pad={14} style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: T.primarySoft, color: T.primary,
            display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name="Languages" size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: T.inkSoft }}>
              {tc({ en: "Current language", hi: "वर्तमान भाषा", bn: "বর্তমান ভাষা" })}
            </div>
            <div lang={current.code} style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: T.ink, marginTop: 2 }}>
              {current.native}
            </div>
          </div>
          {!current.t && (
            <span style={{ fontSize: 10.5, fontWeight: 700, color: T.orange, background: T.orangeSoft,
              padding: "3px 8px", borderRadius: T.pill, flexShrink: 0 }}>
              {tc({ en: "English UI", hi: "अंग्रेज़ी UI", bn: "ইংরেজি UI" })}
            </span>
          )}
        </Card>

        {showSuggestion && (
          <button type="button" onClick={() => choose(suggested.code)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", cursor: "pointer",
              textAlign: "left", width: "100%", background: T.surface2, border: `1px solid ${T.line}`,
              borderRadius: T.rMd, fontFamily: T.body, color: T.ink }}>
            <Icon name="Sparkles" size={16} style={{ color: T.primary, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
              {tc({
                en: `Your phone is set to ${suggested.label}. Use it here too?`,
                hi: `आपका फ़ोन ${suggested.label} पर सेट है। यहाँ भी वही रखें?`,
                bn: `আপনার ফোন ${suggested.label} ভাষায় সেট করা। এখানেও সেটি ব্যবহার করবেন?`,
              })}
            </span>
            <span lang={suggested.code} style={{ fontSize: 13, fontWeight: 700, color: T.primary, flexShrink: 0 }}>
              {suggested.native}
            </span>
          </button>
        )}

        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase",
            letterSpacing: .4, marginBottom: 10, padding: "0 2px" }}>
            {tc({ en: "Available languages", hi: "उपलब्ध भाषाएँ", bn: "উপলব্ধ ভাষা" })}
          </div>
          <LanguagePicker value={lang} onSelect={choose} />
        </div>

        <div style={{ fontSize: 11.5, color: T.inkFaint, lineHeight: 1.6 }}>
          {tc({
            en: "Languages marked “English UI” are listed because the app can store your data in them, but its screens are still English. More are being translated.",
            hi: "“अंग्रेज़ी UI” चिह्नित भाषाएँ इसलिए दिखती हैं कि ऐप उनमें आपका डेटा रख सकता है, पर स्क्रीन अभी अंग्रेज़ी में हैं। और भाषाओं का अनुवाद हो रहा है।",
            bn: "“ইংরেজি UI” চিহ্নিত ভাষাগুলি দেখানো হয় কারণ অ্যাপ সেগুলিতে আপনার তথ্য রাখতে পারে, তবে স্ক্রিন এখনও ইংরেজিতে। আরও ভাষার অনুবাদ চলছে।",
          })}
        </div>
      </div>
    </>
  );
}
