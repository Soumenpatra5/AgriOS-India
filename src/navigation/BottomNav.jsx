import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { useApp } from "../store/AppStore.jsx";
import { usePrefs } from "../customize/PreferencesProvider.jsx";

const TABS = [
  { k: "home", label: "navHome", icon: "House" },
  { k: "ai", label: "navAI", icon: "Sparkles" },  { k: "services", label: "navServices", icon: "LayoutGrid" },
  { k: "profile", label: "navProfile", icon: "User" },
];
// Home & Profile are always kept so the user can never strand themselves.
const ALWAYS = new Set(["home", "profile"]);

export default function BottomNav() {
  const { tab, switchTab, stack, t, tc } = useApp();
  const { prefs } = usePrefs();
  const onTab = stack.length === 0;
  const visible = TABS.filter((x) => ALWAYS.has(x.k) || prefs.nav.tabs[x.k] !== false);
  return (
    <nav aria-label={tc({ en: "Main navigation", hi: "मुख्य नेविगेशन", bn: "প্রধান নেভিগেশন" })} style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, display: "flex", justifyContent: "center" }}>
      <div role="tablist" style={{ width: "100%", maxWidth: 460, background: T.surface, borderTop: `1px solid ${T.line}`,
        display: "flex", padding: "8px 6px calc(10px + env(safe-area-inset-bottom))" }}>
        {visible.map(({ k, label, icon }) => {
          const active = onTab && tab === k;
          return (
            <button key={k} role="tab" aria-selected={active} aria-label={t(label)} onClick={() => switchTab(k)}
              style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "grid", justifyItems: "center",
                gap: 4, padding: "6px 0", fontFamily: T.body }}>
              <div style={{ position: "relative", display: "grid", placeItems: "center", width: 46, height: 30, borderRadius: T.pill,
                background: active ? T.primarySoft : "transparent", transition: "background .2s var(--ag-ease)" }}>
                <Icon name={icon} size={21} strokeWidth={active ? 2.5 : 2} style={{ color: active ? T.primary : T.inkFaint }} />
              </div>
              <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, color: active ? T.primary : T.inkFaint }}>{t(label)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
