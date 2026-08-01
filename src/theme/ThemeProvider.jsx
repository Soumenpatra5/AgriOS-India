import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { palette, radius, space, type, dur, ease } from "./tokens.js";
import { storage } from "../utils/storage.js";

const ThemeCtx = createContext(null);
export const useTheme = () => useContext(ThemeCtx);

/* Turns a palette object into `--ag-*` CSS custom properties. */
function toVars(p) {
  return Object.entries(p).map(([k, v]) =>
    `--ag-${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${v};`).join("");
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => storage.get("theme", "system"));
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );

  const resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]') || (() => {
      const m = document.createElement("meta"); m.name = "theme-color";
      document.head.appendChild(m); return m;
    })();
    meta.content = palette[resolved].bg;
  }, [resolved]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const on = (e) => setSystemDark(e.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  const setTheme = (m) => { setMode(m); storage.set("theme", m); };

  const css = `
    :root[data-theme="light"]{${toVars(palette.light)}}
    :root[data-theme="dark"]{${toVars(palette.dark)}}
    :root{
      --ag-r-sm:${radius.sm}px;--ag-r-md:${radius.md}px;--ag-r-lg:${radius.lg}px;--ag-r-xl:${radius.xl}px;--ag-r-pill:${radius.pill}px;
      --ag-font-display:${type.display};--ag-font-body:${type.body};
      --ag-ease:${ease};
    }
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    html,body,#root{height:100%}
    body{margin:0;background:var(--ag-bg);color:var(--ag-ink);font-family:var(--ag-font-body);
      transition:background ${dur.base}ms var(--ag-ease),color ${dur.base}ms var(--ag-ease);
      -webkit-font-smoothing:antialiased}
    button{font-family:inherit}
    ::selection{background:var(--ag-primary-soft);color:var(--ag-primary)}
    input:focus-visible,button:focus-visible,select:focus-visible,textarea:focus-visible,[role="button"]:focus-visible{
      outline:2px solid var(--ag-primary);outline-offset:2px}
    ::-webkit-scrollbar{width:0;height:0}
    @media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
    @keyframes ag-fade{from{opacity:0}to{opacity:1}}
    @keyframes ag-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes ag-pop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
    @keyframes ag-sheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes ag-push-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
    @keyframes ag-shimmer{100%{transform:translateX(100%)}}
    @keyframes ag-ripple{to{transform:scale(2.4);opacity:0}}
    @keyframes ag-spin{to{transform:rotate(360deg)}}
    @keyframes ag-toast{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes ag-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    @keyframes ag-blink{0%,100%{opacity:1}50%{opacity:0}}
    @keyframes ag-pulse{0%,100%{opacity:1}50%{opacity:.4}}
  `;

  const value = useMemo(() => ({ mode, resolved, setTheme }), [mode, resolved]);
  return (
    <ThemeCtx.Provider value={value}>
      <style>{css}</style>
      {children}
    </ThemeCtx.Provider>
  );
}

/* shorthand token helpers for inline styles */
export const T = {
  bg: "var(--ag-bg)", surface: "var(--ag-surface)", surface2: "var(--ag-surface2)", elevated: "var(--ag-elevated)",
  ink: "var(--ag-ink)", inkSoft: "var(--ag-ink-soft)", inkFaint: "var(--ag-ink-faint)",
  line: "var(--ag-line)", lineSoft: "var(--ag-line-soft)",
  primary: "var(--ag-primary)", primaryDark: "var(--ag-primary-dark)", primarySoft: "var(--ag-primary-soft)", onPrimary: "var(--ag-on-primary)",
  blue: "var(--ag-blue)", blueSoft: "var(--ag-blue-soft)",
  orange: "var(--ag-orange)", orangeSoft: "var(--ag-orange-soft)",
  red: "var(--ag-red)", redSoft: "var(--ag-red-soft)",
  yellow: "var(--ag-yellow)", yellowSoft: "var(--ag-yellow-soft)",
  scrim: "var(--ag-scrim)",
  shadowSm: "var(--ag-shadow-sm)", shadowMd: "var(--ag-shadow-md)", shadowLg: "var(--ag-shadow-lg)",
  rSm: "var(--ag-r-sm)", rMd: "var(--ag-r-md)", rLg: "var(--ag-r-lg)", rXl: "var(--ag-r-xl)", pill: "var(--ag-r-pill)",
  display: "var(--ag-font-display)", body: "var(--ag-font-body)",
};
export { space, dur, ease };
