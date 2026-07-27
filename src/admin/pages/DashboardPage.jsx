import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import StatGrid from "../components/StatGrid.jsx";
import AdminCard from "../components/AdminCard.jsx";
import MiniChart from "../components/MiniChart.jsx";
import { productService } from "../../services/marketplace/productService.js";
import { sellerService } from "../../services/marketplace/sellerService.js";
import { mpOrderService } from "../../services/marketplace/mpOrderService.js";
import { providerService } from "../../services/svcMarketplace/providerService.js";
import { bookingService } from "../../services/svcMarketplace/bookingService.js";
import { warehouseService } from "../../services/logistics/warehouseService.js";
import { rupee } from "../../utils/format.js";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      productService.getAll(),
      sellerService.getAll(),
      mpOrderService.getAll(),
      providerService.getAll(),
      bookingService.getAll(),
      warehouseService.getAll(),
    ]).then(([products, sellers, orders, providers, bookings, warehouses]) => {
      const revenue = orders.filter((o) => o.status === "delivered").reduce((s, o) => s + (o.total || 0), 0);
      setStats({ products: products.length, sellers: sellers.length, orders: orders.length,
        providers: providers.length, bookings: bookings.length, warehouses: warehouses.length, revenue });
    });
  }, []);

  if (!stats) return <div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>Loading…</div>;

  const kpis = [
    { icon: "Package", label: "Products", value: stats.products, color: T.primary },
    { icon: "Store", label: "Sellers", value: stats.sellers, color: "#e67e22" },
    { icon: "ShoppingCart", label: "Orders", value: stats.orders, color: "#3b82f6" },
    { icon: "IndianRupee", label: "Revenue", value: rupee(stats.revenue), color: "#10b981" },
    { icon: "Wrench", label: "Providers", value: stats.providers, color: "#8b5cf6" },
    { icon: "CalendarCheck", label: "Bookings", value: stats.bookings, color: "#ec4899" },
    { icon: "Warehouse", label: "Warehouses", value: stats.warehouses, color: "#f59e0b" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 20px" }}>Dashboard</h1>
      <StatGrid stats={kpis} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <AdminCard title="Orders Trend">
          <MiniChart data={[3, 7, 5, 12, 9, 15, 11]} width={280} height={48} />
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 6 }}>Sample trend (demo data)</div>
        </AdminCard>
        <AdminCard title="Quick Actions">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[{ label: "View all products", hash: "/marketplace/products" },
              { label: "Manage users", hash: "/users" },
              { label: "Check fraud alerts", hash: "/ai/fraud" },
              { label: "System info", hash: "/settings/system" },
            ].map((a) => (
              <a key={a.hash} href={`#${a.hash}`} style={{ fontSize: 13, color: T.primary, fontWeight: 600, textDecoration: "none" }}>{a.label} →</a>
            ))}
          </div>
        </AdminCard>
      </div>
      <div style={{ textAlign: "center", marginTop: 32, fontSize: 11.5, color: T.inkFaint }}>AgriOS Admin · v1.1.0 (Phase 8)</div>
    </div>
  );
}
