import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen, Card } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { Button } from "../../components/primitives.jsx";
import { RecordRow, EmptyHint } from "../../components/erp/RecordList.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { feedBatchService } from "../../services/feed/feedBatchService.js";
import { feedConsumptionService } from "../../services/feed/feedConsumptionService.js";
import { feedWastageService, WASTAGE_REASONS } from "../../services/feed/feedWastageService.js";
import { feedInventory, LIVESTOCK_TYPES } from "../../services/feed/feedService.js";
import { latestFeedReadings } from "../../services/feed/feedIotService.js";
import { rupee } from "../../utils/format.js";

function StatBox({ label, value, sub, fg }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: fg || T.ink, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
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

const PERF_LABEL = {
  no_target: { label: "No target set", fg: T.inkSoft, bg: T.surface2 },
  on_or_better_than_target: { label: "On / better than target", fg: T.primary, bg: T.primarySoft },
  worse_than_target: { label: "Worse than target", fg: T.red, bg: T.redSoft },
};

export default function FeedBatchDetail({ id }) {
  const { pop, toast, tc } = useApp();
  const [summary, setSummary] = useState(null);
  const [wastage, setWastage] = useState(null);
  const [entries, setEntries] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [insights, setInsights] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [consOpen, setConsOpen] = useState(false);
  const [wasteOpen, setWasteOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const [consForm, setConsForm] = useState({ date: new Date().toISOString().slice(0, 10), feedItemId: "", quantityUsed: "", unitPrice: "", animalCount: "", avgWeight: "", notes: "" });
  const [wasteForm, setWasteForm] = useState({ date: new Date().toISOString().slice(0, 10), feedItemId: "", quantity: "", reason: "spillage", unitPrice: "" });
  const [updateForm, setUpdateForm] = useState({ currentCount: "", currentWeight: "" });

  const refresh = async () => {
    const s = await feedBatchService.summary(id);
    setSummary(s);
    if (s) {
      setWastage(await feedWastageService.summaryForBatch(id));
      setEntries(await feedConsumptionService.forBatch(id));
      setInsights(await feedBatchService.speciesInsights(id));
      setUpdateForm({ currentCount: s.batch.currentCount ?? s.batch.initialCount ?? "", currentWeight: s.batch.currentWeight ?? "" });
    }
  };
  useEffect(() => {
    refresh();
    feedInventory.getAll().then(setFeedItems);
    latestFeedReadings().then(setSensors);
  }, [id]);

  if (!summary) {
    return (<><AppBar title={tc({ en: "Feed batch", hi: "चारा बैच", bn: "খাদ্য ব্যাচ" })} onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>{tc({ en: "Loading…", hi: "लोड हो रहा है…", bn: "লোড হচ্ছে…" })}</div></>);
  }

  const { batch } = summary;
  const perf = PERF_LABEL[summary.performanceStatus] || PERF_LABEL.no_target;
  const feedItemOptions = [{ value: "", label: "Not linked to inventory" }, ...feedItems.map((i) => ({ value: i.id, label: `${i.name} (${i.qty} ${i.unit || "kg"} in stock)` }))];

  const onSelectFeedItem = (setForm) => (id2) => setForm((f) => ({ ...f, feedItemId: id2, unitPrice: feedItems.find((i) => i.id === id2)?.unitPrice ?? f.unitPrice }));

  const applySensorReading = (reading) => {
    if (!reading.latest) return;
    if (reading.device.type === "feed") setConsForm((f) => ({ ...f, quantityUsed: String(reading.latest.value) }));
    else if (reading.device.type === "weight") setConsForm((f) => ({ ...f, avgWeight: String(reading.latest.value) }));
  };

  const saveConsumption = async () => {
    if (!consForm.quantityUsed) return;
    await feedConsumptionService.log({
      ...consForm, farmId: batch.farmId, batchId: id, enterprise: batch.enterprise,
      quantityUsed: Number(consForm.quantityUsed), unitPrice: Number(consForm.unitPrice) || 0,
      animalCount: Number(consForm.animalCount) || batch.currentCount || batch.initialCount,
      avgWeight: Number(consForm.avgWeight) || batch.currentWeight || 0,
      feedItemId: consForm.feedItemId || null,
    });
    setConsOpen(false);
    setConsForm({ date: new Date().toISOString().slice(0, 10), feedItemId: "", quantityUsed: "", unitPrice: "", animalCount: "", avgWeight: "", notes: "" });
    refresh(); feedInventory.getAll().then(setFeedItems);
    toast(tc({ en: "Consumption logged", hi: "खपत दर्ज हुई", bn: "ব্যবহার লেখা হয়েছে" }), "success");
  };

  const saveWastage = async () => {
    if (!wasteForm.quantity) return;
    await feedWastageService.log({ ...wasteForm, farmId: batch.farmId, batchId: id, quantity: Number(wasteForm.quantity), unitPrice: Number(wasteForm.unitPrice) || 0, feedItemId: wasteForm.feedItemId || null });
    setWasteOpen(false);
    setWasteForm({ date: new Date().toISOString().slice(0, 10), feedItemId: "", quantity: "", reason: "spillage", unitPrice: "" });
    refresh(); feedInventory.getAll().then(setFeedItems);
    toast(tc({ en: "Wastage logged", hi: "बर्बादी दर्ज हुई", bn: "অপচয় লেখা হয়েছে" }), "success");
  };

  const saveUpdate = async () => {
    await feedBatchService.update(id, { currentCount: Number(updateForm.currentCount) || null, currentWeight: Number(updateForm.currentWeight) || null });
    setUpdateOpen(false);
    refresh();
    toast(tc({ en: "Batch updated", hi: "बैच अपडेट हुआ", bn: "ব্যাচ হালনাগাদ হয়েছে" }), "success");
  };

  return (
    <>
      <AppBar title={batch.label || "Feed batch"} onBack={pop} action={
        <button onClick={() => setDelOpen(true)} aria-label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
          style={{ background: T.redSoft, border: "none", borderRadius: 12, padding: 8, cursor: "pointer", color: T.red, display: "flex" }}>
          <Icon name="Trash2" size={16} />
        </button>
      } />
      <Screen gap={18}>
        <Card pad={14}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700 }}>{batch.label}</div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3 }}>
                {(() => { const lt = LIVESTOCK_TYPES.find((t) => t.id === batch.enterprise); return lt?.i18n ? tc(lt.i18n) : (lt?.label || batch.enterprise); })()} · {batch.status} · {tc({ en: "since", hi: "से", bn: "থেকে" })} {batch.startDate || "—"}
              </div>
            </div>
            <button onClick={() => setUpdateOpen(true)}
              style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "6px 10px", cursor: "pointer", color: T.ink, fontFamily: T.body, fontSize: 12, fontWeight: 600 }}>
              {tc({ en: "Update count/weight", hi: "संख्या/वज़न अपडेट करें", bn: "সংখ্যা/ওজন হালনাগাদ" })}
            </button>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12.5, color: T.inkSoft }}>
            <span>{tc({ en: "Initial", hi: "प्रारंभिक", bn: "প্রাথমিক" })}: {batch.initialCount || 0} @ {batch.initialWeight || 0} kg</span>
            <span>{tc({ en: "Current", hi: "वर्तमान", bn: "বর্তমান" })}: {batch.currentCount ?? batch.initialCount ?? 0} @ {batch.currentWeight ?? "—"} kg</span>
          </div>
        </Card>

        <Section title="FCR" icon="Gauge">
          <Card pad={14}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, color: T.inkSoft }}>{tc({ en: "Current FCR", hi: "वर्तमान FCR", bn: "বর্তমান FCR" })}</span>
              <span style={{ fontFamily: T.display, fontSize: 24, fontWeight: 800, color: T.primary }}>{summary.fcr === null ? "—" : summary.fcr}</span>
            </div>
            {summary.targetFCR !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: T.inkSoft, marginTop: 4 }}>
                <span>Target: {summary.targetFCR}</span>
                <span>Diff: {summary.fcrDiff > 0 ? "+" : ""}{summary.fcrDiff}</span>
              </div>
            )}
            <div style={{ marginTop: 8, display: "inline-flex", fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 7, color: perf.fg, background: perf.bg }}>
              {perf.label}
            </div>
          </Card>
        </Section>

        {insights && (
          <Section title={insights.kind === "dairy" ? tc({ en: "Dairy insights", hi: "डेयरी जानकारी", bn: "ডেয়ারি তথ্য" }) : insights.kind === "poultry" ? tc({ en: "Poultry insights", hi: "मुर्गी जानकारी", bn: "হাঁস-মুরগির তথ্য" }) : tc({ en: "Fish insights", hi: "मछली जानकारी", bn: "মাছের তথ্য" })} icon="Sparkles">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {insights.kind === "dairy" && (<>
                <StatBox label={tc({ en: "Milk yield", hi: "दूध उपज", bn: "দুধের ফলন" })} value={`${insights.milkYield.toLocaleString("en-IN")} L`} />
                <StatBox label={tc({ en: "Cost / litre milk", hi: "प्रति लीटर दूध लागत", bn: "প্রতি লিটার দুধের ব্যয়" })} value={insights.costPerLitre === null ? "—" : rupee(insights.costPerLitre)} fg={T.primary} />
              </>)}
              {insights.kind === "poultry" && (<>
                <StatBox label={tc({ en: "Eggs", hi: "अंडे", bn: "ডিম" })} value={insights.eggs.toLocaleString("en-IN")} />
                <StatBox label={tc({ en: "Cost / egg", hi: "प्रति अंडा लागत", bn: "প্রতি ডিমের ব্যয়" })} value={insights.costPerEgg === null ? "—" : rupee(insights.costPerEgg)} fg={T.primary} />
                <StatBox label={tc({ en: "Mortality", hi: "मृत्यु", bn: "মৃত্যু" })} value={insights.mortality.toLocaleString("en-IN")} />
              </>)}
              {insights.kind === "fish" && (<>
                <StatBox label={tc({ en: "Biomass", hi: "जैवभार", bn: "বায়োমাস" })} value={`${insights.biomass.toLocaleString("en-IN")} kg`} />
                <StatBox label={tc({ en: "Mortality", hi: "मृत्यु", bn: "মৃত্যু" })} value={insights.mortality.toLocaleString("en-IN")} />
                <StatBox label={tc({ en: "Latest water quality", hi: "नवीनतम जल गुणवत्ता", bn: "সর্বশেষ জলের গুণমান" })} value={insights.waterQuality || "—"} />
              </>)}
            </div>
          </Section>
        )}

        <Section title={tc({ en: "Feed cost summary", hi: "चारा लागत सारांश", bn: "খাদ্য ব্যয়ের সারসংক্ষেপ" })} icon="Calculator">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <StatBox label={tc({ en: "Total feed", hi: "कुल चारा", bn: "মোট খাদ্য" })} value={`${summary.totalFeed.toLocaleString("en-IN")} kg`} />
            <StatBox label={tc({ en: "Total feed cost", hi: "कुल चारा लागत", bn: "মোট খাদ্য ব্যয়" })} value={rupee(summary.totalFeedCost)} fg={T.primary} />
            <StatBox label={tc({ en: "Avg daily feed", hi: "औसत दैनिक चारा", bn: "গড় দৈনিক খাদ্য" })} value={`${summary.averageDailyFeed.toLocaleString("en-IN")} kg`} />
            <StatBox label={tc({ en: "Cost / animal", hi: "प्रति पशु लागत", bn: "প্রতি প্রাণীর ব্যয়" })} value={rupee(summary.feedCostPerAnimal)} />
            <StatBox label={tc({ en: "Cost / kg gain", hi: "प्रति किग्रा वृद्धि लागत", bn: "প্রতি কেজি বৃদ্ধির ব্যয়" })} value={summary.feedCostPerKgGain === null ? "—" : rupee(summary.feedCostPerKgGain)} />
            <StatBox label={tc({ en: "Feed efficiency", hi: "चारा दक्षता", bn: "খাদ্য দক্ষতা" })} value={summary.feedEfficiency === null ? "—" : `${summary.feedEfficiency}%`} sub={tc({ en: "biomass gained per unit feed", hi: "प्रति इकाई चारा से जैवभार वृद्धि", bn: "প্রতি একক খাদ্যে বায়োমাস বৃদ্ধি" })} />
          </div>
        </Section>

        {wastage && (
          <Section title={tc({ en: "Wastage", hi: "बर्बादी", bn: "অপচয়" })} icon="AlertTriangle">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatBox label={tc({ en: "Total wastage", hi: "कुल बर्बादी", bn: "মোট অপচয়" })} value={`${wastage.totalWastageQty.toLocaleString("en-IN")} kg`} />
              <StatBox label={tc({ en: "Wastage %", hi: "बर्बादी %", bn: "অপচয় %" })} value={`${wastage.wastagePct}%`} fg={wastage.wastagePct > 5 ? T.red : T.ink} />
            </div>
            <Button variant="outline" full style={{ marginTop: 10 }} onClick={() => setWasteOpen(true)} icon="Plus">{tc({ en: "Log wastage", hi: "बर्बादी दर्ज करें", bn: "অপচয় লিখুন" })}</Button>
          </Section>
        )}

        <Section title={tc({ en: "Consumption log", hi: "खपत लॉग", bn: "ব্যবহারের লগ" })} icon="ClipboardList">
          <Button full onClick={() => setConsOpen(true)} icon="Plus" style={{ marginBottom: 10 }}>{tc({ en: "Add consumption", hi: "खपत जोड़ें", bn: "ব্যবহার যোগ করুন" })}</Button>
          {entries.length === 0 ? (
            <EmptyHint icon="ClipboardList" text={tc({ en: "No feed logged yet for this batch.", hi: "इस बैच के लिए अभी कोई चारा दर्ज नहीं।", bn: "এই ব্যাচের জন্য এখনও কোনও খাদ্য লেখা হয়নি।" })} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {entries.map((e) => (
                <RecordRow key={e.id} icon="Package" iconColor={T.orange} iconBg={T.orangeSoft}
                  title={`${e.quantityUsed.toLocaleString("en-IN")} kg`}
                  subtitle={`${e.date} · ${rupee(e.totalCost)}${e.notes ? ` · ${e.notes}` : ""}`}
                  onDelete={async () => { await feedConsumptionService.remove(e.id); refresh(); }} />
              ))}
            </div>
          )}
        </Section>
      </Screen>

      <BottomSheet open={consOpen} onClose={() => setConsOpen(false)} title={tc({ en: "Add Feed Consumption", hi: "चारा खपत जोड़ें", bn: "খাদ্য ব্যবহার যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sensors.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>{tc({ en: "Sensor readings", hi: "सेंसर रीडिंग", bn: "সেন্সর রিডিং" })}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sensors.map((r) => (
                  <button key={r.device.id} onClick={() => applySensorReading(r)} disabled={!r.latest}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                      background: T.surface2, border: "none", borderRadius: T.rMd, padding: "8px 12px",
                      cursor: r.latest ? "pointer" : "default", opacity: r.latest ? 1 : .5 }}>
                    <span style={{ fontSize: 12.5, color: T.ink }}>{r.device.name} ({r.device.type})</span>
                    <span style={{ fontSize: 12, color: T.inkSoft }}>{r.latest ? `${r.latest.value} — tap to use` : "no reading yet"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={consForm.date} onChange={(v) => setConsForm((f) => ({ ...f, date: v }))} />
          <Dropdown label={tc({ en: "Feed item (optional)", hi: "चारा मद (वैकल्पिक)", bn: "খাদ্য আইটেম (ঐচ্ছিক)" })} value={consForm.feedItemId} onChange={onSelectFeedItem(setConsForm)} options={feedItemOptions} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Quantity used (kg)", hi: "उपयोग मात्रा (किग्रा)", bn: "ব্যবহৃত পরিমাণ (কেজি)" })} type="number" value={consForm.quantityUsed} onChange={(v) => setConsForm((f) => ({ ...f, quantityUsed: v }))} />
            <Input label={tc({ en: "Unit price (₹/kg)", hi: "इकाई मूल्य (₹/किग्रा)", bn: "একক মূল্য (₹/কেজি)" })} type="number" value={consForm.unitPrice} onChange={(v) => setConsForm((f) => ({ ...f, unitPrice: v }))} prefix="₹" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Animal count (optional)", hi: "पशु संख्या (वैकल्पिक)", bn: "প্রাণীর সংখ্যা (ঐচ্ছিক)" })} type="number" value={consForm.animalCount} onChange={(v) => setConsForm((f) => ({ ...f, animalCount: v }))} placeholder={String(batch.currentCount ?? batch.initialCount ?? "")} />
            <Input label={tc({ en: "Avg weight, kg (optional)", hi: "औसत वज़न, किग्रा (वैकल्पिक)", bn: "গড় ওজন, কেজি (ঐচ্ছিক)" })} type="number" value={consForm.avgWeight} onChange={(v) => setConsForm((f) => ({ ...f, avgWeight: v }))} placeholder={String(batch.currentWeight ?? "")} />
          </div>
          <Input label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })} value={consForm.notes} onChange={(v) => setConsForm((f) => ({ ...f, notes: v }))} />
          <Button full onClick={saveConsumption} disabled={!consForm.quantityUsed}>{tc({ en: "Save consumption", hi: "खपत सहेजें", bn: "ব্যবহার সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={wasteOpen} onClose={() => setWasteOpen(false)} title={tc({ en: "Log Feed Wastage", hi: "चारा बर्बादी दर्ज करें", bn: "খাদ্য অপচয় লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date" value={wasteForm.date} onChange={(v) => setWasteForm((f) => ({ ...f, date: v }))} />
          <Dropdown label={tc({ en: "Feed item (optional)", hi: "चारा मद (वैकल्पिक)", bn: "খাদ্য আইটেম (ঐচ্ছিক)" })} value={wasteForm.feedItemId} onChange={onSelectFeedItem(setWasteForm)} options={feedItemOptions} />
          <Dropdown label={tc({ en: "Reason", hi: "कारण", bn: "কারণ" })} value={wasteForm.reason} onChange={(v) => setWasteForm((f) => ({ ...f, reason: v }))} options={WASTAGE_REASONS.map((r) => ({ value: r.id, label: r.i18n ? tc(r.i18n) : r.label }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Quantity (kg)", hi: "मात्रा (किग्रा)", bn: "পরিমাণ (কেজি)" })} type="number" value={wasteForm.quantity} onChange={(v) => setWasteForm((f) => ({ ...f, quantity: v }))} />
            <Input label={tc({ en: "Unit price (₹/kg)", hi: "इकाई मूल्य (₹/किग्रा)", bn: "একক মূল্য (₹/কেজি)" })} type="number" value={wasteForm.unitPrice} onChange={(v) => setWasteForm((f) => ({ ...f, unitPrice: v }))} prefix="₹" />
          </div>
          <Button full onClick={saveWastage} disabled={!wasteForm.quantity}>{tc({ en: "Save wastage", hi: "बर्बादी सहेजें", bn: "অপচয় সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={updateOpen} onClose={() => setUpdateOpen(false)} title={tc({ en: "Update Current Count / Weight", hi: "वर्तमान संख्या / वज़न अपडेट करें", bn: "বর্তমান সংখ্যা / ওজন হালনাগাদ" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Current count", hi: "वर्तमान संख्या", bn: "বর্তমান সংখ্যা" })} type="number" value={updateForm.currentCount} onChange={(v) => setUpdateForm((f) => ({ ...f, currentCount: v }))} />
          <Input label={tc({ en: "Current avg weight (kg)", hi: "वर्तमान औसत वज़न (किग्रा)", bn: "বর্তমান গড় ওজন (কেজি)" })} type="number" value={updateForm.currentWeight} onChange={(v) => setUpdateForm((f) => ({ ...f, currentWeight: v }))} />
          <Button full onClick={saveUpdate}>Save</Button>
        </div>
      </BottomSheet>

      <Dialog open={delOpen} onClose={() => setDelOpen(false)}
        title={tc({ en: "Delete this batch?", hi: "यह बैच हटाएँ?", bn: "এই ব্যাচ মুছবেন?" })} icon="Trash2" danger
        body={tc({ en: "Consumption and wastage logs for this batch will remain but won't be linked to a batch anymore.",
                 hi: "इस बैच के खपत और बर्बादी के रिकॉर्ड बने रहेंगे, पर किसी बैच से नहीं जुड़े होंगे।",
                 bn: "এই ব্যাচের ব্যবহার ও অপচয়ের রেকর্ড থাকবে, তবে আর কোনও ব্যাচের সঙ্গে যুক্ত থাকবে না।" })}
        confirmLabel="Delete" cancelLabel="Cancel"
        onConfirm={async () => { await feedBatchService.remove(id); toast(tc({ en: "Batch deleted", hi: "बैच हटाया गया", bn: "ব্যাচ মুছে ফেলা হয়েছে" }), "info"); pop(); }} />
    </>
  );
}
