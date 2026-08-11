/* Farm-wide feed wastage log (across all batches). Per-batch wastage entry
   also lives inside FeedBatchDetail.jsx — this is the read-only rollup. */
import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Screen } from "../../components/index.js";
import { RecordRow, EmptyHint } from "../../components/erp/RecordList.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { feedWastageService } from "../../services/feed/feedWastageService.js";
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
  const { pop } = useApp();
  const [entries, setEntries] = useState(null);

  useEffect(() => { feedWastageService.all().then(setEntries); }, []);

  if (entries === null) {
    return (<><AppBar title="Feed wastage" onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>Loading…</div></>);
  }

  const totalQty = entries.reduce((s, e) => s + (Number(e.quantity) || 0), 0);
  const totalCost = entries.reduce((s, e) => s + (Number(e.costImpact) || 0), 0);

  return (
    <>
      <AppBar title="Feed wastage" onBack={pop} />
      <Screen gap={16}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatBox label="Total wastage" value={`${totalQty.toLocaleString("en-IN")} kg`} />
          <StatBox label="Wastage cost" value={rupee(totalCost)} fg={T.red} />
        </div>

        {entries.length === 0 ? (
          <EmptyHint icon="AlertTriangle" text="No wastage logged yet." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((e) => (
              <RecordRow key={e.id} icon="AlertTriangle" iconColor={T.red} iconBg={T.redSoft}
                title={`${e.quantity.toLocaleString("en-IN")} kg — ${feedWastageService.reasonLabel(e.reason)}`}
                subtitle={`${e.date} · ${rupee(e.costImpact)}`} />
            ))}
          </div>
        )}
      </Screen>
    </>
  );
}
