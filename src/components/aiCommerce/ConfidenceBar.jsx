import { T } from "../../theme/ThemeProvider.jsx";
import { useApp } from "../../store/AppStore.jsx";

/* Confidence readout — accepts the explain.js confidence object
   ({ value 0..1, label, samples }). */
export default function ConfidenceBar({ confidence, compact = false }) {
  const { tc } = useApp();
  if (!confidence) return null;
  const v = typeof confidence === "number" ? confidence : confidence.value || 0;
  const label = typeof confidence === "object" ? confidence.label : v >= 0.66 ? "High" : v >= 0.33 ? "Medium" : "Low";
  const color = v >= 0.66 ? T.primary : v >= 0.33 ? T.orange : T.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {!compact && <span style={{ fontSize: 11, color: T.inkSoft }}>{tc({ en: "Confidence", hi: "विश्वास", bn: "আস্থা" })}</span>}
      <div style={{ flex: compact ? "none" : 1, width: compact ? 60 : "auto", height: 6, borderRadius: 6, background: T.surface2, overflow: "hidden" }}>
        <div style={{ width: `${Math.round(v * 100)}%`, height: "100%", background: color, borderRadius: 6 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
    </div>
  );
}
