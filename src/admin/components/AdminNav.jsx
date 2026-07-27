import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { useRouter } from "../adminRouter.jsx";

const SECTIONS = [
  { label: "Overview", items: [
    { path: "/", icon: "LayoutDashboard", label: "Dashboard" },
  ]},
  { label: "Users", items: [
    { path: "/users", icon: "Users", label: "All Users" },
  ]},
  { label: "Marketplace", items: [
    { path: "/marketplace/products", icon: "Package", label: "Products" },
    { path: "/marketplace/orders", icon: "ShoppingCart", label: "Orders" },
    { path: "/marketplace/sellers", icon: "Store", label: "Sellers" },
  ]},
  { label: "Services", items: [
    { path: "/services/providers", icon: "Wrench", label: "Providers" },
    { path: "/services/bookings", icon: "CalendarCheck", label: "Bookings" },
  ]},
  { label: "Logistics", items: [
    { path: "/logistics/shipments", icon: "Truck", label: "Shipments" },
    { path: "/logistics/warehouses", icon: "Warehouse", label: "Warehouses" },
    { path: "/logistics/trade", icon: "Handshake", label: "Trade" },
  ]},
  { label: "AI Platform", items: [
    { path: "/ai/agents", icon: "BrainCircuit", label: "Agents" },
    { path: "/ai/fraud", icon: "ShieldAlert", label: "Fraud" },
    { path: "/ai/automation", icon: "Zap", label: "Automation" },
    { path: "/ai/models", icon: "Cpu", label: "Models" },
  ]},
  { label: "CMS", items: [
    { path: "/cms/articles", icon: "FileText", label: "Articles" },
    { path: "/cms/schemes", icon: "Landmark", label: "Schemes" },
    { path: "/cms/banners", icon: "Image", label: "Banners" },
  ]},
  { label: "Support", items: [
    { path: "/support/tickets", icon: "LifeBuoy", label: "Tickets" },
  ]},
  { label: "Analytics", items: [
    { path: "/analytics/revenue", icon: "IndianRupee", label: "Revenue" },
    { path: "/analytics/marketplace", icon: "BarChart3", label: "Marketplace" },
    { path: "/analytics/logistics", icon: "TrendingUp", label: "Logistics" },
    { path: "/analytics/ai", icon: "Activity", label: "AI" },
  ]},
  { label: "System", items: [
    { path: "/audit", icon: "ScrollText", label: "Audit Log" },
    { path: "/settings/flags", icon: "ToggleLeft", label: "Feature Flags" },
    { path: "/settings/system", icon: "Server", label: "System Info" },
  ]},
];

export default function AdminNav({ collapsed }) {
  const { route, navigate } = useRouter();

  return (
    <nav>
      {SECTIONS.map((sec) => (
        <div key={sec.label} style={{ marginBottom: 4 }}>
          {!collapsed && (
            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: .5,
              padding: "10px 18px 4px" }}>{sec.label}</div>
          )}
          {sec.items.map((it) => {
            const active = route === it.path;
            return (
              <button key={it.path} onClick={() => navigate(it.path)}
                title={collapsed ? it.label : undefined}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: collapsed ? "9px 0" : "9px 18px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  background: active ? T.primarySoft : "none", color: active ? T.primary : T.inkSoft,
                  border: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500, fontFamily: "inherit",
                  borderRadius: 0, transition: "background .15s" }}>
                <Icon name={it.icon} size={17} />
                {!collapsed && it.label}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
