import { useEffect, useRef } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";
import { Button } from "./primitives.jsx";

function useLockScroll(open) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
}

function useEscClose(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

function useFocusTrap(open) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const prev = document.activeElement;
    const first = ref.current.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])");
    first?.focus();
    return () => { prev?.focus?.(); };
  }, [open]);
  return ref;
}

export function BottomSheet({ open, onClose, title, children, footer }) {
  useLockScroll(open);
  useEscClose(open, onClose);
  const trapRef = useFocusTrap(open);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: T.scrim,
      display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "ag-fade .2s var(--ag-ease)" }}>
      <div ref={trapRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title || "Sheet"}
        style={{ width: "100%", maxWidth: 460, background: T.surface, borderRadius: `${T.rXl} ${T.rXl} 0 0`,
          padding: "10px 20px 26px", maxHeight: "90vh", overflowY: "auto", animation: "ag-sheet .3s var(--ag-ease)" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: T.line, margin: "6px auto 14px" }} />
        {title && (
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontFamily: T.display, fontSize: 19, fontWeight: 700 }}>{title}</span>
            <button onClick={onClose} aria-label="Close" style={{ marginLeft: "auto", background: T.surface2, border: "none", borderRadius: 10, padding: 7, cursor: "pointer", color: T.ink, display: "flex" }}>
              <Icon name="X" size={18} />
            </button>
          </div>
        )}
        {children}
        {footer && <div style={{ marginTop: 20 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Dialog({ open, onClose, title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, danger, icon }) {
  useLockScroll(open);
  useEscClose(open, onClose);
  const trapRef = useFocusTrap(open);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 85, background: T.scrim,
      display: "grid", placeItems: "center", padding: 24, animation: "ag-fade .18s var(--ag-ease)" }}>
      <div ref={trapRef} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={title}
        style={{ width: "100%", maxWidth: 340, background: T.surface, borderRadius: T.rXl, padding: "24px 22px",
          boxShadow: T.shadowLg, animation: "ag-pop .2s var(--ag-ease)", textAlign: "center" }}>
        {icon && (
          <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 14px", display: "grid", placeItems: "center",
            background: danger ? T.redSoft : T.primarySoft, color: danger ? T.red : T.primary }}>
            <Icon name={icon} size={24} />
          </div>
        )}
        <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 700, marginBottom: 7 }}>{title}</div>
        {body && <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55, marginBottom: 20 }}>{body}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="outline" full onClick={onClose}>{cancelLabel}</Button>
          <Button variant={danger ? "danger" : "primary"} full onClick={() => { onConfirm?.(); onClose?.(); }}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
