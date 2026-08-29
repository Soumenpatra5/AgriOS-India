import { T } from "../../theme/ThemeProvider.jsx";
import { useApp } from "../../store/AppStore.jsx";

export default function TimeSlotPicker({ slots = [], selected, onSelect }) {
  const { tc } = useApp();
  if (!slots.length) return <div style={{ fontSize: 12.5, color: T.inkSoft, padding: 8 }}>{tc({ en: "No slots available for this day.", hi: "इस दिन कोई समय उपलब्ध नहीं।", bn: "এই দিনে কোনও সময় নেই।" })}</div>;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {slots.map((s) => {
        const active = selected === s.start;
        const disabled = !s.available;
        return (
          <button key={s.start} disabled={disabled}
            onClick={() => !disabled && onSelect(s.start, s.end)}
            style={{
              padding: "8px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 600,
              border: `1.5px solid ${active ? T.primary : disabled ? T.line : T.line}`,
              background: active ? T.primarySoft : disabled ? T.surfaceAlt : T.surface,
              color: active ? T.primary : disabled ? T.inkFaint : T.ink,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
              fontFamily: "inherit",
            }}>
            {s.start}
          </button>
        );
      })}
    </div>
  );
}
