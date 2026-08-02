import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import { AppBar, SearchBar, Card, IconTile } from "../components/index.js";
import Icon from "../components/Icon.jsx";
import { EmptyState } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { usePrefs } from "../customize/PreferencesProvider.jsx";
import { SERVICES } from "../constants/content.js";

export default function Services() {
  const { t, tc, push, lang } = useApp();
  const { prefs } = usePrefs();
  const grid = prefs.layout.view !== "list";
  const [q, setQ] = useState("");
  const list = SERVICES.filter((x) => {
    const title = typeof x.title === "object" ? Object.values(x.title).join(" ") : x.title;
    const desc = typeof x.desc === "object" ? Object.values(x.desc).join(" ") : x.desc;
    return (title + desc).toLowerCase().includes(q.toLowerCase());
  });
  const open = (x) => x.kind
    ? push({ kind: x.kind, props: x.props })
    : push({ kind: "feature", props: { title: tc(x.title), desc: tc(x.desc), icon: x.icon, a: x.accent } });

  return (
    <>
      <AppBar title={t("servicesTitle")} large />
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 16, animation: "ag-fade .25s var(--ag-ease)" }}>
        <SearchBar value={q} onChange={setQ} placeholder={tc({ en: "Search services…", hi: "सेवाएँ खोजें…", bn: "সেবা খুঁজুন…" })} mic lang={lang} />
        {list.length === 0 ? (
          <EmptyState icon="SearchX" title={tc({ en: "No services found", hi: "कोई सेवा नहीं मिली", bn: "কোনো সেবা পাওয়া যায়নি" })} body={tc({ en: `Nothing matches "${q}". Try a different word.`, hi: `"${q}" से कुछ नहीं मिला। दूसरा शब्द आज़माएँ।`, bn: `"${q}" মেলেনি। অন্য শব্দ চেষ্টা করুন।` })} />
        ) : (
          <div style={{ display: grid ? "grid" : "flex", gridTemplateColumns: grid ? "1fr 1fr" : undefined, flexDirection: grid ? undefined : "column", gap: 10 }}>
            {list.map((s) => (
              <Card key={s.id} onClick={() => open(s)} pad={14}
                style={{ display: "flex", flexDirection: grid ? "column" : "row", alignItems: grid ? "stretch" : "center", gap: grid ? 10 : 13, minHeight: grid ? 116 : undefined }}>
                <IconTile name={s.icon} a={s.accent} size={46} iconSize={22} />
                <div style={{ flex: grid ? undefined : 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.display, fontSize: 15, fontWeight: 700 }}>{tc(s.title)}</div>
                  <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{tc(s.desc)}</div>
                </div>
                {!grid && <Icon name="ChevronRight" size={19} style={{ color: T.inkFaint }} />}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
