import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, SectionHeader } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { aiInsightsService } from "../../services/insights/aiInsightsService.js";

function ScoreRing({ score }) {
  const r = 44, c = 2 * Math.PI * r;
  const color = score >= 75 ? T.primary : score >= 50 ? T.orange : T.red;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke={T.line} strokeWidth="9" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="9"
        strokeLinecap="round" strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)}
        transform="rotate(-90 55 55)"
        style={{ transition: "stroke-dashoffset .8s var(--ag-ease)" }} />
      <text x="55" y="52" textAnchor="middle" fontSize="24" fontWeight="800" fill={color}
        fontFamily="Manrope, sans-serif">{score}</text>
      <text x="55" y="70" textAnchor="middle" fontSize="10" fill={T.inkSoft}>/ 100</text>
    </svg>
  );
}

export default function AIInsights() {
  const { pop, toast, tc } = useApp();
  const [data, setData]         = useState(null);
  const [health, setHealth]     = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    aiInsightsService.gather().then((d) => {
      setData(d);
      setHealth(aiInsightsService.score(d));
    });
  }, []);

  const ask = async () => {
    if (!data) return;
    setLoading(true); setError(null);
    try {
      const list = await aiInsightsService.generate(data);
      setInsights(list.length ? list : null);
      if (!list.length) setError("The AI returned an unexpected format — try again.");
    } catch (e) {
      setError(e.message || "AI request failed — check your connection.");
    }
    setLoading(false);
  };

  return (
    <>
      <AppBar title={tc({ en: "AI Insights", hi: "AI जानकारी", bn: "AI অন্তর্দৃষ্টি" })} onBack={pop} />
      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 12,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* Health score */}
        <Card pad={16} elevated>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {health ? <ScoreRing score={health.score} /> : <div style={{ width: 110, height: 110 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700 }}>{tc({ en: "Farm Health Score", hi: "फार्म स्वास्थ्य स्कोर", bn: "খামার স্বাস্থ্য স্কোর" })}</div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4, lineHeight: 1.5 }}>
                Computed from your real records: profit, vaccinations, stock alerts, tasks and mortality.
              </div>
            </div>
          </div>
          {health && health.notes.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
              {health.notes.map((n, i) => (
                <div key={i} style={{ fontSize: 12, color: T.inkSoft, display: "flex", gap: 6 }}>
                  <Icon name="AlertCircle" size={13} color={T.orange} style={{ flexShrink: 0, marginTop: 1 }} />
                  {n}
                </div>
              ))}
            </div>
          )}
          {health && health.notes.length === 0 && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: T.primary, fontWeight: 600 }}>
              ✓ No issues detected in your records
            </div>
          )}
        </Card>

        {/* AI advice */}
        <SectionHeader title={tc({ en: "AI Advisor", hi: "AI सलाहकार", bn: "AI পরামর্শদাতা" })} />
        {!insights && (
          <Card pad={16}>
            <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6, marginBottom: 12 }}>
              Sends a summary of your farm records to the AI advisor and returns
              specific advice on profitability, disease risk, inventory and growth.
            </div>
            <Button full icon="Sparkles" onClick={ask} disabled={loading || !data}>
              {loading ? "Analysing your farm…" : "Get AI Insights"}
            </Button>
            {error && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: T.red }}>{error}</div>
            )}
          </Card>
        )}

        {insights && (
          <>
            {insights.map((tip, i) => (
              <Card key={i} pad={13}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: T.blueSoft,
                    display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon name="Lightbulb" size={16} color={T.blue} />
                  </div>
                  <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55 }}>{tip}</div>
                </div>
              </Card>
            ))}
            <Button full variant="soft" icon="RefreshCw" onClick={ask} disabled={loading}>
              {loading ? "Analysing…" : "Refresh Insights"}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
