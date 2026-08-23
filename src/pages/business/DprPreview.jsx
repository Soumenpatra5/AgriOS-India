/* DPR preview — the finished report exactly as it will print, plus the two
   exports (print / Save-as-PDF, and CSV for Excel). Read-only: edits happen
   back in the editor. */

import { useState, useEffect, useMemo } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import Restricted from "../../components/Restricted.jsx";
import { dprService, project as computeProject } from "../../services/business/dpr/dprService.js";
import { buildDocument } from "../../services/business/dpr/dprDocument.js";
import { printDpr, downloadCsv } from "../../services/business/dpr/dprExport.js";
import { VerdictChip } from "./DprGenerator.jsx";

const H_PAD = 16;

function RowsBlock({ rows }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 12, padding: "7px 0",
          borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
          <div style={{ flex: 1, fontSize: 12.5, color: T.inkSoft }}>{r.label}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, textAlign: "right" }}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}

function TableBlock({ table }) {
  const { headers, data, total } = table;
  const cell = { padding: "6px 8px", fontSize: 11.5, whiteSpace: "nowrap", borderBottom: `1px solid ${T.lineSoft}` };
  return (
    <div style={{ overflowX: "auto", margin: "0 -4px" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: headers.length > 4 ? 520 : "auto" }}>
        <thead>
          <tr>{headers.map((h, i) => (
            <th key={i} style={{ ...cell, textAlign: i === 1 || i === 0 ? "left" : "right",
              fontWeight: 700, color: T.inkSoft, background: T.surface2 }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri}>{row.map((c, ci) => (
              <td key={ci} style={{ ...cell, textAlign: ci === 1 || ci === 0 ? "left" : "right", color: T.ink }}>{c}</td>
            ))}</tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr>{total.map((c, ci) => (
              <th key={ci} style={{ ...cell, textAlign: ci === 1 || ci === 0 ? "left" : "right",
                fontWeight: 700, color: T.ink, background: T.surface2 }}>{c}</th>
            ))}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function DprPreview({ id }) {
  const { pop, tc, can, toast } = useApp();
  const [d, setD] = useState(null);

  useEffect(() => { dprService.get(id).then(setD); }, [id]);

  const { computed, doc } = useMemo(() => {
    if (!d) return { computed: null, doc: null };
    const c = computeProject(d);
    return { computed: c, doc: buildDocument(d, c) };
  }, [d]);

  const title = tc({ en: "Project report", hi: "परियोजना रिपोर्ट", bn: "প্রকল্প রিপোর্ট" });
  if (!can("finance.view")) return (<><AppBar title={title} onBack={pop} /><Restricted tc={tc} /></>);
  if (!d) return <><AppBar title={title} onBack={pop} /></>;

  const onPrint = () => {
    if (!printDpr(d, computed)) {
      toast(tc({
        en: "Allow pop-ups for this site to print the report",
        hi: "रिपोर्ट प्रिंट करने के लिए इस साइट के पॉप-अप की अनुमति दें",
        bn: "রিপোর্ট প্রিন্ট করতে এই সাইটের পপ-আপ অনুমতি দিন",
      }), "error");
    }
  };

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: `8px ${H_PAD}px 96px`, display: "flex", flexDirection: "column", gap: 12,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* Header */}
        <Card pad={16}>
          <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 4 }}>
            {doc.title}
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft }}>
            {tc({ en: "Detailed Project Report", hi: "विस्तृत परियोजना रिपोर्ट", bn: "বিস্তারিত প্রকল্প রিপোর্ট" })}
            {doc.applicant ? ` · ${doc.applicant}` : ""}
          </div>
          <div style={{ marginTop: 10 }}><VerdictChip level={doc.verdict.level} tc={tc} /></div>
        </Card>

        {/* Sections */}
        {doc.sections.map((s) => (
          <Card key={s.heading} pad={14}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.primary, marginBottom: 9 }}>{s.heading}</div>
            {s.text  && <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{s.text}</div>}
            {s.rows  && <RowsBlock rows={s.rows} />}
            {s.table && <TableBlock table={s.table} />}
          </Card>
        ))}

        {/* Disclaimer */}
        <Card pad={14} style={{ background: T.yellowSoft, border: "none" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <Icon name="Info" size={17} color={T.yellow} />
            <div style={{ fontSize: 11.5, color: T.ink, lineHeight: 1.5 }}>{doc.disclaimer}</div>
          </div>
        </Card>
      </div>

      {/* Sticky export bar */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: `10px ${H_PAD}px`,
        background: T.surface, borderTop: `1px solid ${T.line}`, display: "flex", gap: 10, zIndex: 20 }}>
        <Button variant="outline" icon="Download" style={{ flex: 1 }}
          onClick={() => downloadCsv(d, computed)}>
          {tc({ en: "Excel (CSV)", hi: "Excel (CSV)", bn: "Excel (CSV)" })}
        </Button>
        <Button icon="Printer" style={{ flex: 1 }} onClick={onPrint}>
          {tc({ en: "Print / PDF", hi: "प्रिंट / PDF", bn: "প্রিন্ট / PDF" })}
        </Button>
      </div>
    </>
  );
}
