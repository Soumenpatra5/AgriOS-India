import { useEffect, useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, EmptyState } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import DiagnosticCard from "../components/DiagnosticCard.jsx";
import { historyService } from "../services/diagnostics/historyService.js";
import { domainRegistry } from "../services/diagnostics/domainRegistry.js";

const SEVERITY_FILTERS = ["All", "Critical", "Severe", "Moderate", "Mild", "Healthy"];

export default function DiagnosticHistory() {
  const { pop, push, tc } = useApp();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter,   setDomainFilter]   = useState("all");
  const [severityFilter, setSeverityFilter] = useState("All");

  const domains = [{ id: "all", name: "All", icon: "LayoutGrid" }, ...domainRegistry.getAll()];

  useEffect(() => { load(); }, []);

  const load = () => {
    setLoading(true);
    historyService.getAll({ limit: 100 })
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  };

  const filtered = records.filter((r) => {
    const domainOk   = domainFilter === "all" || r.domainId === domainFilter;
    const severityOk = severityFilter === "All" || r.severity?.level === severityFilter;
    return domainOk && severityOk;
  });

  const deleteRecord = async (id) => {
    await historyService.delete(id).catch(() => {});
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const openResult = (record) => push({ kind: "diagnosticResult", props: { record } });

  return (
    <>
      <AppBar title={tc({en:"Diagnosis History", hi:"निदान इतिहास", bn:"রোগ নির্ণয়ের ইতিহাস"})} onBack={pop} />

      <div style={{ padding: "12px 16px 32px", animation: "ag-fade .22s var(--ag-ease)" }}>

        {/* Domain filter chips */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 12,
          scrollbarWidth: "none" }}>
          {domains.map((d) => (
            <button key={d.id} onClick={() => setDomainFilter(d.id)}
              style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 99, fontSize: 13,
                cursor: "pointer", fontFamily: T.body,
                border: `1.5px solid ${domainFilter === d.id ? "var(--ag-primary)" : T.line}`,
                background: domainFilter === d.id ? "var(--ag-primary-soft)" : T.surface,
                color: domainFilter === d.id ? "var(--ag-primary)" : T.ink,
                fontWeight: domainFilter === d.id ? 600 : 400,
              }}>
              {d.name}
            </button>
          ))}
        </div>

        {/* Severity filter */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16,
          scrollbarWidth: "none" }}>
          {SEVERITY_FILTERS.map((sf) => (
            <button key={sf} onClick={() => setSeverityFilter(sf)}
              style={{
                flexShrink: 0, padding: "4px 12px", borderRadius: 99, fontSize: 12,
                cursor: "pointer", fontFamily: T.body,
                border: `1.5px solid ${severityFilter === sf ? T.ink : T.lineSoft}`,
                background: severityFilter === sf ? T.ink : T.surface,
                color: severityFilter === sf ? T.bg : T.inkSoft,
                fontWeight: severityFilter === sf ? 600 : 400,
              }}>
              {sf}
            </button>
          ))}
        </div>

        {/* Summary count */}
        {!loading && records.length > 0 && (
          <div style={{ fontSize: 12, color: T.inkFaint, marginBottom: 14 }}>
            {tc({en:`${filtered.length} of ${records.length} records`, hi:`${records.length} में से ${filtered.length} रिकॉर्ड`, bn:`${records.length}-এর মধ্যে ${filtered.length}টি রেকর্ড`})}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: T.inkSoft }}>
            <Icon name="RefreshCw" size={24} style={{ animation: "ag-blink 1.2s infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="History" title={tc({en:"No diagnoses yet", hi:"अभी कोई निदान नहीं", bn:"এখনও কোনো রোগ নির্ণয় নেই"})}
            body={records.length === 0
              ? tc({en:"Start your first AI diagnosis by selecting a domain from the Diagnostics home.", hi:"डायग्नोस्टिक्स होम से एक श्रेणी चुनकर अपना पहला AI निदान शुरू करें।", bn:"ডায়াগনস্টিক্স হোম থেকে একটি বিভাগ নির্বাচন করে আপনার প্রথম AI রোগ নির্ণয় শুরু করুন।"})
              : tc({en:"No records match the selected filters.", hi:"चयनित फ़िल्टर से कोई रिकॉर्ड मेल नहीं खाता।", bn:"নির্বাচিত ফিল্টারের সাথে কোনো রেকর্ড মেলেনি।"})}
            action={records.length === 0 ? tc({en:"Start a diagnosis", hi:"निदान शुरू करें", bn:"রোগ নির্ণয় শুরু করুন"}) : undefined}
            onAction={records.length === 0 ? () => push({ kind: "diagnosticsHome" }) : undefined} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((r) => (
              <div key={r.id} style={{ position: "relative" }}>
                <DiagnosticCard record={r} onClick={openResult} />
                <button onClick={(e) => { e.stopPropagation(); deleteRecord(r.id); }}
                  style={{ position: "absolute", top: 12, right: 44, background: "none",
                    border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}
                  aria-label={tc({ en: "Delete record", hi: "रिकॉर्ड हटाएँ", bn: "রেকর্ড মুছুন" })}>
                  <Icon name="Trash2" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
