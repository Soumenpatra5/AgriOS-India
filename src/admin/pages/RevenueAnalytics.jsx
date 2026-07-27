import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import StatGrid from "../components/StatGrid.jsx";
import AdminCard from "../components/AdminCard.jsx";
import { adminAnalytics } from "../services/adminAnalytics.js";
import { rupee } from "../../utils/format.js";

export default function RevenueAnalytics() {
  const [data, setData] = useState(null);
  useEffect(() => { adminAnalytics.revenue().then(setData); }, []);

  if (!data) return <div style={{ padding: 40, color: T.inkSoft }}>Loading…</div>;

  const months = Object.entries(data.byMonth).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Revenue Analytics" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Revenue Analytics</h1>
      <StatGrid stats={[
        { icon: "IndianRupee", label: "Total Revenue", value: rupee(data.total), color: "#10b981" },
        { icon: "ShoppingCart", label: "Total Orders", value: data.orderCount, color: "#3b82f6" },
        { icon: "CheckCircle2", label: "Delivered", value: data.deliveredCount, color: T.primary },
        { icon: "TrendingUp", label: "Avg Order", value: data.deliveredCount ? rupee(Math.round(data.total / data.deliveredCount)) : "—", color: "#f59e0b" },
      ]} />
      <AdminCard title="Revenue by Month">
        {months.length === 0 ? (
          <div style={{ color: T.inkFaint, fontSize: 13 }}>No delivered orders yet</div>
        ) : months.map(([m, v]) => (
          <div key={m} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${T.lineSoft}` }}>
            <span style={{ fontSize: 13, fontWeight: 600, width: 80 }}>{m}</span>
            <div style={{ flex: 1, height: 20, background: T.surface2, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", background: T.primary, borderRadius: 6, width: `${Math.min(100, (v / (data.total || 1)) * 100)}%` }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, minWidth: 80, textAlign: "right" }}>{rupee(v)}</span>
          </div>
        ))}
      </AdminCard>
    </div>
  );
}
