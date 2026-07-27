import { T } from "../../theme/ThemeProvider.jsx";

export default function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${T.line}`, marginBottom: 18 }}>
      {tabs.map((tab) => {
        const on = active === tab.key;
        return (
          <button key={tab.key} onClick={() => onChange(tab.key)}
            style={{ padding: "10px 20px", fontSize: 13, fontWeight: on ? 700 : 500, fontFamily: "inherit",
              color: on ? T.primary : T.inkSoft, background: "none", border: "none", cursor: "pointer",
              borderBottom: `2px solid ${on ? T.primary : "transparent"}`, marginBottom: -2, transition: "all .15s" }}>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
