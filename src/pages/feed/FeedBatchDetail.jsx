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
  const { pop, toast } = useApp();
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
    return (<><AppBar title="Feed batch" onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>Loading…</div></>);
  }

  const { batch } = summary;
  const perf = PERF_LABEL[summary.performanceStatus] || PERF_LABEL.no_target;
  const feedItemOptions = [{ value: "", label: "Not linked to inventory" }, ...feedItems.map((i) => ({ value: i.id, label: `${i.name} (${i.qty} ${i.unit || "kg"} in stock)` }))];

  const onSelectFeedItem = (setForm) => (id2) => setForm((f) => ({ ...f, feedItemId: id2, unitPrice: feedItems.find((i) => i.id === id2)?.unitPrice ?? f.unitPrice }));

  const useSensorReading = (reading) => {
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
    toast("Consumption logged", "success");
  };

  const saveWastage = async () => {
    if (!wasteForm.quantity) return;
    await feedWastageService.log({ ...wasteForm, farmId: batch.farmId, batchId: id, quantity: Number(wasteForm.quantity), unitPrice: Number(wasteForm.unitPrice) || 0, feedItemId: wasteForm.feedItemId || null });
    setWasteOpen(false);
    setWasteForm({ date: new Date().toISOString().slice(0, 10), feedItemId: "", quantity: "", reason: "spillage", unitPrice: "" });
    refresh(); feedInventory.getAll().then(setFeedItems);
    toast("Wastage logged", "success");
  };

  const saveUpdate = async () => {
    await feedBatchService.update(id, { currentCount: Number(updateForm.currentCount) || null, currentWeight: Number(updateForm.currentWeight) || null });
    setUpdateOpen(false);
    refresh();
    toast("Batch updated", "success");
  };

  return (
    <>
      <AppBar title={batch.label || "Feed batch"} onBack={pop} action={
        <button onClick={() => setDelOpen(true)} aria-label="Delete"
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
                {LIVESTOCK_TYPES.find((t) => t.id === batch.enterprise)?.label || batch.enterprise} · {batch.status} · since {batch.startDate || "—"}
              </div>
            </div>
            <button onClick={() => setUpdateOpen(true)}
              style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "6px 10px", cursor: "pointer", color: T.ink, fontFamily: T.body, fontSize: 12, fontWeight: 600 }}>
              Update count/weight
            </button>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12.5, color: T.inkSoft }}>
            <span>Initial: {batch.initialCount || 0} @ {batch.initialWeight || 0} kg</span>
            <span>Current: {batch.currentCount ?? batch.initialCount ?? 0} @ {batch.currentWeight ?? "—"} kg</span>
          </div>
        </Card>

        <Section title="FCR" icon="Gauge">
          <Card pad={14}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, color: T.inkSoft }}>Current FCR</span>
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
          <Section title={insights.kind === "dairy" ? "Dairy insights" : insights.kind === "poultry" ? "Poultry insights" : "Fish insights"} icon="Sparkles">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {insights.kind === "dairy" && (<>
                <StatBox label="Milk yield" value={`${insights.milkYield.toLocaleString("en-IN")} L`} />
                <StatBox label="Cost / litre milk" value={insights.costPerLitre === null ? "—" : rupee(insights.costPerLitre)} fg={T.primary} />
              </>)}
              {insights.kind === "poultry" && (<>
                <StatBox label="Eggs" value={insights.eggs.toLocaleString("en-IN")} />
                <StatBox label="Cost / egg" value={insights.costPerEgg === null ? "—" : rupee(insights.costPerEgg)} fg={T.primary} />
                <StatBox label="Mortality" value={insights.mortality.toLocaleString("en-IN")} />
              </>)}
              {insights.kind === "fish" && (<>
                <StatBox label="Biomass" value={`${insights.biomass.toLocaleString("en-IN")} kg`} />
                <StatBox label="Mortality" value={insights.mortality.toLocaleString("en-IN")} />
                <StatBox label="Latest water quality" value={insights.waterQuality || "—"} />
              </>)}
            </div>
          </Section>
        )}

        <Section title="Feed cost summary" icon="Calculator">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <StatBox label="Total feed" value={`${summary.totalFeed.toLocaleString("en-IN")} kg`} />
            <StatBox label="Total feed cost" value={rupee(summary.totalFeedCost)} fg={T.primary} />
            <StatBox label="Avg daily feed" value={`${summary.averageDailyFeed.toLocaleString("en-IN")} kg`} />
            <StatBox label="Cost / animal" value={rupee(summary.feedCostPerAnimal)} />
            <StatBox label="Cost / kg gain" value={summary.feedCostPerKgGain === null ? "—" : rupee(summary.feedCostPerKgGain)} />
            <StatBox label="Feed efficiency" value={summary.feedEfficiency === null ? "—" : `${summary.feedEfficiency}%`} sub="biomass gained per unit feed" />
          </div>
        </Section>

        {wastage && (
          <Section title="Wastage" icon="AlertTriangle">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatBox label="Total wastage" value={`${wastage.totalWastageQty.toLocaleString("en-IN")} kg`} />
              <StatBox label="Wastage %" value={`${wastage.wastagePct}%`} fg={wastage.wastagePct > 5 ? T.red : T.ink} />
            </div>
            <Button variant="outline" full style={{ marginTop: 10 }} onClick={() => setWasteOpen(true)} icon="Plus">Log wastage</Button>
          </Section>
        )}

        <Section title="Consumption log" icon="ClipboardList">
          <Button full onClick={() => setConsOpen(true)} icon="Plus" style={{ marginBottom: 10 }}>Add consumption</Button>
          {entries.length === 0 ? (
            <EmptyHint icon="ClipboardList" text="No feed logged yet for this batch." />
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

      <BottomSheet open={consOpen} onClose={() => setConsOpen(false)} title="Add Feed Consumption">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sensors.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>Sensor readings</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sensors.map((r) => (
                  <button key={r.device.id} onClick={() => useSensorReading(r)} disabled={!r.latest}
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
          <Input label="Date" type="date" value={consForm.date} onChange={(v) => setConsForm((f) => ({ ...f, date: v }))} />
          <Dropdown label="Feed item (optional)" value={consForm.feedItemId} onChange={onSelectFeedItem(setConsForm)} options={feedItemOptions} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Quantity used (kg)" type="number" value={consForm.quantityUsed} onChange={(v) => setConsForm((f) => ({ ...f, quantityUsed: v }))} />
            <Input label="Unit price (₹/kg)" type="number" value={consForm.unitPrice} onChange={(v) => setConsForm((f) => ({ ...f, unitPrice: v }))} prefix="₹" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Animal count (optional)" type="number" value={consForm.animalCount} onChange={(v) => setConsForm((f) => ({ ...f, animalCount: v }))} placeholder={String(batch.currentCount ?? batch.initialCount ?? "")} />
            <Input label="Avg weight, kg (optional)" type="number" value={consForm.avgWeight} onChange={(v) => setConsForm((f) => ({ ...f, avgWeight: v }))} placeholder={String(batch.currentWeight ?? "")} />
          </div>
          <Input label="Notes (optional)" value={consForm.notes} onChange={(v) => setConsForm((f) => ({ ...f, notes: v }))} />
          <Button full onClick={saveConsumption} disabled={!consForm.quantityUsed}>Save consumption</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={wasteOpen} onClose={() => setWasteOpen(false)} title="Log Feed Wastage">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Date" type="date" value={wasteForm.date} onChange={(v) => setWasteForm((f) => ({ ...f, date: v }))} />
          <Dropdown label="Feed item (optional)" value={wasteForm.feedItemId} onChange={onSelectFeedItem(setWasteForm)} options={feedItemOptions} />
          <Dropdown label="Reason" value={wasteForm.reason} onChange={(v) => setWasteForm((f) => ({ ...f, reason: v }))} options={WASTAGE_REASONS.map((r) => ({ value: r.id, label: r.label }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Quantity (kg)" type="number" value={wasteForm.quantity} onChange={(v) => setWasteForm((f) => ({ ...f, quantity: v }))} />
            <Input label="Unit price (₹/kg)" type="number" value={wasteForm.unitPrice} onChange={(v) => setWasteForm((f) => ({ ...f, unitPrice: v }))} prefix="₹" />
          </div>
          <Button full onClick={saveWastage} disabled={!wasteForm.quantity}>Save wastage</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={updateOpen} onClose={() => setUpdateOpen(false)} title="Update Current Count / Weight">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Current count" type="number" value={updateForm.currentCount} onChange={(v) => setUpdateForm((f) => ({ ...f, currentCount: v }))} />
          <Input label="Current avg weight (kg)" type="number" value={updateForm.currentWeight} onChange={(v) => setUpdateForm((f) => ({ ...f, currentWeight: v }))} />
          <Button full onClick={saveUpdate}>Save</Button>
        </div>
      </BottomSheet>

      <Dialog open={delOpen} onClose={() => setDelOpen(false)}
        title="Delete this batch?" icon="Trash2" danger
        body="Consumption and wastage logs for this batch will remain but won't be linked to a batch anymore."
        confirmLabel="Delete" cancelLabel="Cancel"
        onConfirm={async () => { await feedBatchService.remove(id); toast("Batch deleted", "info"); pop(); }} />
    </>
  );
}
