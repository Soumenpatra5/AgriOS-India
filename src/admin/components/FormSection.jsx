import { T } from "../../theme/ThemeProvider.jsx";

export function FormField({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

export default function FormSection({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {title && <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: T.ink, fontFamily: "'Manrope', sans-serif" }}>{title}</h3>}
      {children}
    </div>
  );
}
