import { useRef } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";

const accentBg = { primary: T.primarySoft, blue: T.blueSoft, orange: T.orangeSoft, red: T.redSoft, yellow: T.yellowSoft };
const accentFg = { primary: T.primary, blue: T.blue, orange: T.orange, red: T.red, yellow: T.yellow };
export const accent = (a) => ({ bg: accentBg[a] || T.primarySoft, fg: accentFg[a] || T.primary });

/* Button with Material-style ripple + press-scale. */
export function Button({ children, onClick, variant = "primary", size = "md", full, disabled, icon, style }) {
  const ref = useRef(null);
  const ripple = (e) => {
    const el = ref.current; if (!el) return;
    const r = document.createElement("span");
    const rect = el.getBoundingClientRect();
    const d = Math.max(rect.width, rect.height);
    r.style.cssText = `position:absolute;border-radius:50%;pointer-events:none;width:${d}px;height:${d}px;left:${(e.clientX ?? rect.left + rect.width / 2) - rect.left - d / 2}px;top:${(e.clientY ?? rect.top + rect.height / 2) - rect.top - d / 2}px;background:currentColor;opacity:.22;transform:scale(0);animation:ag-ripple .5s var(--ag-ease) forwards`;
    el.appendChild(r); setTimeout(() => r.remove(), 520);
  };
  const pad = size === "lg" ? "16px 22px" : size === "sm" ? "9px 14px" : "13px 18px";
  const fs = size === "lg" ? 16 : size === "sm" ? 13 : 15;
  const variants = {
    primary: { background: T.primary, color: T.onPrimary, border: "none", boxShadow: T.shadowSm },
    soft: { background: T.primarySoft, color: T.primary, border: "none" },
    outline: { background: T.surface, color: T.ink, border: `1px solid ${T.line}` },
    ghost: { background: "transparent", color: T.primary, border: "none" },
    danger: { background: T.redSoft, color: T.red, border: "none" },
  };
  return (
    <button ref={ref} disabled={disabled}
      onClick={(e) => { if (disabled) return; ripple(e); onClick?.(e); }}
      style={{ position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: 8, width: full ? "100%" : "auto", padding: pad, borderRadius: T.pill, fontFamily: T.body, fontSize: fs, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .5 : 1, transition: "transform .12s var(--ag-ease), filter .2s",
        ...variants[variant], ...style }}
      onMouseDown={(e) => { e.currentTarget.style.transform = "scale(.97)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
      {icon && <Icon name={icon} size={fs + 3} strokeWidth={2.4} />}{children}
    </button>
  );
}

export function Card({ children, onClick, pad = 16, style, elevated }) {
  return (
    <div onClick={onClick}
      style={{ background: elevated ? T.elevated : `var(--ag-card-bg, ${T.surface})`,
        border: `var(--ag-card-border, 1px solid ${T.line})`, borderRadius: `var(--ag-card-radius, ${T.rLg})`,
        padding: pad, boxShadow: elevated ? T.shadowMd : `var(--ag-card-shadow, none)`,
        backdropFilter: "var(--ag-card-backdrop, none)", WebkitBackdropFilter: "var(--ag-card-backdrop, none)",
        cursor: onClick ? "pointer" : "default",
        transition: "transform .16s var(--ag-ease), box-shadow .2s var(--ag-ease), border-color .2s",
        ...style }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = T.shadowMd; } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = elevated ? T.shadowMd : "none"; } : undefined}>
      {children}
    </div>
  );
}

export function Chip({ children, active, onClick, icon }) {
  return (
    <button onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", padding: "8px 14px",
        borderRadius: T.pill, cursor: "pointer", fontFamily: T.body, fontSize: 13.5, fontWeight: 600,
        border: `1px solid ${active ? T.primary : T.line}`, background: active ? T.primary : T.surface,
        color: active ? T.onPrimary : T.inkSoft, transition: "all .18s var(--ag-ease)" }}>
      {icon && <Icon name={icon} size={15} strokeWidth={2.3} />}{children}
    </button>
  );
}

/* Rounded square icon container used across dashboards. */
export function IconTile({ name, a = "primary", size = 44, iconSize = 21, style }) {
  const c = accent(a);
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.32, background: c.bg, color: c.fg,
      display: "grid", placeItems: "center", flexShrink: 0, ...style }}>
      <Icon name={name} size={iconSize} strokeWidth={2.2} />
    </div>
  );
}

export function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px", marginBottom: 12 }}>
      <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: T.ink }}>{title}</div>
      {action && (
        <button onClick={onAction} style={{ background: "none", border: "none", cursor: "pointer", color: T.primary, fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          {action}
        </button>
      )}
    </div>
  );
}

export function Divider({ my = 0 }) {
  return <div style={{ height: 1, background: T.lineSoft, margin: `${my}px 0` }} />;
}
