/* SymptomChecklist — renders a domain's symptom array as a dynamic form.
   Supports toggle, select, and text input types. */

import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";
import { useApp } from "../store/AppStore.jsx";

export default function SymptomChecklist({ symptoms = [], answers = {}, onChange }) {
  const { tc } = useApp();
  const set = (id, val) => onChange({ ...answers, [id]: val });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {symptoms.map((s) => (
        <div key={s.id}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>
            {s.label}{s.required && <span style={{ color: "var(--ag-red)" }}> *</span>}
          </label>

          {s.type === "toggle" && (
            <ToggleRow
              value={!!answers[s.id]}
              onChange={(v) => set(s.id, v)}
            />
          )}

          {s.type === "select" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(s.options || []).map((opt) => (
                <button key={opt} onClick={() => set(s.id, answers[s.id] === opt ? "" : opt)}
                  style={{
                    padding: "7px 14px", borderRadius: 99, fontSize: 13, cursor: "pointer",
                    fontFamily: T.body, border: `1.5px solid ${answers[s.id] === opt ? "var(--ag-primary)" : T.line}`,
                    background: answers[s.id] === opt ? "var(--ag-primary-soft)" : T.surface,
                    color: answers[s.id] === opt ? "var(--ag-primary)" : T.ink,
                    fontWeight: answers[s.id] === opt ? 600 : 400,
                    transition: "all .15s",
                  }}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {s.type === "text" && (
            <textarea value={answers[s.id] || ""}
              onChange={(e) => set(s.id, e.target.value)}
              placeholder={tc({ en: "Type here…", hi: "यहाँ लिखें…", bn: "এখানে লিখুন…" })}
              rows={2}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: T.rMd,
                border: `1px solid ${T.line}`, background: T.surface, color: T.ink,
                fontFamily: T.body, fontSize: 14, resize: "none",
                boxSizing: "border-box", outline: "none",
              }} />
          )}
        </div>
      ))}
    </div>
  );
}

function ToggleRow({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: "none", border: "none", cursor: "pointer",
        fontFamily: T.body, padding: 0,
      }}>
      <div style={{
        width: 44, height: 26, borderRadius: 99, position: "relative",
        background: value ? "var(--ag-primary)" : T.line,
        transition: "background .2s",
      }}>
        <div style={{
          position: "absolute", top: 3, left: value ? 21 : 3,
          width: 20, height: 20, borderRadius: "50%", background: "#fff",
          transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
        }} />
      </div>
      <span style={{ fontSize: 14, color: value ? "var(--ag-primary)" : T.inkSoft, fontWeight: value ? 600 : 400 }}>
        {value ? "Yes" : "No"}
      </span>
    </button>
  );
}
