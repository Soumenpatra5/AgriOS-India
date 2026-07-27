import Breadcrumbs from "../components/Breadcrumbs.jsx";
import AdminCard from "../components/AdminCard.jsx";
import Badge from "../components/Badge.jsx";
import Icon from "../../components/Icon.jsx";
import { T } from "../../theme/ThemeProvider.jsx";
import { listAgents } from "../../ai/agents/registry.js";

export default function AgentsPage() {
  const agents = listAgents();

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "AI Agents" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>AI Agents ({agents.length})</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {agents.map((a) => (
          <AdminCard key={a.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: T.primarySoft, color: T.primary, display: "grid", placeItems: "center" }}>
                <Icon name={a.icon || "Sparkles"} size={20} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: T.inkSoft }}>{a.id}</div>
              </div>
              <Badge color="green" pill style={{ marginLeft: "auto" }}>Active</Badge>
            </div>
            {a.systemPrompt && <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5, maxHeight: 60, overflow: "hidden" }}>{a.systemPrompt.slice(0, 150)}…</div>}
            {a.tools?.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                {a.tools.map((t) => <Badge key={t} color="gray">{t}</Badge>)}
              </div>
            )}
          </AdminCard>
        ))}
      </div>
    </div>
  );
}
