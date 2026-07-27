import { useState } from "react";
import { T, useTheme } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import AdminNav from "./AdminNav.jsx";

const SIDEBAR_W = 250;
const TOPBAR_H = 56;

export default function AdminShell({ children, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const { mode, setTheme } = useTheme();
  const sideW = collapsed ? 64 : SIDEBAR_W;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: "'Inter', sans-serif", color: T.ink }}>
      {/* sidebar */}
      <aside style={{ width: sideW, flexShrink: 0, background: T.surface, borderRight: `1px solid ${T.line}`,
        display: "flex", flexDirection: "column", transition: "width .2s ease", overflow: "hidden" }}>
        <div style={{ height: TOPBAR_H, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          {!collapsed && <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Manrope', sans-serif", color: T.primary, whiteSpace: "nowrap" }}>AgriOS Admin</span>}
          <button onClick={() => setCollapsed(!collapsed)}
            style={{ marginLeft: collapsed ? 0 : "auto", background: "none", border: "none", cursor: "pointer", color: T.inkSoft, padding: 4, display: "flex" }}>
            <Icon name={collapsed ? "PanelLeftOpen" : "PanelLeftClose"} size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          <AdminNav collapsed={collapsed} />
        </div>
        <div style={{ borderTop: `1px solid ${T.line}`, padding: 8 }}>
          <button onClick={onLogout}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8,
              background: "none", border: "none", cursor: "pointer", color: T.red, fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
            <Icon name="LogOut" size={17} />
            {!collapsed && "Logout"}
          </button>
        </div>
      </aside>

      {/* main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* topbar */}
        <header style={{ height: TOPBAR_H, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end",
          gap: 10, padding: "0 20px", borderBottom: `1px solid ${T.line}`, background: T.surface }}>
          <button onClick={() => setTheme(mode === "dark" ? "light" : "dark")}
            style={{ background: T.surface2, border: "none", borderRadius: 8, padding: 8, cursor: "pointer", color: T.inkSoft, display: "flex" }}>
            <Icon name={mode === "dark" ? "Sun" : "Moon"} size={17} />
          </button>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDark})`,
            color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14, fontFamily: "'Manrope', sans-serif" }}>A</div>
        </header>

        {/* content */}
        <main style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
