import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Chip, EmptyState } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import RecommendationRow from "../../components/aiCommerce/RecommendationRow.jsx";
import ConfidenceBar from "../../components/aiCommerce/ConfidenceBar.jsx";
import { recommendationEngine } from "../../services/aiCommerce/recommendationEngine.js";

export default function RecommendationsPage() {
  const { pop, push, tc } = useApp();
  const [tab, setTab] = useState("personalized");
  const [result, setResult] = useState(null);

  const TABS = [
    { id: "personalized", label: tc({ en: "For You", hi: "आपके लिए", bn: "আপনার জন্য" }) },
    { id: "seasonal", label: tc({ en: "Seasonal", hi: "मौसमी", bn: "মৌসুমী" }) },
    { id: "trending", label: tc({ en: "Trending", hi: "ट्रेंडिंग", bn: "ট্রেন্ডিং" }) },
  ];

  useEffect(() => {
    setResult(null);
    const run = tab === "seasonal"
      ? recommendationEngine.seasonal({ limit: 10 })
      : recommendationEngine.personalized({ limit: 10 });
    run.then(setResult);
  }, [tab]);

  const items = result?.items || [];
  const seasonLabel = result?.season
    ? tc({ en: `${result.season} season`, hi: `${result.season} मौसम`, bn: `${result.season} ঋতু` })
    : null;
  const basis = result?.basis || seasonLabel;

  return (
    <>
      <AppBar title={tc({ en: "Recommendations", hi: "सिफारिशें", bn: "সুপারিশ" })} onBack={pop} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 14,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        <div style={{ display: "flex", gap: 8 }}>
          {TABS.map((tb) => (
            <Chip key={tb.id} active={tab === tb.id} onClick={() => setTab(tb.id)}>{tb.label}</Chip>
          ))}
        </div>

        {result === null ? null : items.length === 0 ? (
          <EmptyState icon="Sparkles" title={tc({ en: "No recommendations yet", hi: "अभी कोई सिफारिश नहीं", bn: "এখনও কোনো সুপারিশ নেই" })}
            body={tc({
              en: "Load AI commerce demo data from the hub, then come back to see personalized picks.",
              hi: "हब से AI कॉमर्स डेमो डेटा लोड करें, फिर व्यक्तिगत सुझाव देखने के लिए वापस आएं।",
              bn: "হাব থেকে AI কমার্স ডেমো ডেটা লোড করুন, তারপর ব্যক্তিগত পছন্দ দেখতে ফিরে আসুন।",
            })} />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              {basis && <span style={{ fontSize: 12, color: T.inkSoft }}>{tc({ en: "Based on", hi: "इसके आधार पर", bn: "এর ভিত্তিতে" })} <b style={{ color: T.ink }}>{basis}</b></span>}
              <div style={{ minWidth: 130 }}><ConfidenceBar confidence={result.confidence} compact /></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((x) => (
                <RecommendationRow key={x.product.id} product={x.product} score={x.score} reasons={x.reasons}
                  onClick={() => push({ kind: "mpProduct", props: { productId: x.product.id } })} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
