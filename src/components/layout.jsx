import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";
import { useApp } from "../store/AppStore.jsx";

/* Sticky top app bar. Optional back button and trailing action. */
export function AppBar({ title, onBack, action, large }) {
  /* Reaches for the translator itself rather than taking a prop: AppBar is on
     nearly every screen, and threading tc through all of them to label one
     button would be worse than the coupling. */
  const { tc } = useApp();
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: T.bg, backdropFilter: "blur(8px)",
      borderBottom: `1px solid ${T.lineSoft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", minHeight: 56 }}>
        {onBack && (
          <button onClick={onBack} aria-label={tc({ en: "Back", hi: "पीछे", bn: "পিছনে" })} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, cursor: "pointer", color: T.ink, display: "flex" }}>
            <Icon name="ChevronLeft" size={20} />
          </button>
        )}
        <div style={{ fontFamily: T.display, fontSize: large ? 21 : 18, fontWeight: 700, color: T.ink }}>{title}</div>
        <div style={{ marginLeft: "auto" }}>{action}</div>
      </div>
    </div>
  );
}

/* Scrollable page body with consistent horizontal padding + bottom room for nav. */
export function Screen({ children, pad = 16, gap = 18, style }) {
  return (
    <div style={{ padding: `4px ${pad}px 24px`, display: "flex", flexDirection: "column", gap, animation: "ag-fade .25s var(--ag-ease)", ...style }}>
      {children}
    </div>
  );
}
