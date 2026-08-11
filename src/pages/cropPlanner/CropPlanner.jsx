/* Crop Input & Cultivation Cost Planner.
   Quick seed calculator (the original Home "Seed rate" tile) plus an
   optional "Advanced Crop Planning" section covering fertilizer, crop
   protection, organic inputs, irrigation, labour, machinery, other costs,
   yield, revenue, profit, ROI and break-even — all computed by the shared,
   unit-tested calcEngine. This is a planning/estimation tool: nothing here
   invents a rate, dose, or price — every number is either typed by the
   farmer or clearly labelled as an MSP/seasonal-band reference.

   Also doubles as the create/edit form for a saved Crop Plan — pass
   `planId` in props to load and edit an existing plan. */
import { useEffect, useMemo, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen, Card } from "../../components/index.js";
import { Input, Dropdown } from "../../components/inputs.jsx";
import { Button } from "../../components/primitives.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { AREA_UNITS, AREA_UNIT_OPTIONS, toAcres } from "../../utils/units.js";
import { computePlan } from "../../services/cropPlanner/calcEngine.js";
import { cropPlanService } from "../../services/cropPlanner/cropPlanService.js";
import { CROPS } from "../../services/market/cropData.js";
import { farmService } from "../../services/farm/farmService.js";
import { landService } from "../../services/land/landService.js";
import PlanSummary from "../../components/cropPlanner/PlanSummary.jsx";

const num = (v) => (v === "" || v === null || v === undefined ? "" : v);
const n2 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

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

/* Repeatable-row editor shared by fertilizer / protection / organic / labour / machinery / other. */
function RowEditor({ title, icon, rows, setRows, fields, addLabel }) {
  const update = (i, key, val) => {
    const next = [...rows];
    next[i] = { ...next[i], [key]: val };
    setRows(next);
  };
  const add = () => setRows([...rows, Object.fromEntries(fields.map((f) => [f.key, ""]))]);
  const remove = (i) => setRows(rows.filter((_, idx) => idx !== i));

  return (
    <Section title={title} icon={icon}>
      {rows.length === 0 && (
        <div style={{ fontSize: 12.5, color: T.inkFaint, padding: "4px 2px 8px" }}>
          No entries yet — add one below.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((row, i) => (
          <Card key={i} pad={12}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <button onClick={() => remove(i)} aria-label="Remove row"
                style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 2 }}>
                <Icon name="Trash2" size={15} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {fields.map((f) => (
                <div key={f.key} style={f.full ? { gridColumn: "1 / -1" } : undefined}>
                  <Input label={f.label} value={num(row[f.key])} onChange={(v) => update(i, f.key, v)}
                    type={f.type || "text"} inputMode={f.type === "number" ? "decimal" : undefined} prefix={f.prefix} placeholder={f.placeholder} />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <button onClick={add} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6,
        background: "none", border: `1.5px dashed ${T.line}`, borderRadius: T.rMd, padding: "10px 12px",
        width: "100%", cursor: "pointer", color: T.primary, fontFamily: T.body, fontSize: 13.5, fontWeight: 600, justifyContent: "center" }}>
        <Icon name="Plus" size={15} /> {addLabel}
      </button>
    </Section>
  );
}

export default function CropPlanner({ planId }) {
  const { pop, push, tc, toast } = useApp();
  const editing = !!planId;

  const [loaded, setLoaded] = useState(!editing);
  const [saving, setSaving] = useState(false);

  /* Farm / field */
  const [farms, setFarms] = useState([]);
  const [fields, setFields] = useState([]);
  const [farmId, setFarmId] = useState("");
  const [fieldId, setFieldId] = useState("");

  /* Crop / area */
  const [cropId, setCropId] = useState("");
  const [customCropName, setCustomCropName] = useState("");
  const [variety, setVariety] = useState("");
  const [areaValue, setAreaValue] = useState("");
  const [areaUnit, setAreaUnit] = useState("acre");

  /* Seed */
  const [seedRate, setSeedRate] = useState("");
  const [seedPrice, setSeedPrice] = useState("");
  const [seedTreatmentCost, setSeedTreatmentCost] = useState("");
  const [wastagePct, setWastagePct] = useState("");

  const [advanced, setAdvanced] = useState(editing);

  const [fertilizer, setFertilizer] = useState([]);
  const [protection, setProtection] = useState([]);
  const [organic, setOrganic] = useState([]);
  const [irrigation, setIrrigation] = useState({ numIrrigations: "", waterCostPerIrrigation: "", electricityCost: "", dieselCost: "" });
  const [labour, setLabour] = useState([]);
  const [machinery, setMachinery] = useState([]);
  const [other, setOther] = useState([]);

  const [yieldPerAcre, setYieldPerAcre] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [notes, setNotes] = useState("");

  /* Load farms once; default to the active farm. */
  useEffect(() => {
    farmService.getAll().then(setFarms);
    farmService.getActiveId() && setFarmId(farmService.getActiveId());
  }, []);

  /* Load fields whenever the selected farm changes. */
  useEffect(() => {
    if (!farmId) { setFields([]); return; }
    landService.getAll(farmId).then(setFields);
  }, [farmId]);

  /* Editing an existing plan: load it once and populate every field. */
  useEffect(() => {
    if (!editing) return;
    cropPlanService.getById(planId).then((plan) => {
      if (!plan) { toast("Crop plan not found", "error"); pop(); return; }
      setFarmId(plan.farmId || ""); setFieldId(plan.fieldId || "");
      setCropId(plan.cropId || ""); setCustomCropName(plan.cropId ? "" : (plan.cropName || ""));
      setVariety(plan.variety || "");
      setAreaValue(plan.areaValue ?? ""); setAreaUnit(plan.areaUnit || "acre");
      setSeedRate(plan.seed?.seedRate ?? ""); setSeedPrice(plan.seed?.seedPrice ?? "");
      setSeedTreatmentCost(plan.seed?.seedTreatmentCost ?? ""); setWastagePct(plan.seed?.wastagePct ?? "");
      setFertilizer(plan.fertilizer || []); setProtection(plan.protection || []); setOrganic(plan.organic || []);
      setIrrigation(plan.irrigation || { numIrrigations: "", waterCostPerIrrigation: "", electricityCost: "", dieselCost: "" });
      setLabour(plan.labour || []); setMachinery(plan.machinery || []); setOther(plan.other || []);
      setYieldPerAcre(plan.yieldPerAcre ?? ""); setSellingPrice(plan.sellingPrice ?? "");
      setNotes(plan.notes || "");
      setLoaded(true);
    });
  }, [editing, planId]);

  const field = fields.find((f) => f.id === fieldId);

  /* Selecting a field auto-fills area + current crop, matching item-3 of the
     spec ("automatically retrieve area, unit, previous crop"). Only fires on
     an actual field pick, so it never fights with manual edits afterward. */
  const onSelectField = (id) => {
    setFieldId(id);
    const f = fields.find((x) => x.id === id);
    if (!f) return;
    if (f.areaAcres) { setAreaValue(f.areaAcres); setAreaUnit("acre"); }
  };

  const crop = CROPS.find((c) => c.id === cropId);
  const cropName = crop ? crop.name : customCropName;
  const areaAcres = toAcres(n2(areaValue), areaUnit);

  const formInput = useMemo(() => ({
    farmId, fieldId, cropId, cropName, variety, season: crop?.season || "",
    areaValue: n2(areaValue), areaUnit, areaAcres,
    seed: { seedRate: n2(seedRate), seedPrice: n2(seedPrice), seedTreatmentCost: n2(seedTreatmentCost), wastagePct: n2(wastagePct) },
    fertilizer: fertilizer.map((r) => ({ ...r, rate: n2(r.rate), price: n2(r.price), applications: n2(r.applications) || 1 })),
    protection: protection.map((r) => ({ ...r, rate: n2(r.rate), price: n2(r.price), applications: n2(r.applications) || 1 })),
    organic: organic.map((r) => ({ ...r, rate: n2(r.rate), price: n2(r.price), applications: n2(r.applications) || 1 })),
    irrigation: {
      numIrrigations: n2(irrigation.numIrrigations), waterCostPerIrrigation: n2(irrigation.waterCostPerIrrigation),
      electricityCost: n2(irrigation.electricityCost), dieselCost: n2(irrigation.dieselCost),
    },
    labour: labour.map((r) => ({ ...r, workers: n2(r.workers), days: n2(r.days), wage: n2(r.wage) })),
    machinery: machinery.map((r) => ({ ...r, hours: n2(r.hours), ratePerHour: n2(r.ratePerHour), fuelCost: n2(r.fuelCost), operatorCost: n2(r.operatorCost) })),
    other: other.map((r) => ({ ...r, amount: n2(r.amount) })),
    yieldPerAcre: n2(yieldPerAcre), sellingPrice: n2(sellingPrice),
    notes,
  }), [farmId, fieldId, cropId, cropName, variety, crop, areaValue, areaUnit, areaAcres, seedRate, seedPrice, seedTreatmentCost, wastagePct,
       fertilizer, protection, organic, irrigation, labour, machinery, other, yieldPerAcre, sellingPrice, notes]);

  const plan = useMemo(() => computePlan(formInput), [formInput]);

  const cropOptions = [{ value: "", label: "Other / not listed" }, ...CROPS.map((c) => ({ value: c.id, label: c.name }))];
  const areaUnitOptions = AREA_UNIT_OPTIONS.map((u) => ({ value: u, label: tc(AREA_UNITS[u].label) }));
  const farmOptions = [{ value: "", label: "No farm selected — manual entry" }, ...farms.map((f) => ({ value: f.id, label: f.name || "Unnamed farm" }))];
  const fieldOptions = [{ value: "", label: "No field selected — manual entry" }, ...fields.map((f) => ({ value: f.id, label: f.name || "Unnamed field" }))];

  const usingMspFallback = !sellingPrice && crop && crop.msp;
  const canSave = areaAcres > 0 && (cropId || customCropName.trim());

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      if (editing) {
        await cropPlanService.update(planId, formInput);
        toast("Crop plan updated", "success");
        pop();
      } else {
        const saved = await cropPlanService.add(formInput);
        toast("Crop plan saved", "success");
        push({ kind: "cropPlanDetail", props: { id: saved.id } });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <>
        <AppBar title="Crop plan" onBack={pop} />
        <div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>Loading…</div>
      </>
    );
  }

  return (
    <>
      <AppBar title={tc({ en: editing ? "Edit crop plan" : "Crop input & cost planner", hi: editing ? "फसल योजना संपादित करें" : "फसल इनपुट व लागत योजना", bn: editing ? "ফসল পরিকল্পনা সম্পাদনা" : "ফসল ইনপুট ও খরচ পরিকল্পনা" })} onBack={pop} />
      <Screen gap={20}>

        <Section title="Farm & field (optional)" icon="Map">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Dropdown label="Farm" value={farmId} onChange={(v) => { setFarmId(v); setFieldId(""); }} options={farmOptions} />
            {farmId && <Dropdown label="Field" value={fieldId} onChange={onSelectField} options={fieldOptions} />}
            {field?.currentCrop && (
              <div style={{ fontSize: 12, color: T.inkFaint }}>Previous crop on this field: {field.currentCrop}</div>
            )}
          </div>
        </Section>

        <Section title="Crop & area" icon="Sprout">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Dropdown label="Crop" value={cropId} onChange={setCropId} options={cropOptions} />
            {!cropId && <Input label="Crop name" value={customCropName} onChange={setCustomCropName} placeholder="e.g. Cauliflower" />}
            <Input label="Variety / seed type (optional)" value={variety} onChange={setVariety} placeholder="e.g. Hybrid, Certified" />
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
              <Input label="Area" value={num(areaValue)} onChange={setAreaValue} type="number" inputMode="decimal" placeholder="0" />
              <Dropdown label="Unit" value={areaUnit} onChange={setAreaUnit} options={areaUnitOptions} />
            </div>
            {areaUnit !== "acre" && areaValue !== "" && (
              <div style={{ fontSize: 12, color: T.inkFaint }}>
                = {areaAcres.toFixed(2)} acres internally{AREA_UNITS[areaUnit].approx ? " (bigha varies by state — treat as approximate)" : ""}
              </div>
            )}
          </div>
        </Section>

        <Section title="Seed" icon="Wheat">
          <Card pad={12}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input label="Seed rate (kg / acre)" value={num(seedRate)} onChange={setSeedRate} type="number" inputMode="decimal" placeholder="e.g. 50" />
                <Input label="Seed price (₹ / kg)" value={num(seedPrice)} onChange={setSeedPrice} type="number" inputMode="decimal" prefix="₹" placeholder="e.g. 55" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input label="Wastage %" value={num(wastagePct)} onChange={setWastagePct} type="number" inputMode="decimal" placeholder="0" />
                <Input label="Seed treatment cost (₹)" value={num(seedTreatmentCost)} onChange={setSeedTreatmentCost} type="number" inputMode="decimal" prefix="₹" placeholder="0" />
              </div>
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
              <div style={{ fontSize: 11.5, color: T.inkSoft }}>Seed required (final)</div>
              <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, marginTop: 2 }}>{plan.seed.finalRequiredKg.toLocaleString("en-IN")} kg</div>
              {plan.seed.wastageKg > 0 && <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2 }}>incl. {plan.seed.wastageKg} kg wastage</div>}
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
              <div style={{ fontSize: 11.5, color: T.inkSoft }}>Total seed cost</div>
              <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: T.primary, marginTop: 2 }}>₹{plan.seed.totalSeedCost.toLocaleString("en-IN")}</div>
            </div>
          </div>
        </Section>

        <button onClick={() => setAdvanced((v) => !v)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
            background: T.surface2, border: "none", borderRadius: T.rMd, padding: "13px 14px", cursor: "pointer" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: T.ink }}>
            <Icon name="SlidersHorizontal" size={16} /> Advanced Crop Planning
          </span>
          <Icon name={advanced ? "ChevronUp" : "ChevronDown"} size={18} style={{ color: T.inkSoft }} />
        </button>

        {advanced && (
          <>
            <RowEditor title="Fertilizer" icon="Leaf" rows={fertilizer} setRows={setFertilizer}
              addLabel="Add fertilizer"
              fields={[
                { key: "name", label: "Product (e.g. Urea, DAP)", full: true },
                { key: "rate", label: "Rate (kg or L / acre / app)", type: "number" },
                { key: "applications", label: "No. of applications", type: "number", placeholder: "1" },
                { key: "price", label: "Price (₹ / kg or L)", type: "number", prefix: "₹" },
              ]} />

            <RowEditor title="Crop protection" icon="ShieldCheck" rows={protection} setRows={setProtection}
              addLabel="Add pesticide / fungicide"
              fields={[
                { key: "product", label: "Product", full: true },
                { key: "rate", label: "Rate (per acre / app)", type: "number" },
                { key: "applications", label: "No. of applications", type: "number", placeholder: "1" },
                { key: "price", label: "Price (₹ / unit)", type: "number", prefix: "₹" },
              ]} />

            <RowEditor title="Organic inputs" icon="Leaf" rows={organic} setRows={setOrganic}
              addLabel="Add organic input"
              fields={[
                { key: "name", label: "Input (e.g. Vermicompost)", full: true },
                { key: "rate", label: "Rate (kg / acre / app)", type: "number" },
                { key: "applications", label: "No. of applications", type: "number", placeholder: "1" },
                { key: "price", label: "Price (₹ / kg)", type: "number", prefix: "₹" },
              ]} />

            <Section title="Irrigation" icon="Droplets">
              <Card pad={12}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Input label="No. of irrigations" value={num(irrigation.numIrrigations)} onChange={(v) => setIrrigation((s) => ({ ...s, numIrrigations: v }))} type="number" inputMode="decimal" />
                    <Input label="Cost per irrigation (₹)" value={num(irrigation.waterCostPerIrrigation)} onChange={(v) => setIrrigation((s) => ({ ...s, waterCostPerIrrigation: v }))} type="number" inputMode="decimal" prefix="₹" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Input label="Electricity / pump (₹)" value={num(irrigation.electricityCost)} onChange={(v) => setIrrigation((s) => ({ ...s, electricityCost: v }))} type="number" inputMode="decimal" prefix="₹" />
                    <Input label="Diesel (₹)" value={num(irrigation.dieselCost)} onChange={(v) => setIrrigation((s) => ({ ...s, dieselCost: v }))} type="number" inputMode="decimal" prefix="₹" />
                  </div>
                </div>
              </Card>
            </Section>

            <RowEditor title="Labour" icon="Users" rows={labour} setRows={setLabour}
              addLabel="Add labour entry"
              fields={[
                { key: "type", label: "Activity (e.g. Weeding, Sowing)", full: true },
                { key: "workers", label: "Workers", type: "number" },
                { key: "days", label: "Days", type: "number" },
                { key: "wage", label: "Daily wage (₹)", type: "number", prefix: "₹" },
              ]} />

            <RowEditor title="Machinery" icon="Tractor" rows={machinery} setRows={setMachinery}
              addLabel="Add machine"
              fields={[
                { key: "machine", label: "Machine (e.g. Tractor)", full: true },
                { key: "hours", label: "Hours", type: "number" },
                { key: "ratePerHour", label: "Rate / hour (₹)", type: "number", prefix: "₹" },
                { key: "fuelCost", label: "Fuel cost (₹)", type: "number", prefix: "₹" },
                { key: "operatorCost", label: "Operator cost (₹)", type: "number", prefix: "₹" },
              ]} />

            <RowEditor title="Other costs" icon="Receipt" rows={other} setRows={setOther}
              addLabel="Add other cost"
              fields={[
                { key: "label", label: "Description (e.g. Transport, Packaging)", full: true },
                { key: "amount", label: "Amount (₹)", type: "number", prefix: "₹" },
              ]} />

            <Section title="Yield & expected selling price" icon="BarChart3">
              <Card pad={12}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Input label="Expected yield (qty / acre) — planning estimate" value={num(yieldPerAcre)} onChange={setYieldPerAcre} type="number" inputMode="decimal" placeholder="Not a guaranteed figure" />
                  <Input label="Expected selling price (₹ / qty unit)" value={num(sellingPrice)} onChange={setSellingPrice} type="number" inputMode="decimal" prefix="₹"
                    placeholder={crop && crop.msp ? `MSP reference: ₹${crop.msp}/qtl` : "Data unavailable — enter your own value"} />
                  {usingMspFallback && (
                    <div style={{ fontSize: 11.5, color: T.inkFaint, display: "flex", gap: 6 }}>
                      <Icon name="Info" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      No price entered yet, so revenue/profit below show as zero. Government MSP for {crop.name} is ₹{crop.msp}/quintal — a reference, not a guaranteed selling price.
                    </div>
                  )}
                </div>
              </Card>
            </Section>

            <Section title="Notes" icon="FileText">
              <Input value={notes} onChange={setNotes} placeholder="Optional notes about this plan" />
            </Section>
          </>
        )}

        <PlanSummary plan={plan} showProfitability={n2(yieldPerAcre) > 0 || n2(sellingPrice) > 0} />

        <Button full onClick={save} disabled={!canSave || saving} icon="Save">
          {saving ? "Saving…" : editing ? "Update crop plan" : "Save crop plan"}
        </Button>
        {!canSave && <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center" }}>Enter a crop name and area to save.</div>}

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          This is a planning and estimation tool. Rates, doses, yields, and prices are what you enter — verify locally before purchase or sale.
        </div>
      </Screen>
    </>
  );
}
