import { useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import AdminCard from "../components/AdminCard.jsx";
import { storage } from "../../utils/storage.js";

const FLAGS = [
  { key: "marketplace", label: "Marketplace", desc: "Product marketplace module" },
  { key: "svcMarketplace", label: "Service Marketplace", desc: "Service provider marketplace" },
  { key: "logistics", label: "Logistics & Trade", desc: "Shipments, warehouses, trade" },
  { key: "aiCommerce", label: "AI Commerce", desc: "AI-powered commerce features" },
  { key: "livestock", label: "Livestock", desc: "Livestock management module" },
  { key: "erp", label: "Business ERP", desc: "Farm business management" },
  { key: "darkMode", label: "Dark Mode", desc: "Allow dark mode toggle" },
  { key: "demoData", label: "Demo Data", desc: "Show demo data load buttons" },
];

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width: 44, height: 26, borderRadius: 999, border: "none", cursor: "pointer", padding: 3, flexShrink: 0,
        background: on ? T.primary : T.line, transition: "background .2s" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff",
        transform: `translateX(${on ? 18 : 0}px)`, transition: "transform .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
    </button>
  );
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState(() => {
    const saved = storage.get("featureFlags", {});
    const init = {};
    FLAGS.forEach((f) => init[f.key] = saved[f.key] !== false);
    return init;
  });

  const toggle = (key) => {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    storage.set("featureFlags", next);
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Feature Flags" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Feature Flags</h1>
      <AdminCard>
        {FLAGS.map((f, i) => (
          <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0",
            borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{f.label}</div>
              <div style={{ fontSize: 12, color: T.inkSoft }}>{f.desc}</div>
            </div>
            <Toggle on={flags[f.key]} onChange={() => toggle(f.key)} />
          </div>
        ))}
      </AdminCard>
      <div style={{ marginTop: 12, fontSize: 11.5, color: T.inkFaint }}>
        Feature flags are stored in localStorage and apply to the main app on next load.
      </div>
    </div>
  );
}
