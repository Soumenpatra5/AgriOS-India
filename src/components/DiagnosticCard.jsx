/* DiagnosticCard — compact history card for list views. */

import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";
import SeverityBadge from "./SeverityBadge.jsx";
import { domainRegistry } from "../services/diagnostics/domainRegistry.js";

export default function DiagnosticCard({ record, onClick }) {
  if (!record) return null;

  const domain  = domainRegistry.get(record.domainId);
  const date    = new Date(record.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const disease = record.primaryDiagnosis || "Unknown";
  const isUnable = disease === "Unable to Detect";

  return (
    <button onClick={() => onClick?.(record)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px", borderRadius: T.rLg,
        background: T.surface, border: `1px solid ${T.line}`,
        cursor: "pointer", textAlign: "left", width: "100%",
        fontFamily: T.body,
      }}>
      {/* Domain icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
        background: "var(--ag-primary-soft)", display: "grid", placeItems: "center",
        color: "var(--ag-primary)", fontSize: 24, lineHeight: 1,
      }}>
        {domain?.emoji || <Icon name={domain?.icon || "Microscope"} size={22} />}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: isUnable ? T.inkSoft : T.ink,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {disease}
        </div>
        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
          {domain?.name || record.domainId}
          {record.species ? ` — ${record.species}` : ""}
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        {record.severity && <SeverityBadge severity={record.severity} size="sm" />}
        <span style={{ fontSize: 11, color: T.inkFaint }}>{date}</span>
      </div>

      <Icon name="ChevronRight" size={16} style={{ color: T.inkFaint, flexShrink: 0 }} />
    </button>
  );
}
