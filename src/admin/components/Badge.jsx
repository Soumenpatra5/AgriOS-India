import { T } from "../../theme/ThemeProvider.jsx";

const COLORS = {
  green:   { bg: T.primarySoft, fg: T.primary },
  red:     { bg: T.redSoft, fg: T.red },
  orange:  { bg: T.orangeSoft || "rgba(234,179,8,.12)", fg: T.orange },
  blue:    { bg: "rgba(59,130,246,.1)", fg: "rgb(59,130,246)" },
  gray:    { bg: T.surface2, fg: T.inkSoft },
  default: { bg: T.surface2, fg: T.inkSoft },
};

export default function Badge({ children, color = "default", pill = false }) {
  const c = COLORS[color] || COLORS.default;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: pill ? "3px 10px" : "2px 8px",
      borderRadius: pill ? 999 : 6, background: c.bg, color: c.fg, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}
