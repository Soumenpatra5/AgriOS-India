import { useCallback, useRef, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";
import { voice } from "../ai/voice/speech.js";

const base = {
  width: "100%", padding: "14px 15px", borderRadius: T.rMd, fontFamily: T.body, fontSize: 15,
  color: T.ink, background: T.surface2, border: `1px solid transparent`, outline: "none",
  transition: "border-color .18s var(--ag-ease), background .18s",
};

export function Input({ value, onChange, placeholder, label, type = "text", inputMode, icon, prefix, maxLength, style, mic, lang }) {
  const [focus, setFocus] = useState(false);
  const [listening, setListening] = useState(false);
  const sttRef = useRef(null);

  const toggleMic = useCallback((e) => {
    e.preventDefault();
    if (listening) { sttRef.current?.stop(); return; }
    setListening(true);
    sttRef.current = voice.listen({
      lang: lang || "en",
      onResult: (text) => onChange?.(text),
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
  }, [listening, lang, onChange]);

  const showMic = mic && voice.sttSupported && type === "text";

  return (
    <label style={{ display: "block", minWidth: 0 }}>
      {label && <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, marginBottom: 7 }}>{label}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, ...base, padding: 0,
        border: `1px solid ${focus ? T.primary : listening ? T.danger : "transparent"}`, background: T.surface2 }}>
        {icon && <span style={{ paddingLeft: 14, color: T.inkFaint, display: "flex" }}><Icon name={icon} size={18} /></span>}
        {prefix && <span style={{ paddingLeft: icon ? 0 : 14, color: T.inkSoft, fontSize: 15, fontWeight: 600 }}>{prefix}</span>}
        <input value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} type={type}
          inputMode={inputMode} maxLength={maxLength} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ flex: 1, padding: "14px 15px", paddingLeft: icon || prefix ? 4 : 15, border: "none", outline: "none",
            background: "transparent", fontFamily: T.body, fontSize: 15, color: T.ink, minWidth: 0, ...style }} />
        {showMic && (
          <button type="button" onClick={toggleMic} aria-label="Voice input"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 12px", display: "flex",
              color: listening ? T.danger : T.inkFaint, animation: listening ? "ag-pulse 1s infinite" : "none" }}>
            <Icon name={listening ? "MicOff" : "Mic"} size={18} />
          </button>
        )}
      </div>
    </label>
  );
}

export function SearchBar({ value, onChange, placeholder = "Search…", onFocusChange, mic, lang }) {
  const [focus, setFocus] = useState(false);
  const [listening, setListening] = useState(false);
  const sttRef = useRef(null);

  const toggleMic = useCallback((e) => {
    e.preventDefault();
    if (listening) { sttRef.current?.stop(); return; }
    setListening(true);
    sttRef.current = voice.listen({
      lang: lang || "en",
      onResult: (text) => onChange?.(text),
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
  }, [listening, lang, onChange]);

  const showMic = mic && voice.sttSupported;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", borderRadius: T.pill,
      background: T.surface2, border: `1px solid ${focus ? T.primary : listening ? T.danger : "transparent"}`, transition: "border-color .18s" }}>
      <Icon name="Search" size={18} style={{ color: T.inkFaint }} />
      <input value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder}
        onFocus={() => { setFocus(true); onFocusChange?.(true); }} onBlur={() => { setFocus(false); onFocusChange?.(false); }}
        style={{ flex: 1, padding: "12px 0", border: "none", outline: "none", background: "transparent",
          fontFamily: T.body, fontSize: 14.5, color: T.ink, minWidth: 0 }} />
      {value && <button onClick={() => onChange?.("")} aria-label="Clear" style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 2 }}><Icon name="X" size={16} /></button>}
      {showMic && !value && (
        <button type="button" onClick={toggleMic} aria-label="Voice search"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex",
            color: listening ? T.danger : T.inkFaint, animation: listening ? "ag-pulse 1s infinite" : "none" }}>
          <Icon name={listening ? "MicOff" : "Mic"} size={17} />
        </button>
      )}
    </div>
  );
}

export function Dropdown({ value, onChange, options, label }) {
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      {label && <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, marginBottom: 7 }}>{label}</div>}
      <div style={{ position: "relative" }}>
        {/* A select is only as narrow as its longest option unless the text is
            allowed to truncate. In a 1fr column a label like "Livestock type
            (optional)" was being cut mid-word against the chevron; ellipsis
            makes the overflow read as deliberate. */}
        <select value={value} onChange={(e) => onChange?.(e.target.value)}
          style={{ ...base, appearance: "none", cursor: "pointer", paddingRight: 42, border: `1px solid ${T.line}`, background: T.surface,
            overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
        <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.inkSoft, display: "flex" }}>
          <Icon name="ChevronDown" size={18} />
        </span>
      </div>
    </label>
  );
}

/* 6-box OTP input with auto-advance and paste support. */
export function OtpInput({ length = 6, value, onChange }) {
  const refs = useRef([]);
  const set = (i, v) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const arr = value.split("");
    arr[i] = d; const next = arr.join("").slice(0, length);
    onChange(next);
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const onPaste = (e) => {
    const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, length);
    if (txt) { onChange(txt); refs.current[Math.min(txt.length, length - 1)]?.focus(); e.preventDefault(); }
  };
  return (
    <div style={{ display: "flex", gap: 9, justifyContent: "space-between" }}>
      {Array.from({ length }).map((_, i) => {
        const filled = !!value[i];
        return (
          <input key={i} ref={(el) => (refs.current[i] = el)} value={value[i] || ""} onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)} onPaste={onPaste} inputMode="numeric" maxLength={1}
            style={{ width: "100%", aspectRatio: "1", textAlign: "center", borderRadius: T.rMd, fontFamily: T.display,
              fontSize: 22, fontWeight: 700, color: T.ink, outline: "none",
              background: filled ? T.primarySoft : T.surface2,
              border: `1.5px solid ${filled ? T.primary : "transparent"}`, transition: "all .16s var(--ag-ease)" }} />
        );
      })}
    </div>
  );
}
