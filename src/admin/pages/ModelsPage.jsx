import Breadcrumbs from "../components/Breadcrumbs.jsx";
import AdminCard from "../components/AdminCard.jsx";
import Badge from "../components/Badge.jsx";
import { T } from "../../theme/ThemeProvider.jsx";

const MODELS = [
  { name: "Price Prediction", type: "Heuristic", status: "active", desc: "MSP-anchored seasonal band forecasting" },
  { name: "Demand Forecast", type: "Heuristic", status: "active", desc: "Festival + sowing window demand estimation" },
  { name: "Supply Forecast", type: "Heuristic", status: "active", desc: "Stock/demand cover ratio analysis" },
  { name: "Recommendation Engine", type: "Heuristic", status: "active", desc: "Weighted scoring with co-purchase graph" },
  { name: "Fraud Detection", type: "Rule-based", status: "active", desc: "Price anomaly + duplicate + unverified checks" },
  { name: "Risk Scoring", type: "Composite", status: "active", desc: "Business + operational + market dimensions" },
  { name: "Seller Matching", type: "Heuristic", status: "active", desc: "Rating/verified/fulfilment weighted scoring" },
  { name: "Buyer Matching", type: "Heuristic", status: "active", desc: "Deal value/type/verified ranking" },
  { name: "Smart Pricing", type: "Heuristic", status: "active", desc: "Grade-adjusted sell/buy suggestions" },
  { name: "AI Search", type: "Synonym+TF-IDF", status: "active", desc: "Domain-specific synonym expansion" },
];

export default function ModelsPage() {
  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "AI Models" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Model Registry ({MODELS.length})</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {MODELS.map((m) => (
          <AdminCard key={m.name}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</span>
              <Badge color="green" pill>{m.status}</Badge>
            </div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 6 }}>{m.desc}</div>
            <Badge color="gray">{m.type}</Badge>
          </AdminCard>
        ))}
      </div>
      <div style={{ marginTop: 20, fontSize: 12, color: T.inkFaint }}>
        All models are local heuristic engines — real ML models deferred to backend phase.
      </div>
    </div>
  );
}
