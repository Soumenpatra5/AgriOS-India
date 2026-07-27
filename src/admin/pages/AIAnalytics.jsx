import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import StatGrid from "../components/StatGrid.jsx";
import AdminCard from "../components/AdminCard.jsx";
import { listAgents } from "../../ai/agents/registry.js";
import { commerceAutomation } from "../../services/aiCommerce/commerceAutomation.js";
import { fraudDetection } from "../../services/aiCommerce/fraudDetection.js";

export default function AIAnalytics() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      commerceAutomation.list(),
      fraudDetection.scan(),
    ]).then(([alerts, fraud]) => {
      setStats({
        agents: listAgents().length,
        alerts: alerts.length,
        unread: alerts.filter((a) => !a.read).length,
        fraudFlags: fraud.flags?.length || 0,
      });
    });
  }, []);

  if (!stats) return <div style={{ padding: 40, color: T.inkSoft }}>Loading…</div>;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "AI Analytics" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>AI Platform Analytics</h1>
      <StatGrid stats={[
        { icon: "BrainCircuit", label: "AI Agents", value: stats.agents, color: "#8b5cf6" },
        { icon: "Zap", label: "Automation Alerts", value: stats.alerts, sub: `${stats.unread} unread`, color: "#f59e0b" },
        { icon: "ShieldAlert", label: "Fraud Flags", value: stats.fraudFlags, color: T.red },
      ]} />
      <AdminCard title="AI Engine Status">
        <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6 }}>
          All 18 AI commerce engines are running as local heuristic models. Real ML/vector search/streaming deferred to backend phase.
          The system processes recommendations, price predictions, demand/supply forecasts, seller/buyer matching, fraud detection, risk scoring,
          lead generation, segmentation, business intelligence, and commerce automation — all with explainable output (score + confidence + reasons).
        </div>
      </AdminCard>
    </div>
  );
}
