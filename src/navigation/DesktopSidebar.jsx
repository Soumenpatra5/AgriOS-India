import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { useApp } from "../store/AppStore.jsx";
import { usePrefs } from "../customize/PreferencesProvider.jsx";
import { activeTab } from "./tabOwnership.js";
import { initials } from "../utils/format.js";

const DESKTOP_TABS = [
  { k: "home", label: "navHome", icon: "House", desc: { en: "Overview & Analytics", hi: "अवलोकन व एनालिटिक्स", bn: "সারসংক্ষেপ ও বিশ্লেষণ" } },
  { k: "farmSpace", label: "navFarmSpace", icon: "Users", desc: { en: "Collaborative Team Hub", hi: "सहयोगी टीम हब", bn: "যৌথ খামার স্পেস" } },
  { k: "ai", label: "navAI", icon: "Sparkles", desc: { en: "Multimodal Agronomist", hi: "मल्टीमॉडल कृषि सलाहकार", bn: "এআই কৃষি পরামর্শক" } },
  { k: "services", label: "navServices", icon: "LayoutGrid", desc: { en: "Livestock, ERP & Tools", hi: "पशुपालन, ईआरपी व टूल्स", bn: "পশুপালন ও খামার ইআরপি" } },
  { k: "profile", label: "navProfile", icon: "User", desc: { en: "Settings & Preferences", hi: "सेटिंग्स व प्राथमिकताएं", bn: "সেটিংস ও প্রোফাইল" } },
];

const ALWAYS = new Set(["home", "profile"]);

export default function DesktopSidebar() {
  const { tab, switchTab, stack, t, tc, user } = useApp();
  const { prefs } = usePrefs();
  const current = activeTab({ tab, stack });
  const visible = DESKTOP_TABS.filter((x) => ALWAYS.has(x.k) || prefs.nav.tabs[x.k] !== false);

  const fallbackName = tc({ en: "Farmer", hi: "किसान", bn: "কৃষক" });
  const userName = user?.name || fallbackName;
  const userRole = user?.role || "owner";

  return (
    <aside
      aria-label={tc({ en: "Desktop sidebar", hi: "डेस्कटॉप साइडबार", bn: "ডেস্কটপ সাইডবার" })}
      style={{
        width: 260,
        minWidth: 260,
        height: "100vh",
        background: T.surface,
        borderRight: `1px solid ${T.line}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        zIndex: 20,
        userSelect: "none",
      }}
    >
      <div>
        {/* Brand Header */}
        <div
          style={{
            padding: "20px 20px 18px",
            borderBottom: `1px solid ${T.line}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDark})`,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 18,
              boxShadow: "0 2px 8px rgba(18, 137, 78, 0.25)",
            }}
          >
            🌾
          </div>
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 16, color: T.ink, letterSpacing: -0.3 }}>
              AgriOS India
            </div>
            <div style={{ fontSize: 11, color: T.primary, fontWeight: 600 }}>
              {tc({ en: "Smart Web Platform", hi: "स्मार्ट वेब प्लेटफॉर्म", bn: "স্মার্ট খামার প্ল্যাটফর্ম" })}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: "14px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          {visible.map(({ k, label, icon, desc }) => {
            const active = current === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => switchTab(k)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "none",
                  background: active ? T.primarySoft : "transparent",
                  color: active ? T.primary : T.inkSoft,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background .18s var(--ag-ease), color .18s var(--ag-ease)",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: active ? T.primary : "transparent",
                    color: active ? "#fff" : T.inkFaint,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    transition: "all .18s var(--ag-ease)",
                  }}
                >
                  <Icon name={icon} size={18} strokeWidth={active ? 2.4 : 2} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: active ? 700 : 600, color: active ? T.primary : T.ink, lineHeight: 1.2 }}>
                    {t(label)}
                  </div>
                  <div style={{ fontSize: 10.5, color: active ? T.primary : T.inkFaint, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {tc(desc)}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Account / Footer */}
      <div
        style={{
          padding: "16px",
          borderTop: `1px solid ${T.line}`,
          background: T.surface2,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: `linear-gradient(145deg, ${T.primary}, ${T.primaryDark})`,
            color: "#fff",
            fontFamily: T.display,
            fontWeight: 700,
            fontSize: 14,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          {initials(userName)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {userName}
          </div>
          <div style={{ fontSize: 11, color: T.inkSoft, textTransform: "capitalize" }}>
            {userRole}
          </div>
        </div>
      </div>
    </aside>
  );
}
