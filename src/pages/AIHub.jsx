import { useState, useMemo } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, SearchBar, Card, accent } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { usePrefs } from "../customize/PreferencesProvider.jsx";
import { AI_TOOLS } from "../constants/content.js";
import { fuzzyMatch } from "../utils/fuzzySearch.js";
import { getFavorites, toggleFavorite } from "../utils/favorites.js";

export default function AIHub() {
  const { t, tc, push, lang } = useApp();
  const { prefs } = usePrefs();
  const grid = prefs.layout.view !== "list";
  const [q, setQ] = useState("");
  const [favTick, setFavTick] = useState(0);
  const favs = useMemo(() => getFavorites(), [favTick]);
  const list = fuzzyMatch(AI_TOOLS, q);

  const pinned = !q ? list.filter((x) => favs.includes(x.id)) : [];
  const rest   = !q ? list.filter((x) => !favs.includes(x.id)) : list;

  const open = (x) => push({ kind: "chat", props: { agentId: x.agentId } });
  const togglePin = (e, id) => { e.stopPropagation(); toggleFavorite(id); setFavTick((n) => n + 1); };

  const ToolCard = ({ x }) => {
    const c = accent(x.accent);
    const isPinned = favs.includes(x.id);
    return (
      <Card key={x.id} onClick={() => open(x)} pad={15}
        style={{ display: "flex", flexDirection: grid ? "column" : "row", alignItems: grid ? "stretch" : "center",
          gap: grid ? 10 : 13, minHeight: grid ? 132 : undefined, position: "relative" }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: c.bg, color: c.fg, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name={x.icon} size={22} strokeWidth={2.1} />
        </div>
        <div style={{ flex: grid ? undefined : 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.display, fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{tc(x.title)}</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4, lineHeight: 1.4 }}>{tc(x.desc)}</div>
        </div>
        <button onClick={(e) => togglePin(e, x.id)} aria-label={isPinned ? "Unpin" : "Pin"}
          style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none",
            cursor: "pointer", color: isPinned ? T.primary : T.inkFaint, display: "flex", padding: 4 }}>
          <Icon name={isPinned ? "PinOff" : "Pin"} size={14} />
        </button>
      </Card>
    );
  };

  return (
    <>
      <AppBar title={t("aiTitle")} large />
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 16, animation: "ag-fade .25s var(--ag-ease)" }}>
        {/* hero */}
        <div style={{ borderRadius: T.rXl, padding: 20, color: "#fff", position: "relative", overflow: "hidden",
          background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDark})`, boxShadow: T.shadowMd }}>
          <div style={{ position: "absolute", right: -10, bottom: -20, opacity: .16 }}><Icon name="Sparkles" size={120} /></div>
          <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 800, position: "relative" }}>{t("aiSub")}</div>
          <div style={{ fontSize: 13.5, opacity: .92, marginTop: 6, maxWidth: 260, position: "relative" }}>
            {tc({ en: "Ten specialists that understand Indian farming — from diagnosis to loans.", hi: "दस विशेषज्ञ जो भारतीय खेती समझते हैं — रोग पहचान से लेकर ऋण तक।", bn: "দশ বিশেষজ্ঞ যারা ভারতীয় কৃষি বোঝেন — রোগ নির্ণয় থেকে ঋণ পর্যন্ত।" })}
          </div>
        </div>

        <SearchBar value={q} onChange={setQ} placeholder={tc({ en: "Search assistants…", hi: "सहायक खोजें…", bn: "সহায়ক খুঁজুন…" })} mic lang={lang} />

        {pinned.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name="Pin" size={12} /> {tc({ en: "Pinned", hi: "पिन किए गए", bn: "পিন করা" })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: grid ? "1fr 1fr" : "1fr", gap: 12 }}>
              {pinned.map((x) => <ToolCard key={x.id} x={x} />)}
            </div>
          </>
        )}

        {pinned.length > 0 && rest.length > 0 && (
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>
            {tc({ en: "All assistants", hi: "सभी सहायक", bn: "সব সহায়ক" })}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: grid ? "1fr 1fr" : "1fr", gap: 12 }}>
          {rest.map((x) => <ToolCard key={x.id} x={x} />)}
        </div>
      </div>
    </>
  );
}
