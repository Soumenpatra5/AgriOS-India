/* DPR editor — every figure in the project report, grouped the way a bank
   proposal is structured, with the viability ratios recomputing live as the
   farmer edits. Template numbers are only a starting point, so every head is
   editable and rows can be added or removed. */

import { useState, useEffect, useMemo, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, Input, Dropdown, Divider } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import Restricted from "../../components/Restricted.jsx";
import { dprService, project as computeProject, unitsText } from "../../services/business/dpr/dprService.js";
import { VerdictChip } from "./DprGenerator.jsx";
import { rupee, compact } from "../../utils/format.js";

const H_PAD = 16;
const uid = () => Math.random().toString(36).slice(2, 9);

function Section({ id, title, icon, open, onToggle, children, summary }) {
  const isOpen = open === id;
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <button onClick={() => onToggle(isOpen ? null : id)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: 14,
          background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: T.body }}>
        <Icon name={icon} size={17} color={T.primary} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{title}</div>
          {summary && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{summary}</div>}
        </div>
        <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={16} color={T.inkFaint} />
      </button>
      {isOpen && (
        <div style={{ padding: `0 14px 16px`, display: "flex", flexDirection: "column", gap: 12 }}>
          <Divider />
          {children}
        </div>
      )}
    </Card>
  );
}

/* An editable list of cost/revenue heads: label + amount per unit. */
function HeadRows({ rows, onChange, unitLabel, tc, addLabel }) {
  const set = (i, patch) => onChange(rows.map((r, x) => (x === i ? { ...r, ...patch } : r)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r, i) => (
        <div key={r.id} style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div style={{ flex: 1.4, minWidth: 0 }}>
            <Input label={i === 0 ? tc({ en: "Particulars", hi: "विवरण", bn: "বিবরণ" }) : undefined}
              value={r.label} onChange={(v) => set(i, { label: v })} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Input label={i === 0 ? `${tc({ en: "Per", hi: "प्रति", bn: "প্রতি" })} ${unitLabel}` : undefined}
              type="number" value={r.perUnit} onChange={(v) => set(i, { perUnit: v })} />
          </div>
          <button onClick={() => onChange(rows.filter((_, x) => x !== i))}
            aria-label={tc({ en: "Remove row", hi: "पंक्ति हटाएँ", bn: "সারি সরান" })}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: "0 0 12px" }}>
            <Icon name="X" size={16} />
          </button>
        </div>
      ))}
      <Button variant="ghost" size="sm" icon="Plus"
        onClick={() => onChange([...rows, { id: uid(), label: "", perUnit: 0 }])}>
        {addLabel}
      </Button>
    </div>
  );
}

export default function DprEditor({ id }) {
  const { pop, push, tc, can, toast } = useApp();
  const [d, setD]       = useState(null);
  const [open, setOpen] = useState("project");
  const [dirty, setDirty] = useState(false);

  useEffect(() => { dprService.get(id).then(setD); }, [id]);

  const computed = useMemo(() => (d ? computeProject(d) : null), [d]);

  const set = useCallback((patch) => { setD((x) => ({ ...x, ...patch })); setDirty(true); }, []);
  const setIn = (group, k, v) => set({ [group]: { ...d[group], [k]: v } });

  const save = useCallback(async () => {
    await dprService.update(id, d);
    setDirty(false);
    toast(tc({ en: "Saved", hi: "सहेजा गया", bn: "সংরক্ষিত" }), "success");
  }, [id, d, toast, tc]);

  const preview = async () => { if (dirty) await save(); push({ kind: "dprPreview", props: { id } }); };

  const title = tc({ en: "Project report", hi: "परियोजना रिपोर्ट", bn: "প্রকল্প রিপোর্ট" });
  if (!can("finance.view")) return (<><AppBar title={title} onBack={pop} /><Restricted tc={tc} /></>);
  if (!d) return <><AppBar title={title} onBack={pop} /></>;

  const p = d.promoter || {}, fin = d.finance || {}, proj = d.project || {};
  const v = computed.viability;

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: `8px ${H_PAD}px 96px`, display: "flex", flexDirection: "column", gap: 12,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* Live viability summary */}
        <Card pad={14} style={{ background: T.surface2, border: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .4 }}>
              {tc({ en: "Viability", hi: "व्यवहार्यता", bn: "কার্যকারিতা" })}
            </div>
            <VerdictChip level={computed.verdict.level} tc={tc} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { k: tc({ en: "Project cost", hi: "परियोजना लागत", bn: "প্রকল্প ব্যয়" }), v: compact(computed.totalCapital) },
              { k: tc({ en: "Bank loan", hi: "बैंक ऋण", bn: "ব্যাঙ্ক ঋণ" }),        v: compact(computed.means.loan) },
              { k: "DSCR (avg)", v: typeof v.avgDscr === "number" ? v.avgDscr.toFixed(2) : "—" },
              { k: "IRR",        v: typeof v.irr === "number" ? `${v.irr.toFixed(1)}%` : "—" },
              { k: "BCR",        v: typeof v.bcr === "number" ? v.bcr.toFixed(2) : "—" },
              { k: tc({ en: "Payback", hi: "वापसी", bn: "পরিশোধ" }), v: typeof v.payback === "number" ? `${v.payback.toFixed(1)} yr` : "—" },
            ].map((m) => (
              <div key={m.k}>
                <div style={{ fontSize: 10.5, color: T.inkFaint }}>{m.k}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: T.display }}>{m.v}</div>
              </div>
            ))}
          </div>
          {computed.verdict.level === "weak" && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: T.red, lineHeight: 1.45 }}>
              {tc({
                en: "Below-norm ratios: " + computed.verdict.checks.filter((c) => c.status === "weak").map((c) => c.label).join(", ") + ". A bank is likely to question this proposal.",
                hi: "मानक से कम अनुपात: " + computed.verdict.checks.filter((c) => c.status === "weak").map((c) => c.label).join(", ") + "। बैंक इस प्रस्ताव पर सवाल उठा सकता है।",
                bn: "মানের নিচে অনুপাত: " + computed.verdict.checks.filter((c) => c.status === "weak").map((c) => c.label).join(", ") + "। ব্যাঙ্ক এই প্রস্তাব নিয়ে প্রশ্ন তুলতে পারে।",
              })}
            </div>
          )}
        </Card>

        {/* Project & size */}
        <Section id="project" open={open} onToggle={setOpen} icon="FileText"
          title={tc({ en: "Project & size", hi: "परियोजना और आकार", bn: "প্রকল্প ও আকার" })}
          summary={unitsText(d.units, d.unitLabel)}>
          <Input label={tc({ en: "Project title", hi: "परियोजना शीर्षक", bn: "প্রকল্পের শিরোনাম" })}
            value={proj.title} onChange={(v) => setIn("project", "title", v)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={`${tc({ en: "Number of", hi: "संख्या", bn: "সংখ্যা" })} ${d.unitLabel}`}
              type="number" value={d.units} onChange={(v) => set({ units: v })} />
            <Input label={tc({ en: "Projection years", hi: "प्रक्षेपण वर्ष", bn: "প্রক্ষেপণ বছর" })}
              type="number" value={d.horizonYears} onChange={(v) => set({ horizonYears: v })} />
          </div>
          <Input label={tc({ en: "Location", hi: "स्थान", bn: "অবস্থান" })}
            value={proj.location} onChange={(v) => setIn("project", "location", v)} />
          <Input label={tc({ en: "Purpose of the proposal", hi: "प्रस्ताव का उद्देश्य", bn: "প্রস্তাবের উদ্দেশ্য" })}
            value={proj.purpose} onChange={(v) => setIn("project", "purpose", v)} />
        </Section>

        {/* Promoter */}
        <Section id="promoter" open={open} onToggle={setOpen} icon="UserCheck"
          title={tc({ en: "Applicant details", hi: "आवेदक विवरण", bn: "আবেদনকারীর বিবরণ" })}
          summary={p.name || tc({ en: "Not filled in", hi: "भरा नहीं गया", bn: "পূরণ করা হয়নি" })}>
          <Input label={tc({ en: "Full name", hi: "पूरा नाम", bn: "পুরো নাম" })}
            value={p.name} onChange={(v) => setIn("promoter", "name", v)} />
          <Input label={tc({ en: "Father's / husband's name", hi: "पिता/पति का नाम", bn: "পিতা/স্বামীর নাম" })}
            value={p.fatherName} onChange={(v) => setIn("promoter", "fatherName", v)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Village / town", hi: "गाँव/शहर", bn: "গ্রাম/শহর" })}
              value={p.village} onChange={(v) => setIn("promoter", "village", v)} />
            <Input label={tc({ en: "District", hi: "ज़िला", bn: "জেলা" })}
              value={p.district} onChange={(v) => setIn("promoter", "district", v)} />
            <Input label={tc({ en: "State", hi: "राज्य", bn: "রাজ্য" })}
              value={p.state} onChange={(v) => setIn("promoter", "state", v)} />
            <Input label={tc({ en: "PIN code", hi: "पिन कोड", bn: "পিন কোড" })}
              value={p.pincode} onChange={(v) => setIn("promoter", "pincode", v)} />
            <Input label={tc({ en: "Mobile", hi: "मोबाइल", bn: "মোবাইল" })}
              value={p.mobile} onChange={(v) => setIn("promoter", "mobile", v)} />
            <Dropdown label={tc({ en: "Category", hi: "श्रेणी", bn: "শ্রেণি" })}
              value={p.category} onChange={(v) => setIn("promoter", "category", v)}
              options={["", "General", "OBC", "SC", "ST", "Minority"].map((c) => ({ value: c, label: c || "—" }))} />
            <Input label={tc({ en: "Land (acres)", hi: "भूमि (एकड़)", bn: "জমি (একর)" })}
              type="number" value={p.landAcres} onChange={(v) => setIn("promoter", "landAcres", v)} />
            <Input label={tc({ en: "Experience (years)", hi: "अनुभव (वर्ष)", bn: "অভিজ্ঞতা (বছর)" })}
              type="number" value={p.experienceYears} onChange={(v) => setIn("promoter", "experienceYears", v)} />
          </div>
        </Section>

        {/* Capital cost */}
        <Section id="capital" open={open} onToggle={setOpen} icon="Landmark"
          title={tc({ en: "Cost of project", hi: "परियोजना लागत", bn: "প্রকল্প ব্যয়" })}
          summary={rupee(computed.totalCapital)}>
          <HeadRows rows={d.capital} onChange={(rows) => set({ capital: rows })}
            unitLabel={d.unitLabel} tc={tc}
            addLabel={tc({ en: "Add capital item", hi: "पूँजी मद जोड़ें", bn: "মূলধন খাত যোগ করুন" })} />
        </Section>

        {/* Revenue */}
        <Section id="revenue" open={open} onToggle={setOpen} icon="TrendingUp"
          title={tc({ en: "Income at full capacity", hi: "पूर्ण क्षमता पर आय", bn: "পূর্ণ ক্ষমতায় আয়" })}
          summary={`${rupee(computed.revenueFull)} / ${tc({ en: "year", hi: "वर्ष", bn: "বছর" })}`}>
          <HeadRows rows={d.revenue} onChange={(rows) => set({ revenue: rows })}
            unitLabel={d.unitLabel} tc={tc}
            addLabel={tc({ en: "Add income head", hi: "आय मद जोड़ें", bn: "আয়ের খাত যোগ করুন" })} />
        </Section>

        {/* Running cost */}
        <Section id="opex" open={open} onToggle={setOpen} icon="Wallet"
          title={tc({ en: "Running cost at full capacity", hi: "पूर्ण क्षमता पर संचालन लागत", bn: "পূর্ণ ক্ষমতায় পরিচালন ব্যয়" })}
          summary={`${rupee(computed.opexFull)} / ${tc({ en: "year", hi: "वर्ष", bn: "বছর" })}`}>
          <HeadRows rows={d.recurring} onChange={(rows) => set({ recurring: rows })}
            unitLabel={d.unitLabel} tc={tc}
            addLabel={tc({ en: "Add cost head", hi: "लागत मद जोड़ें", bn: "ব্যয়ের খাত যোগ করুন" })} />
        </Section>

        {/* Output — drives break-even */}
        <Section id="output" open={open} onToggle={setOpen} icon="Scale"
          title={tc({ en: "Output & price", hi: "उत्पादन और मूल्य", bn: "উৎপাদন ও দাম" })}
          summary={`${v.capacityUnits.toLocaleString("en-IN")} ${v.outputUnit} / ${tc({ en: "year", hi: "वर्ष", bn: "বছর" })}`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Output unit", hi: "उत्पादन इकाई", bn: "উৎপাদন একক" })}
              value={d.output?.unit} onChange={(val) => setIn("output", "unit", val)} />
            <Input label={`${tc({ en: "Per", hi: "प्रति", bn: "প্রতি" })} ${d.unitLabel} / ${tc({ en: "year", hi: "वर्ष", bn: "বছর" })}`}
              type="number" value={d.output?.perUnit} onChange={(val) => setIn("output", "perUnit", val)} />
            <Input label={tc({ en: "Selling price per unit", hi: "प्रति इकाई विक्रय मूल्य", bn: "প্রতি এককের বিক্রয় মূল্য" })}
              type="number" value={d.output?.pricePerUnit} onChange={(val) => setIn("output", "pricePerUnit", val)} />
          </div>
          {v.breakEvenUnits !== null && (
            <div style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.45 }}>
              {tc({ en: "Break-even", hi: "लाभ-हानि बराबर", bn: "সমতা বিন্দু" })}: <b style={{ color: T.ink }}>
              {v.breakEvenUnits.toLocaleString("en-IN")} {v.outputUnit}</b> ({v.breakEvenPct?.toFixed(1)}% {tc({ en: "of capacity", hi: "क्षमता का", bn: "ক্ষমতার" })})
            </div>
          )}
        </Section>

        {/* Finance */}
        <Section id="finance" open={open} onToggle={setOpen} icon="Banknote"
          title={tc({ en: "Loan terms", hi: "ऋण शर्तें", bn: "ঋণের শর্ত" })}
          summary={`${rupee(computed.means.loan)} @ ${fin.ratePct}% · ${fin.tenureYears} ${tc({ en: "yrs", hi: "वर्ष", bn: "বছর" })}`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Own contribution (%)", hi: "स्वयं का अंशदान (%)", bn: "নিজস্ব অবদান (%)" })}
              type="number" value={fin.marginPct} onChange={(v2) => setIn("finance", "marginPct", v2)} />
            <Input label={tc({ en: "Subsidy (%)", hi: "सब्सिडी (%)", bn: "ভর্তুকি (%)" })}
              type="number" value={fin.subsidyPct} onChange={(v2) => setIn("finance", "subsidyPct", v2)} />
            <Input label={tc({ en: "Interest rate (%)", hi: "ब्याज दर (%)", bn: "সুদের হার (%)" })}
              type="number" value={fin.ratePct} onChange={(v2) => setIn("finance", "ratePct", v2)} />
            <Input label={tc({ en: "Repayment (years)", hi: "चुकौती (वर्ष)", bn: "পরিশোধ (বছর)" })}
              type="number" value={fin.tenureYears} onChange={(v2) => setIn("finance", "tenureYears", v2)} />
            <Input label={tc({ en: "Moratorium (months)", hi: "अधिस्थगन (माह)", bn: "স্থগিতকাল (মাস)" })}
              type="number" value={fin.moratoriumMonths} onChange={(v2) => setIn("finance", "moratoriumMonths", v2)} />
          </div>
          <Divider />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Bank name", hi: "बैंक का नाम", bn: "ব্যাঙ্কের নাম" })}
              value={d.bank?.name} onChange={(v2) => setIn("bank", "name", v2)} />
            <Input label={tc({ en: "Branch", hi: "शाखा", bn: "শাখা" })}
              value={d.bank?.branch} onChange={(v2) => setIn("bank", "branch", v2)} />
          </div>
        </Section>
      </div>

      {/* Sticky actions */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: `10px ${H_PAD}px`,
        background: T.surface, borderTop: `1px solid ${T.line}`, display: "flex", gap: 10, zIndex: 20 }}>
        <Button variant="outline" onClick={save} disabled={!dirty} icon="Check" style={{ flex: 1 }}>
          {dirty ? tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" }) : tc({ en: "Saved", hi: "सहेजा गया", bn: "সংরক্ষিত" })}
        </Button>
        <Button onClick={preview} icon="FileText" style={{ flex: 1 }}>
          {tc({ en: "Preview report", hi: "रिपोर्ट देखें", bn: "রিপোর্ট দেখুন" })}
        </Button>
      </div>
    </>
  );
}
