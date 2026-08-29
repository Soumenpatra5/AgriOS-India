/* ConfidenceMeter — visual bar showing AI confidence score with label and guidance. */

import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";
import { useApp } from "../store/AppStore.jsx";

const COLORS = {
  high:   "var(--ag-primary)",
  medium: "var(--ag-orange)",
  low:    "var(--ag-red)",
};

export default function ConfidenceMeter({ confidence, needsMoreImages }) {
  const { tc } = useApp();
  if (!confidence) return null;

  const { score, label, isLow } = confidence;
  const pct   = Math.round((score || 0) * 100);
  const color = COLORS[label] || COLORS.medium;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 500 }}>{tc({ en: "AI Confidence", hi: "AI विश्वास", bn: "AI আস্থা" })}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{pct}% — {capitalize(label)}</span>
      </div>

      {/* Bar */}
      <div style={{ height: 8, borderRadius: 99, background: T.surface2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color,
          borderRadius: 99, transition: "width .5s var(--ag-ease)",
        }} />
      </div>

      {/* Low-confidence note */}
      {isLow && (
        <div style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "8px 10px",
          borderRadius: 10, background: T.yellowSoft, border: `1px solid var(--ag-yellow)33` }}>
          <Icon name="AlertTriangle" size={13} style={{ color: "var(--ag-yellow)", flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: T.ink, lineHeight: 1.4 }}>
            Low confidence — results may not be accurate.
            {needsMoreImages ? " Take more photos for a better diagnosis." : " Please consult an expert."}
          </span>
        </div>
      )}
    </div>
  );
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
