import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { useRouter } from "../adminRouter.jsx";

export default function Breadcrumbs({ items }) {
  const { navigate } = useRouter();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.inkSoft, marginBottom: 18, flexWrap: "wrap" }}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <Icon name="ChevronRight" size={13} style={{ color: T.inkFaint }} />}
            {last ? (
              <span style={{ fontWeight: 700, color: T.ink }}>{item.label}</span>
            ) : (
              <button onClick={() => item.path && navigate(item.path)}
                style={{ background: "none", border: "none", cursor: "pointer", color: T.primary, fontWeight: 600, fontSize: 13, fontFamily: "inherit", padding: 0 }}>
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
