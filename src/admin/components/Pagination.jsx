import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";

export default function Pagination({ page, total, onChange, count }) {
  const btn = (disabled, onClick, icon) => (
    <button disabled={disabled} onClick={onClick}
      style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.line}`, cursor: disabled ? "default" : "pointer",
        background: disabled ? T.surface2 : T.surface, color: disabled ? T.inkFaint : T.ink, display: "flex", opacity: disabled ? .5 : 1 }}>
      <Icon name={icon} size={15} />
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: T.inkSoft }}>
      <span>{count} record{count !== 1 ? "s" : ""}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {btn(page <= 1, () => onChange(page - 1), "ChevronLeft")}
        <span style={{ fontWeight: 600, minWidth: 60, textAlign: "center" }}>{page} / {total}</span>
        {btn(page >= total, () => onChange(page + 1), "ChevronRight")}
      </div>
    </div>
  );
}
