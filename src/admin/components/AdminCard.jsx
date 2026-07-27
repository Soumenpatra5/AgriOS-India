import { T } from "../../theme/ThemeProvider.jsx";

export default function AdminCard({ title, action, children, style: sx }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 20, marginBottom: 18, ...sx }}>
      {(title || action) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          {title && <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, fontFamily: "'Manrope', sans-serif" }}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
