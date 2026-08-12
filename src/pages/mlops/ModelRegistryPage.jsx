import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, EmptyState } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import ModelVersionBadge from "../../components/mlops/ModelVersionBadge.jsx";
import ApprovalBanner from "../../components/mlops/ApprovalBanner.jsx";
import { mlModelRegistry, MODEL_STAGES } from "../../services/mlops/registry/mlModelRegistry.js";
import { frameworkAdapter } from "../../services/mlops/registry/frameworkAdapter.js";
import { promotionEngine } from "../../services/mlops/deployment/promotionEngine.js";
import { complianceChecker } from "../../services/mlops/governance/complianceChecker.js";

const STAGE_FILTERS = ["all", ...Object.values(MODEL_STAGES)];

export default function ModelRegistryPage() {
  const { pop, push, tc, toast } = useApp();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState("all");
  const [pendingPromotions, setPendingPromotions] = useState(0);
  const [promotingId, setPromotingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const [mdls, pending] = await Promise.all([
      mlModelRegistry.getAll(),
      Promise.resolve(promotionEngine.getPendingCount()),
    ]);
    setModels(mdls);
    setPendingPromotions(pending);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = stageFilter === "all" ? models : models.filter((m) => m.stage === stageFilter);

  const requestPromotion = async (modelId) => {
    setPromotingId(modelId);
    try {
      await promotionEngine.requestPromotion(modelId);
      await load();
    } catch (err) {
      toast(err.message, "info");
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <>
      <AppBar title={tc({en:"Model Registry", hi:"मॉडल रजिस्ट्री", bn:"মডেল রেজিস্ট্রি"})} onBack={pop} />
      <div style={{ padding: "12px 16px 32px", animation: "ag-fade .22s var(--ag-ease)" }}>

        <ApprovalBanner count={pendingPromotions} label={tc({en:"promotion requests pending", hi:"प्रमोशन अनुरोध लंबित", bn:"প্রোমোশন অনুরোধ মুলতুবি"})}
          onAction={() => push({ kind: "trainingDashboard" })} />

        {/* Stage filter */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 14, scrollbarWidth: "none" }}>
          {STAGE_FILTERS.map((s) => (
            <button key={s} onClick={() => setStageFilter(s)} style={{
              flexShrink: 0, padding: "5px 12px", borderRadius: 99, fontSize: 12, cursor: "pointer", fontFamily: T.body,
              border: `1.5px solid ${stageFilter === s ? "var(--ag-primary)" : T.line}`,
              background: stageFilter === s ? "var(--ag-primary-soft)" : T.surface,
              color: stageFilter === s ? "var(--ag-primary)" : T.inkSoft,
              fontWeight: stageFilter === s ? 600 : 400, textTransform: "capitalize",
            }}>
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: T.inkSoft }}>
            <Icon name="RefreshCw" size={24} style={{ animation: "ag-blink 1.2s infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="Layers" title={tc({en:"No models", hi:"कोई मॉडल नहीं", bn:"কোনো মডেল নেই"})} body={tc({en:"No models match the current filter.", hi:"वर्तमान फ़िल्टर से कोई मॉडल मेल नहीं खाता।", bn:"বর্তমান ফিল্টারের সাথে কোনো মডেল মেলে না।"})} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((model) => {
              const fw = frameworkAdapter.normalize(model);
              const compliance = complianceChecker.checkModel(model);
              return (
                <div key={model.id} style={{ background: T.surface, borderRadius: T.rLg,
                  border: `1px solid ${T.line}`, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 4 }}>{model.name}</div>
                      <ModelVersionBadge version={model.version} stage={model.stage} isChampion={model.isChampion} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                      width: 36, height: 36, borderRadius: T.rMd, background: "#f0f9ff", flexShrink: 0 }}>
                      <Icon name={fw.frameworkIcon} size={18} color="#0ea5e9" />
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 4 }}>
                    {fw.frameworkLabel} · {model.source || fw.runtime}
                  </div>

                  {model.description && (
                    <div style={{ fontSize: 12, color: T.inkFaint, marginBottom: 8 }}>{model.description}</div>
                  )}

                  {/* Compliance indicator */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Icon name={compliance.compliant ? "ShieldCheck" : "ShieldAlert"} size={13}
                      color={compliance.compliant ? "var(--ag-primary)" : "var(--ag-orange)"} />
                    <span style={{ fontSize: 11, color: compliance.compliant ? "var(--ag-primary)" : "var(--ag-orange)" }}>
                      {tc({en:"Compliance", hi:"अनुपालन", bn:"কমপ্লায়েন্স"})} {compliance.score}%
                    </span>
                    {compliance.warnings.length > 0 && (
                      <span style={{ fontSize: 11, color: T.inkFaint }}>· {compliance.warnings.length} {compliance.warnings.length !== 1 ? tc({en:"warnings", hi:"चेतावनियाँ", bn:"সতর্কতা"}) : tc({en:"warning", hi:"चेतावनी", bn:"সতর্কতা"})}</span>
                    )}
                  </div>

                  {/* Actions */}
                  {model.stage !== MODEL_STAGES.PRODUCTION && model.stage !== MODEL_STAGES.ARCHIVED && (
                    <button onClick={() => requestPromotion(model.id)}
                      disabled={promotingId === model.id}
                      style={{ fontSize: 12, fontWeight: 600, color: "var(--ag-primary)",
                        background: "var(--ag-primary-soft)", border: "none", borderRadius: T.rMd,
                        padding: "6px 14px", cursor: "pointer", fontFamily: T.body }}>
                      {promotingId === model.id ? tc({en:"Requesting…", hi:"अनुरोध किया जा रहा है…", bn:"অনুরোধ করা হচ্ছে…"}) : tc({en:"Request Promotion →", hi:"प्रमोशन का अनुरोध करें →", bn:"প্রোমোশনের অনুরোধ করুন →"})}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
