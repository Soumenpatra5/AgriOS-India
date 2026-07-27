import { useState } from "react";
import { ThemeProvider, T } from "../theme/ThemeProvider.jsx";
import { adminAuth } from "./adminAuth.js";
import { openDb } from "./adminDb.js";
import { AdminRouter, RouterProvider } from "./adminRouter.jsx";

openDb();
import AdminShell from "./components/AdminShell.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import UserDetailPage from "./pages/UserDetailPage.jsx";
import ProductsPage from "./pages/ProductsPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import SellersPage from "./pages/SellersPage.jsx";
import ProvidersPage from "./pages/ProvidersPage.jsx";
import BookingsPage from "./pages/BookingsPage.jsx";
import ShipmentsPage from "./pages/ShipmentsPage.jsx";
import WarehousesPage from "./pages/WarehousesPage.jsx";
import TradePage from "./pages/TradePage.jsx";
import AgentsPage from "./pages/AgentsPage.jsx";
import FraudPage from "./pages/FraudPage.jsx";
import AutomationPage from "./pages/AutomationPage.jsx";
import ModelsPage from "./pages/ModelsPage.jsx";
import ArticlesPage from "./pages/ArticlesPage.jsx";
import SchemesPage from "./pages/SchemesPage.jsx";
import BannersPage from "./pages/BannersPage.jsx";
import TicketsPage from "./pages/TicketsPage.jsx";
import RevenueAnalytics from "./pages/RevenueAnalytics.jsx";
import MarketplaceAnalytics from "./pages/MarketplaceAnalytics.jsx";
import LogisticsAnalytics from "./pages/LogisticsAnalytics.jsx";
import AIAnalytics from "./pages/AIAnalytics.jsx";
import AuditLogPage from "./pages/AuditLogPage.jsx";
import FeatureFlagsPage from "./pages/FeatureFlagsPage.jsx";
import SystemInfoPage from "./pages/SystemInfoPage.jsx";

const ROUTES = {
  "/":                  DashboardPage,
  "/users":             UsersPage,
  "/users/detail":      UserDetailPage,
  "/marketplace/products": ProductsPage,
  "/marketplace/orders":   OrdersPage,
  "/marketplace/sellers":  SellersPage,
  "/services/providers":   ProvidersPage,
  "/services/bookings":    BookingsPage,
  "/logistics/shipments":  ShipmentsPage,
  "/logistics/warehouses": WarehousesPage,
  "/logistics/trade":      TradePage,
  "/ai/agents":            AgentsPage,
  "/ai/fraud":             FraudPage,
  "/ai/automation":        AutomationPage,
  "/ai/models":            ModelsPage,
  "/cms/articles":         ArticlesPage,
  "/cms/schemes":          SchemesPage,
  "/cms/banners":          BannersPage,
  "/support/tickets":      TicketsPage,
  "/analytics/revenue":    RevenueAnalytics,
  "/analytics/marketplace": MarketplaceAnalytics,
  "/analytics/logistics":  LogisticsAnalytics,
  "/analytics/ai":         AIAnalytics,
  "/audit":                AuditLogPage,
  "/settings/flags":       FeatureFlagsPage,
  "/settings/system":      SystemInfoPage,
};

function LoginGate({ onLogin }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (adminAuth.login(pin)) onLogin();
    else { setErr(true); setPin(""); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: T.bg, fontFamily: "'Inter', sans-serif" }}>
      <form onSubmit={submit} style={{ width: 340, padding: 32, borderRadius: 16, background: T.surface, boxShadow: T.shadowLg, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🛡️</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "0 0 4px", fontFamily: "'Manrope', sans-serif" }}>AgriOS Admin</h1>
        <p style={{ fontSize: 13, color: T.inkSoft, margin: "0 0 24px" }}>Enter admin PIN to continue</p>
        <input
          type="password" value={pin} onChange={(e) => { setPin(e.target.value); setErr(false); }}
          placeholder="PIN" autoFocus
          style={{ width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 10, border: `1.5px solid ${err ? T.red : T.line}`,
            background: T.bg, color: T.ink, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
        />
        {err && <div style={{ color: T.red, fontSize: 12, marginTop: 6 }}>Invalid PIN</div>}
        <button type="submit"
          style={{ width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer",
            background: T.primary, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Manrope', sans-serif" }}>
          Log in
        </button>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => adminAuth.isLoggedIn());

  return (
    <ThemeProvider>
      {authed ? (
        <RouterProvider>
          <AdminShell onLogout={() => { adminAuth.logout(); setAuthed(false); }}>
            <AdminRouter routes={ROUTES} fallback={DashboardPage} />
          </AdminShell>
        </RouterProvider>
      ) : (
        <LoginGate onLogin={() => setAuthed(true)} />
      )}
    </ThemeProvider>
  );
}
