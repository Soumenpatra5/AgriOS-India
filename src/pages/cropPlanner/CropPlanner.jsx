/* Crop Input & Cultivation Cost Planner.
   Phase 1: quick seed calculator (the original Home "Seed rate" tile) plus
   an optional "Advanced Crop Planning" section covering fertilizer, crop
   protection, organic inputs, irrigation, labour, machinery, other costs,
   yield, revenue, profit, ROI and break-even — all computed by the shared,
   unit-tested calcEngine. This is a planning/estimation tool: nothing here
   invents a rate, dose, or price — every number is either typed by the
   farmer or clearly labelled as an MSP/seasonal-band reference.

   Saving a plan, comparing plans, and inventory/ledger integration land in
   a later phase — this screen is calculation-only for now. */
import { useMemo, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Screen, Card } from "../../components/index.js";
import { Input, Dropdown } from "../../components/inputs.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { AREA_UNITS, AREA_UNIT_OPTIONS, toAcres } from "../../utils/units.js";
import { computePlan } from "../../services/cropPlanner/calcEngine.js";
import { CROPS } from "../../services/market/cropData.js";
import { rupee } from "../../utils/format.js";

const num = (v) => (v === "" || v === null || v === undefined ? "" : v);
const n2 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

function StatBox({ label, value, sub, fg }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: fg || T.ink, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2 }}>{sub}</div>}
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

export default function CropPlanner() {
  const { pop, tc } = useApp();

  /* Step 1-3: crop / area (the original simple workflow) */
  const [cropId, setCropId] = useState("");
  const [areaValue, setAreaValue] = useState("");
  const [areaUnit, setAreaUnit] = useState("acre");

  /* Step 4: seed */
  const [seedRate, setSeedRate] = useState("");
  const [seedPrice, setSeedPrice] = useState("");
  const [seedTreatmentCost, setSeedTreatmentCost] = useState("");
  const [wastagePct, setWastagePct] = useState("");

  const [advanced, setAdvanced] = useState(false);

  /* Steps 5-10: advanced inputs */
  const [fertilizer, setFertilizer] = useState([]);
  const [protection, setProtection] = useState([]);
  const [organic, setOrganic] = useState([]);
  const [irrigation, setIrrigation] = useState({ numIrrigations: "", waterCostPerIrrigation: "", electricityCost: "", dieselCost: "" });
  const [labour, setLabour] = useState([]);
  const [machinery, setMachinery] = useState([]);
  const [other, setOther] = useState([]);

  /* Steps 11: yield & selling price */
  const [yieldPerAcre, setYieldPerAcre] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");

  const crop = CROPS.find((c) => c.id === cropId);
  const areaAcres = toAcres(n2(areaValue), areaUnit);

  const plan = useMemo(() => computePlan({
    areaAcres,
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
    yieldPerAcre: n2(yieldPerAcre),
    sellingPrice: n2(sellingPrice),
  }), [areaAcres, seedRate, seedPrice, seedTreatmentCost, wastagePct, fertilizer, protection, organic, irrigation, labour, machinery, other, yieldPerAcre, sellingPrice]);

  const cropOptions = [{ value: "", label: "Other / not listed" }, ...CROPS.map((c) => ({ value: c.id, label: c.name }))];
  const areaUnitOptions = AREA_UNIT_OPTIONS.map((u) => ({ value: u, label: tc(AREA_UNITS[u].label) }));

  const usingMspFallback = !sellingPrice && crop && crop.msp;

  return (
    <>
      <AppBar title={tc({ en: "Crop input & cost planner", hi: "फसल इनपुट व लागत योजना", bn: "ফসল ইনপুট ও খরচ পরিকল্পনা" })} onBack={pop} />
      <Screen gap={20}>

        <Section title="Crop & area" icon="Sprout">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Dropdown label="Crop (optional — for a reference selling price)" value={cropId} onChange={setCropId} options={cropOptions} />
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
            <StatBox label="Seed required (final)" value={`${plan.seed.finalRequiredKg.toLocaleString("en-IN")} kg`}
              sub={plan.seed.wastageKg > 0 ? `incl. ${plan.seed.wastageKg} kg wastage` : undefined} />
            <StatBox label="Total seed cost" value={rupee(plan.seed.totalSeedCost)} fg={T.primary} />
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
          </>
        )}

        {/* Summary */}
        <Section title="Cultivation cost summary" icon="Calculator">
          <Card pad={14}>
            <SummaryRow label="Seed cost" value={plan.seed.totalSeedCost} />
            {plan.fertilizer.total > 0 && <SummaryRow label="Fertilizer cost" value={plan.fertilizer.total} />}
            {plan.protection.total > 0 && <SummaryRow label="Crop protection cost" value={plan.protection.total} />}
            {plan.organic.total > 0 && <SummaryRow label="Organic input cost" value={plan.organic.total} />}
            {plan.irrigation.total > 0 && <SummaryRow label="Irrigation cost" value={plan.irrigation.total} />}
            {plan.labour.total > 0 && <SummaryRow label="Labour cost" value={plan.labour.total} />}
            {plan.machinery.total > 0 && <SummaryRow label="Machinery cost" value={plan.machinery.total} />}
            {plan.other.total > 0 && <SummaryRow label="Other cost" value={plan.other.total} />}
            <div style={{ height: 1, background: T.lineSoft, margin: "10px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>Total cultivation cost</span>
              <span style={{ fontFamily: T.display, fontSize: 19, fontWeight: 800, color: T.primary }}>{rupee(plan.totalCost)}</span>
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <StatBox label="Cost / acre" value={rupee(plan.costPerAcre)} />
            <StatBox label="Cost / hectare" value={rupee(plan.costPerHectare)} />
          </div>
        </Section>

        {(n2(yieldPerAcre) > 0 || n2(sellingPrice) > 0) && (
          <Section title="Estimated profitability" icon="TrendingUp">
            <div style={{ fontSize: 11.5, color: T.inkFaint, marginBottom: 10, display: "flex", gap: 6 }}>
              <Icon name="Info" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              Planning estimate only — not a guaranteed yield, price, or profit.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatBox label="Estimated yield" value={`${plan.yield.totalYield.toLocaleString("en-IN")}`} sub="total, this area" />
              <StatBox label="Estimated revenue" value={rupee(plan.revenue.total)} />
              <StatBox label="Estimated profit" value={rupee(plan.profit.gross)} fg={plan.profit.gross >= 0 ? T.primary : T.red} />
              <StatBox label="ROI" value={plan.profit.roiPct === null ? "—" : `${plan.profit.roiPct}%`} fg={plan.profit.roiPct !== null && plan.profit.roiPct >= 0 ? T.primary : plan.profit.roiPct === null ? T.ink : T.red} />
              <StatBox label="Cost / kg (or unit)" value={plan.costPerKg === null ? "—" : rupee(plan.costPerKg)} />
              <StatBox label="Break-even price" value={plan.breakEven.breakEvenPrice === null ? "—" : rupee(plan.breakEven.breakEvenPrice)} sub="₹ needed / unit to cover cost" />
            </div>
          </Section>
        )}

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          This is a planning and estimation tool. Rates, doses, yields, and prices are what you enter — verify locally before purchase or sale. Saving and comparing plans is coming in a future update.
        </div>
      </Screen>
    </>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13.5 }}>
      <span style={{ color: T.inkSoft }}>{label}</span>
      <span style={{ color: T.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{rupee(value)}</span>
    </div>
  );
}
