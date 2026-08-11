import { useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen, Card } from "../../components/index.js";
import { Button } from "../../components/primitives.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { feedReportService, FEED_REPORT_TYPES } from "../../services/feed/feedReportService.js";
import { reportService } from "../../services/reports/reportService.js";

export default function FeedReports() {
  const { pop, toast } = useApp();
  const [busy, setBusy] = useState(null);

  const run = async (typeId, action) => {
    setBusy(`${typeId}-${action}`);
    try {
      const report = await feedReportService.build(typeId);
      if (action === "csv") { reportService.downloadCsv(report); toast("Report downloaded", "success"); }
      else reportService.print(report);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <AppBar title="Feed reports" onBack={pop} />
      <Screen gap={12}>
        {FEED_REPORT_TYPES.map((r) => (
          <Card key={r.id} pad={14}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="FileText" size={18} style={{ color: T.orange }} />
              <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{r.label}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button size="sm" variant="outline" full disabled={busy === `${r.id}-csv`} onClick={() => run(r.id, "csv")} icon="FileDown">CSV</Button>
              <Button size="sm" variant="outline" full disabled={busy === `${r.id}-print`} onClick={() => run(r.id, "print")} icon="Printer">Print / PDF</Button>
            </div>
          </Card>
        ))}
      </Screen>
    </>
  );
}
