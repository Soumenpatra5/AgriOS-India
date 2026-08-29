import { useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, SectionHeader } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { reportService, REPORT_TYPES } from "../../services/reports/reportService.js";

export default function ReportsCenter() {
  const { pop, toast, tc } = useApp();
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async (typeId) => {
    setLoading(true);
    try { setReport(await reportService.build(typeId)); }
    catch (e) { toast(tc({ en: "Could not build report", hi: "रिपोर्ट नहीं बन सकी", bn: "রিপোর্ট তৈরি করা যায়নি" }), "error"); }
    setLoading(false);
  };

  return (
    <>
      <AppBar title={tc({ en: "Reports", hi: "रिपोर्ट", bn: "রিপোর্ট" })} onBack={pop} />
      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 12,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        <SectionHeader title={tc({ en: "Generate Report", hi: "रिपोर्ट बनाएँ", bn: "রিপোর্ট তৈরি করুন" })} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {REPORT_TYPES.map((r) => (
            <Card key={r.id} onClick={() => generate(r.id)} pad={13}
              style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.orangeSoft,
                display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name={r.icon} size={18} color={T.orange} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{r.i18n ? tc(r.i18n) : r.label}</div>
            </Card>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "20px 0", color: T.inkSoft, fontSize: 13 }}>
            Building report from your records…
          </div>
        )}

        {report && !loading && (
          <>
            <Card pad={16} elevated>
              <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700 }}>{report.title}</div>
              <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2, marginBottom: 12 }}>
                Generated {report.generatedAt}
              </div>

              {report.sections.map((s, si) => (
                <div key={si} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase",
                    letterSpacing: .4, borderBottom: `1px solid ${T.line}`, paddingBottom: 4, marginBottom: 8 }}>
                    {s.heading}
                  </div>
                  {s.rows && s.rows.map((r, ri) => (
                    <div key={ri} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                      <span style={{ color: T.inkSoft }}>{r.label}</span>
                      <b style={{ color: T.ink }}>{r.value}</b>
                    </div>
                  ))}
                  {s.table && (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr>{s.table.headers.map((h, hi) => (
                            <th key={hi} style={{ textAlign: "left", padding: "5px 8px", color: T.inkSoft,
                              borderBottom: `1px solid ${T.line}`, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {s.table.data.length === 0
                            ? <tr><td colSpan={s.table.headers.length}
                                style={{ padding: "8px", color: T.inkFaint, textAlign: "center" }}>{tc({ en: "No data yet", hi: "अभी कोई डेटा नहीं", bn: "এখনও কোনও তথ্য নেই" })}</td></tr>
                            : s.table.data.map((row, ri) => (
                              <tr key={ri}>{row.map((c, ci) => (
                                <td key={ci} style={{ padding: "5px 8px", borderBottom: `1px solid ${T.lineSoft}`,
                                  color: T.ink, whiteSpace: "nowrap" }}>{c}</td>
                              ))}</tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </Card>

            <div style={{ display: "flex", gap: 10 }}>
              <Button full icon="FileDown" variant="soft" onClick={() => { reportService.downloadCsv(report); toast(tc({ en: "CSV downloaded — opens in Excel", hi: "CSV डाउनलोड हुई — Excel में खुलेगी", bn: "CSV ডাউনলোড হয়েছে — Excel-এ খুলবে" }), "success"); }}>
                {tc({ en: "Excel (CSV)", hi: "Excel (CSV)", bn: "Excel (CSV)" })}
              </Button>
              <Button full icon="Printer" onClick={() => reportService.print(report)}>
                PDF / Print
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
