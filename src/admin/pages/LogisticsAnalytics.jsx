import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import StatGrid from "../components/StatGrid.jsx";
import AdminCard from "../components/AdminCard.jsx";
import Badge from "../components/Badge.jsx";
import { adminAnalytics } from "../services/adminAnalytics.js";

const statusColor = { pending: "orange", assigned: "blue", picked_up: "blue", in_transit: "blue", delivered: "green", cancelled: "red" };

export default function LogisticsAnalytics() {
  const [data, setData] = useState(null);
  useEffect(() => { adminAnalytics.logistics().then(setData); }, []);

  if (!data) return <div style={{ padding: 40, color: T.inkSoft }}>Loading…</div>;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Logistics Analytics" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Logistics Analytics</h1>
      <StatGrid stats={[
        { icon: "Truck", label: "Shipments", value: data.shipments, color: "#3b82f6" },
        { icon: "Warehouse", label: "Warehouses", value: data.warehouses, color: "#f59e0b" },
      ]} />
      <AdminCard title="Shipments by Status">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {Object.entries(data.byStatus).map(([status, count]) => (
            <div key={status} style={{ padding: "10px 16px", borderRadius: 10, background: T.bg, border: `1px solid ${T.lineSoft}`, textAlign: "center" }}>
              <Badge color={statusColor[status] || "gray"} pill>{status}</Badge>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6, fontFamily: "'Manrope', sans-serif" }}>{count}</div>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}
