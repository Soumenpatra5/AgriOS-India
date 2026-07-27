import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";

function StatCard({ icon, label, value, sub, color = T.primary }) {
  return (
    <div style={{ padding: 18, borderRadius: 12, background: T.surface, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}15`, color, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={20} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Manrope', sans-serif", lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function StatGrid({ stats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
      {stats.map((s, i) => <StatCard key={i} {...s} />)}
    </div>
  );
}
