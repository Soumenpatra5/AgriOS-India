/* Farm-wide feed wastage log (across all batches). Per-batch wastage entry
   also lives inside FeedBatchDetail.jsx — this is the read-only rollup. */
import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Screen } from "../../components/index.js";
import { RecordRow, EmptyHint } from "../../components/erp/RecordList.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { feedWastageService , WASTAGE_REASONS } from "../../services/feed/feedWastageService.js";
import { rupee } from "../../utils/format.js";

function StatBox({ label, value, fg }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: fg || T.ink, marginTop: 2 }}>{value}</div>
    </div>
  );
}

export default function FeedWastage() {
  const { pop, tc } = useApp();
  /* Reason rows store the English label; show the reader's script. */
  const reasonText = (id) => {
    const r = WASTAGE_REASONS.find((x) => x.id === id);
    return r?.i18n ? tc(r.i18n) : feedWastageService.reasonLabel(id);
  };
  const [entries, setEntries] = useState(null);

  useEffect(() => { feedWastageService.all().then(setEntries); }, []);

  if (entries === null) {
    return (<><AppBar title={tc({ en: "Feed wastage", hi: "चारा बर्बादी", bn: "খাদ্য অপচয়" })} onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>{tc({ en: "Loading…", hi: "लोड हो रहा है…", bn: "লোড হচ্ছে…" })}</div></>);
  }

  const totalQty = entries.reduce((s, e) => s + (Number(e.quantity) || 0), 0);
  const totalCost = entries.reduce((s, e) => s + (Number(e.costImpact) || 0), 0);

  return (
    <>
      <AppBar title={tc({ en: "Feed wastage", hi: "चारा बर्बादी", bn: "খাদ্য অপচয়" })} onBack={pop} />
      <Screen gap={16}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatBox label={tc({ en: "Total wastage", hi: "कुल बर्बादी", bn: "মোট অপচয়" })} value={`${totalQty.toLocaleString("en-IN")} kg`} />
          <StatBox label={tc({ en: "Wastage cost", hi: "बर्बादी लागत", bn: "অপচয়ের ব্যয়" })} value={rupee(totalCost)} fg={T.red} />
        </div>

        {entries.length === 0 ? (
          <EmptyHint icon="AlertTriangle" text={tc({ en: "No wastage logged yet.", hi: "अभी कोई बर्बादी दर्ज नहीं।", bn: "এখনও কোনও অপচয় লেখা হয়নি।" })} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((e) => (
              <RecordRow key={e.id} icon="AlertTriangle" iconColor={T.red} iconBg={T.redSoft}
                title={`${e.quantity.toLocaleString("en-IN")} kg — ${reasonText(e.reason)}`}
                subtitle={`${e.date} · ${rupee(e.costImpact)}`} />
            ))}
          </div>
        )}
      </Screen>
    </>
  );
}
