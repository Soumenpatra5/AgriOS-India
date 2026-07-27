import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import StatGrid from "../components/StatGrid.jsx";
import AdminCard from "../components/AdminCard.jsx";
import { adminAnalytics } from "../services/adminAnalytics.js";

export default function MarketplaceAnalytics() {
  const [data, setData] = useState(null);
  useEffect(() => { adminAnalytics.marketplace().then(setData); }, []);

  if (!data) return <div style={{ padding: 40, color: T.inkSoft }}>Loading…</div>;

  const cats = Object.entries(data.categories).sort(([, a], [, b]) => b - a);

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Marketplace Analytics" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Marketplace Analytics</h1>
      <StatGrid stats={[
        { icon: "Package", label: "Products", value: data.products, color: T.primary },
        { icon: "Store", label: "Sellers", value: data.sellers, color: "#e67e22" },
        { icon: "ShoppingCart", label: "Orders", value: data.orders, color: "#3b82f6" },
      ]} />
      <AdminCard title="Products by Category">
        {cats.map(([cat, count]) => (
          <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${T.lineSoft}` }}>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textTransform: "capitalize" }}>{cat}</span>
            <div style={{ width: 160, height: 18, background: T.surface2, borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", background: T.primary, borderRadius: 5, width: `${(count / (data.products || 1)) * 100}%` }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, minWidth: 30, textAlign: "right" }}>{count}</span>
          </div>
        ))}
      </AdminCard>
    </div>
  );
}
