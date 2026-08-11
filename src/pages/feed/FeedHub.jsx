/* Feed Management hub — landing page for the feed submodules. Phase 1 ships
   Calculator, Inventory and Purchase; later phases add Consumption,
   Batches/FCR, Analytics, Alerts and Reports as their own tiles here. */
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";

const TILES = [
  { kind: "feedCalculator", label: "Feed Calculator", icon: "Calculator", a: "yellow", desc: "Quick feed cost estimate" },
  { kind: "feedInventory",  label: "Feed Inventory",  icon: "Package",    a: "orange", desc: "Stock, expiry, low-stock alerts" },
  { kind: "feedPurchase",   label: "Feed Purchase",   icon: "ShoppingCart", a: "primary", desc: "Record a purchase & restock" },
];

const FG = { primary: T.primary, orange: T.orange, yellow: T.yellow };
const BG = { primary: T.primarySoft, orange: T.orangeSoft, yellow: T.yellowSoft };

export default function FeedHub() {
  const { pop, push } = useApp();
  return (
    <>
      <AppBar title="Feed Management" onBack={pop} />
      <Screen gap={16}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TILES.map((t) => (
            <button key={t.kind} onClick={() => push({ kind: t.kind })}
              style={{ display: "flex", alignItems: "center", gap: 12, background: T.surface,
                border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: 14, cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: BG[t.a], color: FG[t.a],
                display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name={t.icon} size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{t.label}</div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{t.desc}</div>
              </div>
              <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
            </button>
          ))}
        </div>
      </Screen>
    </>
  );
}
