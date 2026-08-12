import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";
import { Button } from "./primitives.jsx";
import { useApp, useToasts } from "../store/AppStore.jsx";

export function Skeleton({ w = "100%", h = 14, r = 8, style }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, position: "relative", overflow: "hidden",
      background: T.surface2, ...style }}>
      <div style={{ position: "absolute", inset: 0, transform: "translateX(-100%)",
        background: `linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)`,
        animation: "ag-shimmer 1.3s infinite" }} />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
      <Skeleton w={44} h={44} r={14} />
      <div style={{ flex: 1 }}>
        <Skeleton w="60%" h={13} />
        <Skeleton w="40%" h={11} style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}

export function EmptyState({ icon = "Inbox", title, body, action, onAction }) {
  return (
    <div style={{ textAlign: "center", padding: "36px 24px" }}>
      <div style={{ width: 60, height: 60, borderRadius: 20, background: T.surface2, display: "grid", placeItems: "center", margin: "0 auto 16px", color: T.inkFaint }}>
        <Icon name={icon} size={26} />
      </div>
      <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, marginBottom: 6, color: T.ink }}>{title}</div>
      {body && <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, maxWidth: 280, margin: "0 auto" }}>{body}</div>}
      {action && <div style={{ marginTop: 18 }}><Button variant="soft" onClick={onAction}>{action}</Button></div>}
    </div>
  );
}

export function ErrorState({ title, body, onRetry }) {
  return (
    <div style={{ textAlign: "center", padding: "36px 24px" }}>
      <div style={{ width: 60, height: 60, borderRadius: 20, background: T.redSoft, display: "grid", placeItems: "center", margin: "0 auto 16px", color: T.red }}>
        <Icon name="CloudOff" size={26} />
      </div>
      <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, marginBottom: 6, color: T.ink }}>{title || "Something went wrong"}</div>
      <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, maxWidth: 280, margin: "0 auto" }}>{body || "Please try again in a moment."}</div>
      {onRetry && <div style={{ marginTop: 18 }}><Button variant="soft" icon="RotateCcw" onClick={onRetry}>Retry</Button></div>}
    </div>
  );
}

export function Spinner({ size = 22 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", border: `2.5px solid ${T.line}`,
      borderTopColor: T.primary, animation: "ag-spin .7s linear infinite" }} />
  );
}

export function LoadingScreen({ label = "Loading…" }) {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", gap: 14 }}>
      <Spinner size={30} />
      <div style={{ color: T.inkSoft, fontSize: 13.5 }}>{label}</div>
    </div>
  );
}

/* Toast host — reads the queue from the store and renders stacked snackbars. */
export function ToastHost() {
  const { dismissToast } = useApp();
  const toasts = useToasts();
  const tone = { info: T.ink, success: T.primary, error: T.red };
  const iconOf = { info: "Info", success: "CheckCircle2", error: "AlertCircle" };
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 96, zIndex: 90, display: "flex", flexDirection: "column",
      alignItems: "center", gap: 8, pointerEvents: "none", padding: "0 16px" }}>
      {toasts.map((tst) => (
        <div key={tst.id} onClick={() => dismissToast(tst.id)}
          style={{ pointerEvents: "auto", cursor: "pointer", maxWidth: 420, width: "100%", display: "flex", alignItems: "center", gap: 10,
            background: T.elevated, color: T.ink, border: `1px solid ${T.line}`, borderRadius: T.rMd, padding: "12px 14px",
            boxShadow: T.shadowLg, animation: "ag-toast .28s var(--ag-ease)" }}>
          <Icon name={iconOf[tst.kind] || "Info"} size={18} style={{ color: tone[tst.kind] || T.ink, flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{tst.message}</span>
        </div>
      ))}
    </div>
  );
}
