import { useEffect } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { useApp, nextAfterSplash } from "../store/AppStore.jsx";

export default function Splash() {
  const { setStage, t } = useApp();
  useEffect(() => {
    const id = setTimeout(() => setStage(nextAfterSplash()), 1200);
    return () => clearTimeout(id);
  }, [setStage]);

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(120% 80% at 50% 0%, ${T.primarySoft} 0%, ${T.bg} 55%)`,
      display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ textAlign: "center", animation: "ag-fade .5s var(--ag-ease)" }}>
        <img src="/icon-192.png" alt="AgriOS" style={{ width: 92, height: 92, borderRadius: 28, margin: "0 auto 22px",
          boxShadow: T.shadowLg, animation: "ag-pop .6s var(--ag-ease)" }} />
        <div style={{ fontFamily: T.display, fontSize: 34, fontWeight: 800, letterSpacing: "-.02em", color: T.ink,
          animation: "ag-rise .6s .1s both var(--ag-ease)" }}>
          AgriOS <span style={{ color: T.primary }}>India</span>
        </div>
        <div style={{ fontSize: 14, color: T.inkSoft, marginTop: 10, maxWidth: 280, lineHeight: 1.5,
          animation: "ag-rise .6s .2s both var(--ag-ease)" }}>
          {t("tagline")}
        </div>
        <div style={{ marginTop: 30, animation: "ag-fade .6s .5s both" }}>
          <div style={{ width: 26, height: 26, margin: "0 auto", borderRadius: "50%", border: `2.5px solid ${T.line}`, borderTopColor: T.primary, animation: "ag-spin .7s linear infinite" }} />
        </div>
      </div>
    </div>
  );
}
