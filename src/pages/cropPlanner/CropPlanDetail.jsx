import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen, Card, Chip } from "../../components/index.js";
import { Dropdown, Input } from "../../components/inputs.jsx";
import { Button } from "../../components/primitives.jsx";
import { Dialog } from "../../components/overlays.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { cropPlanService, CROP_PLAN_STATUSES } from "../../services/cropPlanner/cropPlanService.js";
import { applyScenario } from "../../services/cropPlanner/calcEngine.js";
import { reportService } from "../../services/reports/reportService.js";
import PlanSummary from "../../components/cropPlanner/PlanSummary.jsx";
import { rupee } from "../../utils/format.js";

/* Built per render rather than held as module constants, because tc() only
   exists once the app context is mounted. The keys stay English — they index
   into the computed plan and into plan.postedCategories. */
const scenarioList = (tc) => [
  { key: "conservative", label: tc({ en: "Conservative", hi: "रूढ़िवादी", bn: "রক্ষণশীল" }) },
  { key: "expected",     label: tc({ en: "Expected", hi: "अपेक्षित", bn: "প্রত্যাশিত" }) },
  { key: "optimistic",   label: tc({ en: "Optimistic", hi: "आशावादी", bn: "আশাবাদী" }) },
];

const ledgerBuckets = (tc) => [
  { key: "seed",       label: tc({ en: "Seed", hi: "बीज", bn: "বীজ" }) },
  { key: "fertilizer", label: tc({ en: "Fertilizer", hi: "उर्वरक", bn: "সার" }) },
  { key: "protection", label: tc({ en: "Crop protection", hi: "फ़सल सुरक्षा", bn: "ফসল সুরক্ষা" }) },
  { key: "organic",    label: tc({ en: "Organic inputs", hi: "जैविक इनपुट", bn: "জৈব উপকরণ" }) },
  { key: "irrigation", label: tc({ en: "Irrigation", hi: "सिंचाई", bn: "সেচ" }) },
  { key: "labour",     label: tc({ en: "Labour", hi: "श्रम", bn: "শ্রম" }) },
  { key: "machinery",  label: tc({ en: "Machinery", hi: "मशीनरी", bn: "যন্ত্রপাতি" }) },
  { key: "other",      label: tc({ en: "Other costs", hi: "अन्य लागत", bn: "অন্যান্য খরচ" }) },
];

function Section({ title, icon, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: T.inkSoft,
        textTransform: "uppercase", letterSpacing: .4, marginBottom: 10, padding: "0 2px" }}>
        {icon && <Icon name={icon} size={14} />} {title}
      </div>
      {children}
    </div>
  );
}

function bucketAmount(computed, key) {
  if (key === "seed") return computed.seed.totalSeedCost;
  if (key === "irrigation") return computed.irrigation.total;
  return computed[key]?.total || 0;
}

export default function CropPlanDetail({ id }) {
  const { pop, push, toast, tc } = useApp();
  const [plan, setPlan] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [delOpen, setDelOpen] = useState(false);
  const [checkingInventory, setCheckingInventory] = useState(false);
  const [scenarios, setScenarios] = useState({
    conservative: { yieldPct: "", pricePct: "", costPct: "" },
    expected: { yieldPct: 0, pricePct: 0, costPct: 0 },
    optimistic: { yieldPct: "", pricePct: "", costPct: "" },
  });

  const refresh = () => cropPlanService.getById(id).then(setPlan);
  useEffect(() => { refresh(); }, [id]);

  if (!plan) {
    return (<><AppBar title={tc({ en: "Crop plan", hi: "फ़सल योजना", bn: "ফসল পরিকল্পনা" })} onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>{tc({ en: "Loading…", hi: "लोड हो रहा है…", bn: "লোড হচ্ছে…" })}</div></>);
  }

  const checkInventory = async () => {
    setCheckingInventory(true);
    try {
      const lines = await cropPlanService.reconcileInventory(plan, plan.farmId);
      setInventory(lines);
    } finally {
      setCheckingInventory(false);
    }
  };

  const requestPurchase = async (line) => {
    await cropPlanService.createPurchaseRequest({ item: line.label, qty: line.shortfall, unit: line.unit, rate: line.purchaseCost / line.shortfall || 0 });
    toast(tc({
      en: `Purchase request created for ${line.label}`,
      hi: `${line.label} के लिए खरीद अनुरोध बनाया गया`,
      bn: `${line.label}-এর জন্য ক্রয়ের অনুরোধ তৈরি হয়েছে`,
    }), "success");
  };

  const postBucket = async (key) => {
    const res = await cropPlanService.postBucketToLedger(plan, key);
    if (res.posted) { toast(tc({ en: "Posted to Farm Ledger", hi: "फ़ार्म बहीखाते में दर्ज", bn: "খামার খতিয়ানে যোগ হয়েছে" }), "success"); refresh(); }
    else if (res.alreadyPosted) toast(tc({ en: "Already posted", hi: "पहले ही दर्ज है", bn: "আগেই যোগ করা হয়েছে" }), "info");
    else toast(tc({ en: "Nothing to post for this bucket", hi: "इस मद में दर्ज करने को कुछ नहीं", bn: "এই খাতে যোগ করার কিছু নেই" }), "info");
  };

  const statusOptions = CROP_PLAN_STATUSES.map((s) => ({ value: s.id, label: s.i18n ? tc(s.i18n) : s.label }));

  const setScenarioField = (key, field, v) => setScenarios((s) => ({ ...s, [key]: { ...s[key], [field]: v } }));
  const n2 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

  return (
    <>
      <AppBar title={plan.cropName || tc({ en: "Crop plan", hi: "फ़सल योजना", bn: "ফসল পরিকল্পনা" })} onBack={pop} action={
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => push({ kind: "cropPlanner", props: { planId: plan.id } })} aria-label={tc({ en: "Edit", hi: "संपादित करें", bn: "সম্পাদনা" })}
            style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, cursor: "pointer", color: T.ink, display: "flex" }}>
            <Icon name="Pencil" size={16} />
          </button>
          <button onClick={() => setDelOpen(true)} aria-label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
            style={{ background: T.redSoft, border: "none", borderRadius: 12, padding: 8, cursor: "pointer", color: T.red, display: "flex" }}>
            <Icon name="Trash2" size={16} />
          </button>
        </div>
      } />

      <Screen gap={20}>
        <Card pad={14}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700 }}>{plan.cropName}{plan.variety ? ` — ${plan.variety}` : ""}</div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3 }}>{plan.areaValue || plan.areaAcres} {plan.areaUnit || tc({ en: "acre", hi: "एकड़", bn: "একর" })} · {plan.season || tc({ en: "season not set", hi: "मौसम तय नहीं", bn: "মৌসুম নির্ধারিত নয়" })}</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Dropdown value={plan.status} options={statusOptions}
              onChange={async (v) => { await cropPlanService.setStatus(plan.id, v); refresh(); }} />
          </div>
          {plan.notes && <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 10, lineHeight: 1.5 }}>{plan.notes}</div>}
        </Card>

        <PlanSummary plan={plan.computed} showProfitability={plan.yieldPerAcre > 0 || plan.sellingPrice > 0} />

        <Section title={tc({ en: "Inventory check", hi: "स्टॉक जाँच", bn: "মজুত যাচাই" })} icon="Boxes">
          {inventory === null ? (
            <Button variant="outline" full onClick={checkInventory} disabled={checkingInventory} icon="Search">
              {checkingInventory
                ? tc({ en: "Checking…", hi: "जाँच हो रही है…", bn: "যাচাই চলছে…" })
                : tc({ en: "Check inventory for this plan", hi: "इस योजना के लिए स्टॉक जाँचें", bn: "এই পরিকল্পনার জন্য মজুত যাচাই করুন" })}
            </Button>
          ) : inventory.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.inkFaint }}>{tc({ en: "No seed/fertilizer/protection/organic inputs to check.", hi: "जाँचने के लिए कोई बीज/उर्वरक/सुरक्षा/जैविक इनपुट नहीं।", bn: "যাচাই করার মতো কোনও বীজ/সার/সুরক্ষা/জৈব উপকরণ নেই।" })}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {inventory.map((line, i) => (
                <Card key={i} pad={12}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{line.label}</span>
                    <span style={{ fontSize: 12, color: T.inkSoft }}>{tc({ en: "Required", hi: "आवश्यक", bn: "প্রয়োজন" })}: {line.required.toLocaleString("en-IN")} {line.unit}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                    {tc({ en: "Available", hi: "उपलब्ध", bn: "মজুত" })}: {line.available === null
                      ? tc({ en: "no matching inventory item", hi: "कोई मेल खाता स्टॉक आइटम नहीं", bn: "মিল আছে এমন কোনও মজুত নেই" })
                      : `${line.available.toLocaleString("en-IN")} ${line.unit}`}
                  </div>
                  {line.shortfall > 0 ? (
                    <>
                      <div style={{ fontSize: 12.5, color: T.red, fontWeight: 600, marginTop: 4 }}>
                        {tc({ en: "Shortfall", hi: "कमी", bn: "ঘাটতি" })}: {line.shortfall.toLocaleString("en-IN")} {line.unit}{line.purchaseCost > 0 ? ` · ${tc({ en: "est.", hi: "अनु.", bn: "আনু." })} ${rupee(line.purchaseCost)}` : ""}
                      </div>
                      <Button size="sm" variant="soft" style={{ marginTop: 8 }} onClick={() => requestPurchase(line)} icon="ShoppingCart">
                        {tc({ en: "Create purchase request", hi: "खरीद अनुरोध बनाएँ", bn: "ক্রয়ের অনুরোধ তৈরি করুন" })}
                      </Button>
                    </>
                  ) : (
                    <div style={{ fontSize: 12.5, color: T.primary, fontWeight: 600, marginTop: 4 }}>{tc({ en: "Fully in stock", hi: "पूरा स्टॉक उपलब्ध", bn: "সম্পূর্ণ মজুত আছে" })}</div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Section>

        <Section title={tc({ en: "Post costs to Farm Ledger", hi: "लागत फ़ार्म बहीखाते में दर्ज करें", bn: "খরচ খামার খতিয়ানে যোগ করুন" })} icon="Receipt">
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginBottom: 10 }}>
            {tc({ en: "Posts each cost bucket as an expense in Farm Ledger, tagged to the Crop enterprise. Each bucket can only be posted once.",
                  hi: "हर लागत मद को फ़ार्म बहीखाते में फ़सल उद्यम के अंतर्गत व्यय के रूप में दर्ज करता है। हर मद केवल एक बार दर्ज हो सकती है।",
                  bn: "প্রতিটি খরচের খাত খামার খতিয়ানে ফসল উদ্যোগের অধীনে ব্যয় হিসেবে যোগ করে। প্রতিটি খাত একবারই যোগ করা যায়।" })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ledgerBuckets(tc).map(({ key, label }) => {
              const amount = bucketAmount(plan.computed, key);
              const posted = !!plan.postedCategories?.[key];
              if (amount <= 0) return null;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px",
                  background: T.surface2, borderRadius: T.rMd }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11.5, color: T.inkSoft }}>{rupee(amount)}</div>
                  </div>
                  {posted ? (
                    <Chip icon="Check">{tc({ en: "Posted", hi: "दर्ज", bn: "যোগ হয়েছে" })}</Chip>
                  ) : (
                    <Button size="sm" variant="soft" onClick={() => postBucket(key)}>{tc({ en: "Post", hi: "दर्ज करें", bn: "যোগ করুন" })}</Button>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <Section title={tc({ en: "What-if scenarios", hi: "क्या-अगर परिदृश्य", bn: "যদি-হয় পরিস্থিতি" })} icon="GitBranch">
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginBottom: 10 }}>
            {tc({ en: "Adjust % yield, price and cost for each scenario yourself — these are your own assumptions, not a prediction. Leave a scenario at 0% to match the plan as saved.",
                  hi: "हर परिदृश्य के लिए उपज, कीमत और लागत का % खुद तय करें — ये आपकी अपनी धारणाएँ हैं, कोई भविष्यवाणी नहीं। सहेजी गई योजना जैसी रखने के लिए 0% छोड़ें।",
                  bn: "প্রতিটি পরিস্থিতির জন্য ফলন, দাম ও খরচের % নিজে ঠিক করুন — এগুলি আপনার নিজের ধারণা, কোনও পূর্বাভাস নয়। সংরক্ষিত পরিকল্পনার মতো রাখতে ০% রেখে দিন।" })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {scenarioList(tc).map(({ key, label }) => {
              const adj = scenarios[key];
              const result = applyScenario(plan.computed, { yieldPct: n2(adj.yieldPct), pricePct: n2(adj.pricePct), costPct: n2(adj.costPct) });
              return (
                <Card key={key} pad={12}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>{label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <Input label={tc({ en: "Yield %", hi: "उपज %", bn: "ফলন %" })} value={adj.yieldPct} onChange={(v) => setScenarioField(key, "yieldPct", v)} type="number" inputMode="decimal" placeholder="0" />
                    <Input label={tc({ en: "Price %", hi: "कीमत %", bn: "দাম %" })} value={adj.pricePct} onChange={(v) => setScenarioField(key, "pricePct", v)} type="number" inputMode="decimal" placeholder="0" />
                    <Input label={tc({ en: "Cost %", hi: "लागत %", bn: "খরচ %" })} value={adj.costPct} onChange={(v) => setScenarioField(key, "costPct", v)} type="number" inputMode="decimal" placeholder="0" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10, fontSize: 12 }}>
                    <div><div style={{ color: T.inkSoft }}>{tc({ en: "Revenue", hi: "आय", bn: "আয়" })}</div><div style={{ fontWeight: 700 }}>{rupee(result.revenue)}</div></div>
                    <div><div style={{ color: T.inkSoft }}>{tc({ en: "Profit", hi: "लाभ", bn: "মুনাফা" })}</div><div style={{ fontWeight: 700, color: result.profit >= 0 ? T.primary : T.red }}>{rupee(result.profit)}</div></div>
                    <div><div style={{ color: T.inkSoft }}>{tc({ en: "ROI", hi: "ROI", bn: "ROI" })}</div><div style={{ fontWeight: 700 }}>{result.roiPct === null ? "—" : `${result.roiPct}%`}</div></div>
                  </div>
                </Card>
              );
            })}
          </div>
        </Section>

        <Section title={tc({ en: "Export", hi: "निर्यात", bn: "রপ্তানি" })} icon="Download">
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="outline" full onClick={() => reportService.downloadCsv(cropPlanService.buildReport(plan))} icon="FileDown">CSV</Button>
            <Button variant="outline" full onClick={() => reportService.print(cropPlanService.buildReport(plan))} icon="Printer">{tc({ en: "Print / PDF", hi: "प्रिंट / PDF", bn: "প্রিন্ট / PDF" })}</Button>
          </div>
        </Section>
      </Screen>

      <Dialog open={delOpen} onClose={() => setDelOpen(false)}
        title={tc({ en: "Delete crop plan?", hi: "फ़सल योजना हटाएँ?", bn: "ফসল পরিকল্পনা মুছবেন?" })} icon="Trash2" danger
        body={tc({ en: "This cannot be undone. Ledger entries already posted from this plan will not be removed.",
                   hi: "इसे वापस नहीं किया जा सकता। इस योजना से पहले दर्ज बहीखाता प्रविष्टियाँ नहीं हटेंगी।",
                   bn: "এটি আর ফেরানো যাবে না। এই পরিকল্পনা থেকে আগে যোগ করা খতিয়ানের এন্ট্রি মুছবে না।" })}
        confirmLabel={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })} cancelLabel={tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" })}
        onConfirm={async () => { await cropPlanService.remove(plan.id); toast(tc({ en: "Crop plan deleted", hi: "फ़सल योजना हटाई गई", bn: "ফসল পরিকল্পনা মুছে ফেলা হয়েছে" }), "info"); pop(); }} />
    </>
  );
}
