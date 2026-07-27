import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";

export default function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.45)",
      display: "grid", placeItems: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: T.surface, borderRadius: 14, boxShadow: T.shadowLg, width: "100%",
          maxWidth: wide ? 720 : 500, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px",
          borderBottom: `1px solid ${T.line}` }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, fontFamily: "'Manrope', sans-serif" }}>{title}</h2>
          <button onClick={onClose}
            style={{ background: T.surface2, border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: T.inkSoft, display: "flex" }}>
            <Icon name="X" size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
