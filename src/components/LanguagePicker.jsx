/* The language grid, shared by every place that offers one.

   There were already two hand-rolled copies — the onboarding picker and the
   Settings bottom sheet — so the dedicated Language screen uses this rather
   than becoming a third. They differ only in what happens after a choice, so
   that is the prop.

   `t: false` languages are listed but honestly badged: the app has no
   dictionary for them yet and falls back to English. Hiding them would be
   tidier; saying so is more useful to someone deciding whether to switch. */

import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";
import { useApp } from "../store/AppStore.jsx";
import { LANGUAGES } from "../constants/languages.js";

export default function LanguagePicker({ value, onSelect, compact = false, style }) {
  const { tc } = useApp();

  return (
    <div role="radiogroup"
      aria-label={tc({ en: "Language", hi: "भाषा", bn: "ভাষা" })}
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, ...style }}>
      {LANGUAGES.map((l) => {
        const on = value === l.code;
        return (
          <button key={l.code} type="button" role="radio" aria-checked={on}
            onClick={() => onSelect(l.code)}
            /* Marks the text itself as being in that language, so a screen
               reader pronounces "বাংলা" as Bengali rather than as English. */
            lang={l.code}
            style={{ textAlign: "left", padding: compact ? "13px 15px" : "15px 16px",
              borderRadius: T.rLg, cursor: "pointer", fontFamily: T.body,
              border: `1.5px solid ${on ? T.primary : T.line}`,
              background: on ? T.primarySoft : T.surface,
              transition: "all .18s var(--ag-ease)", position: "relative" }}>
            <div style={{ fontFamily: T.display, fontSize: compact ? 16 : 18, fontWeight: 700, color: on ? T.primary : T.ink }}>
              {l.native}
            </div>
            <div style={{ fontSize: compact ? 12 : 12.5, color: T.inkSoft, marginTop: 2 }}>{l.label}</div>
            {!l.t && (
              <div style={{ fontSize: 10.5, fontWeight: 600, color: T.orange, marginTop: compact ? 3 : 5 }}>
                {tc({ en: "English UI", hi: "अंग्रेज़ी UI", bn: "ইংরেজি UI" })}
              </div>
            )}
            {on && !compact && (
              <span style={{ position: "absolute", top: 12, right: 12, color: T.primary, display: "flex" }}>
                <Icon name="CheckCircle2" size={18} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* The language the device is already set to, if the app has it. Offered as a
   suggestion on the Language screen — a farmer whose phone is in Bengali most
   likely wants the app in Bengali too, and may not realise it is available. */
export function deviceLanguage() {
  if (typeof navigator === "undefined") return null;
  const tags = [navigator.language, ...(navigator.languages || [])].filter(Boolean);
  for (const tag of tags) {
    const base = String(tag).toLowerCase().split("-")[0];
    const hit = LANGUAGES.find((l) => l.code === base);
    if (hit) return hit;
  }
  return null;
}
