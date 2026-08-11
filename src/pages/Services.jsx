/* AgriOS Service Hub — the categorized, searchable entry point to every
   capability in the app. Data comes from the service registry
   (src/services/serviceHub/serviceRegistry.js); favorites/recents from
   serviceHubService. Reuses the existing SearchBar + fuzzyMatch (incl.
   Hindi/Bengali transliteration), prefs.layout.view (grid/list), and the
   farmer-profile personalization the rest of the app already uses. */
import { useMemo, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import { AppBar, SearchBar, Card, IconTile, EmptyState } from "../components/index.js";
import Icon from "../components/Icon.jsx";
import { useApp } from "../store/AppStore.jsx";
import { usePrefs } from "../customize/PreferencesProvider.jsx";
import { fuzzyMatch } from "../utils/fuzzySearch.js";
import { SERVICE_CATEGORIES, SERVICE_REGISTRY, SERVICES_BY_CATEGORY, serviceById } from "../services/serviceHub/serviceRegistry.js";
import { serviceHubService } from "../services/serviceHub/serviceHubService.js";

const BADGES = {
  new:     { label: { en: "NEW", hi: "नया", bn: "নতুন" }, fg: T.primary, bg: T.primarySoft },
  ai:      { label: { en: "AI", hi: "AI", bn: "AI" },     fg: T.blue,    bg: T.blueSoft },
  premium: { label: { en: "PRO", hi: "प्रो", bn: "প্রো" }, fg: T.yellow,  bg: T.yellowSoft },
  coming:  { label: { en: "SOON", hi: "जल्द", bn: "শীঘ্রই" }, fg: T.inkSoft, bg: T.surface2 },
};

export default function Services() {
  const { t, tc, push, lang } = useApp();
  const { prefs } = usePrefs();
  const grid = prefs.layout.view !== "list";
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0); // bump to re-read favorites/recents after a change
  const refresh = () => setTick((n) => n + 1);

  // Favorites/recents live in localStorage; re-read only when `tick` bumps
  // (a favorite toggle or service open), not on every keystroke in search.
  const favIds = useMemo(() => serviceHubService.getFavorites(), [tick]);
  const recentIds = useMemo(() => serviceHubService.getRecents(), [tick]);
  const favSet = useMemo(() => new Set(favIds), [favIds]);

  const open = (s) => {
    serviceHubService.recordUse(s.id);
    refresh();
    if (s.coming || !s.kind) {
      push({ kind: "feature", props: { title: tc(s.title), desc: tc(s.desc), icon: s.icon, a: s.accent } });
    } else {
      push({ kind: s.kind, props: s.props });
    }
  };

  const toggleFav = (e, id) => { e.stopPropagation(); serviceHubService.toggleFavorite(id); refresh(); };

  const searching = q.trim().length > 0;
  const results = useMemo(() => (searching ? fuzzyMatch(SERVICE_REGISTRY, q) : []), [searching, q]);
  const suggested = useMemo(() => (searching ? [] : serviceHubService.suggestedFor(prefs, { excludeIds: favIds, limit: 6 })), [searching, prefs, favIds]);
  const favServices = useMemo(() => favIds.map(serviceById).filter(Boolean), [favIds]);
  const recentServices = useMemo(() => recentIds.map(serviceById).filter(Boolean).filter((s) => !favSet.has(s.id)), [recentIds, favSet]);

  return (
    <>
      <AppBar title={t("servicesTitle")} large />
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 18, animation: "ag-fade .25s var(--ag-ease)" }}>
        <SearchBar value={q} onChange={setQ} placeholder={tc({ en: "Search services…", hi: "सेवाएँ खोजें…", bn: "সেবা খুঁজুন…" })} mic lang={lang} />

        {searching ? (
          results.length === 0 ? (
            <EmptyState icon="SearchX"
              title={tc({ en: "No services found", hi: "कोई सेवा नहीं मिली", bn: "কোনো সেবা পাওয়া যায়নি" })}
              body={tc({ en: `Nothing matches "${q}". Try a different word.`, hi: `"${q}" से कुछ नहीं मिला। दूसरा शब्द आज़माएँ।`, bn: `"${q}" মেলেনি। অন্য শব্দ চেষ্টা করুন।` })} />
          ) : (
            <ServiceGrid services={results} grid={grid} tc={tc} favSet={favSet} onOpen={open} onFav={toggleFav} />
          )
        ) : (
          <>
            {favServices.length > 0 && (
              <Section title={tc({ en: "Favorites", hi: "पसंदीदा", bn: "প্রিয়" })} icon="Star">
                <ServiceGrid services={favServices} grid={grid} tc={tc} favSet={favSet} onOpen={open} onFav={toggleFav} />
              </Section>
            )}

            {recentServices.length > 0 && (
              <Section title={tc({ en: "Recently used", hi: "हाल में उपयोग", bn: "সম্প্রতি ব্যবহৃত" })} icon="History">
                <ServiceGrid services={recentServices.slice(0, 6)} grid={grid} tc={tc} favSet={favSet} onOpen={open} onFav={toggleFav} />
              </Section>
            )}

            {suggested.length > 0 && (
              <Section title={tc({ en: "Suggested for your farm", hi: "आपके फार्म के लिए", bn: "আপনার খামারের জন্য" })} icon="Sparkles">
                <ServiceGrid services={suggested} grid={grid} tc={tc} favSet={favSet} onOpen={open} onFav={toggleFav} />
              </Section>
            )}

            {SERVICE_CATEGORIES.map((cat) => {
              const items = SERVICES_BY_CATEGORY[cat.id] || [];
              if (items.length === 0) return null;
              return (
                <Section key={cat.id} title={tc(cat.label)} icon={cat.icon}>
                  <ServiceGrid services={items} grid={grid} tc={tc} favSet={favSet} onOpen={open} onFav={toggleFav} />
                </Section>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, icon, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 2px" }}>
        <Icon name={icon} size={16} style={{ color: T.inkSoft }} />
        <span style={{ fontFamily: T.display, fontSize: 15, fontWeight: 700, color: T.ink }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function ServiceGrid({ services, grid, tc, favSet, onOpen, onFav }) {
  return (
    <div style={{ display: grid ? "grid" : "flex", gridTemplateColumns: grid ? "1fr 1fr" : undefined, flexDirection: grid ? undefined : "column", gap: 10 }}>
      {services.map((s) => {
        const badge = s.coming ? BADGES.coming : (s.badge && BADGES[s.badge]);
        const fav = favSet.has(s.id);
        return (
          <Card key={s.id} onClick={() => onOpen(s)} pad={14}
            style={{ position: "relative", display: "flex", flexDirection: grid ? "column" : "row", alignItems: grid ? "stretch" : "center", gap: grid ? 10 : 13, minHeight: grid ? 116 : undefined, opacity: s.coming ? 0.72 : 1 }}>
            <div style={{ position: "absolute", top: 8, right: 8, display: "flex", alignItems: "center", gap: 6 }}>
              {badge && (
                <span style={{ fontSize: 9.5, fontWeight: 700, color: badge.fg, background: badge.bg, padding: "2px 6px", borderRadius: 5, letterSpacing: 0.3 }}>
                  {tc(badge.label)}
                </span>
              )}
              <button onClick={(e) => onFav(e, s.id)} aria-label={fav ? "Remove favorite" : "Add favorite"}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", color: fav ? T.yellow : T.inkFaint }}>
                <Icon name="Star" size={16} style={{ fill: fav ? T.yellow : "none" }} />
              </button>
            </div>
            <IconTile name={s.icon} a={s.accent} size={46} iconSize={22} />
            <div style={{ flex: grid ? undefined : 1, minWidth: 0, paddingRight: grid ? 0 : 44 }}>
              <div style={{ fontFamily: T.display, fontSize: 15, fontWeight: 700 }}>{tc(s.title)}</div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{tc(s.desc)}</div>
            </div>
            {!grid && <Icon name="ChevronRight" size={19} style={{ color: T.inkFaint, flexShrink: 0 }} />}
          </Card>
        );
      })}
    </div>
  );
}
