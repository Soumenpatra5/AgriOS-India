/* Feed Management hub — landing page for the feed submodules. */
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";

const TILES = [
  { kind: "feedCalculator", label: "Feed Calculator", icon: "Calculator", a: "yellow", desc: "Quick feed cost estimate" },
  { kind: "feedInventory",  label: "Feed Inventory",  icon: "Package",    a: "orange", desc: "Stock, expiry, low-stock alerts" },
  { kind: "feedPurchase",   label: "Feed Purchase",   icon: "ShoppingCart", a: "primary", desc: "Record a purchase & restock" },
  { kind: "feedBatchList",  label: "Feed Batches & FCR", icon: "Layers",   a: "red", desc: "Batch-wise consumption & feed conversion ratio" },
  { kind: "feedWastage",    label: "Feed Wastage",    icon: "AlertTriangle", a: "red", desc: "Spoilage, spillage & damaged stock" },
  { kind: "feedDashboard",  label: "Feed Cost Analytics", icon: "BarChart3", a: "blue", desc: "Cost trends, FCR & livestock comparison, alerts" },
  { kind: "feedReports",    label: "Feed Reports",    icon: "FileText",   a: "blue", desc: "Cost, inventory, FCR, wastage, purchase & supplier reports" },
];

const FG = { primary: T.primary, orange: T.orange, yellow: T.yellow, red: T.red, blue: T.blue };
const BG = { primary: T.primarySoft, orange: T.orangeSoft, yellow: T.yellowSoft, red: T.redSoft, blue: T.blueSoft };

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
