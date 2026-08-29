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
import { localCropName } from "../../services/market/cropData.js";

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
  /* Its own useApp rather than a tc prop: it is a component, and threading tc
     through five call sites just to reach one aria-label is noise. */
  const { tc } = useApp();
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
          {tc({ en: "No entries yet — add one below.", hi: "अभी कोई प्रविष्टि नहीं — नीचे जोड़ें।", bn: "এখনও কোনও এন্ট্রি নেই — নিচে যোগ করুন।" })}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((row, i) => (
          <Card key={i} pad={12}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <button onClick={() => remove(i)} aria-label={tc({ en: "Remove row", hi: "पंक्ति हटाएँ", bn: "সারি সরান" })}
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
  const { pop, push, tc, toast, lang } = useApp();
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

  const cropOptions = [{ value: "", label: tc({ en: "Other / not listed", hi: "अन्य / सूची में नहीं", bn: "অন্যান্য / তালিকায় নেই" }) }, ...CROPS.map((c) => ({ value: c.id, label: localCropName(c, lang) }))];
  const areaUnitOptions = AREA_UNIT_OPTIONS.map((u) => ({ value: u, label: tc(AREA_UNITS[u].label) }));
  const farmOptions = [{ value: "", label: tc({ en: "No farm selected — manual entry", hi: "कोई खेत नहीं चुना — स्वयं भरें", bn: "কোনও খামার বাছা হয়নি — নিজে লিখুন" }) }, ...farms.map((f) => ({ value: f.id, label: f.name || tc({ en: "Unnamed farm", hi: "बिना नाम का खेत", bn: "নামহীন খামার" }) }))];
  const fieldOptions = [{ value: "", label: tc({ en: "No field selected — manual entry", hi: "कोई खेत-भाग नहीं चुना — स्वयं भरें", bn: "কোনও জমি বাছা হয়নি — নিজে লিখুন" }) }, ...fields.map((f) => ({ value: f.id, label: f.name || tc({ en: "Unnamed field", hi: "बिना नाम का खेत-भाग", bn: "নামহীন জমি" }) }))];

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
        <AppBar title={tc({ en: "Crop plan", hi: "फ़सल योजना", bn: "ফসল পরিকল্পনা" })} onBack={pop} />
        <div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>{tc({ en: "Loading…", hi: "लोड हो रहा है…", bn: "লোড হচ্ছে…" })}</div>
      </>
    );
  }

  return (
    <>
      <AppBar title={tc({ en: editing ? "Edit crop plan" : "Crop input & cost planner", hi: editing ? "फसल योजना संपादित करें" : "फसल इनपुट व लागत योजना", bn: editing ? "ফসল পরিকল্পনা সম্পাদনা" : "ফসল ইনপুট ও খরচ পরিকল্পনা" })} onBack={pop} />
      <Screen gap={20}>

        <Section title={tc({ en: "Farm & field (optional)", hi: "फार्म और खेत (वैकल्पिक)", bn: "খামার ও মাঠ (ঐচ্ছিক)" })} icon="Map">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Dropdown label={tc({ en: "Farm", hi: "फार्म", bn: "খামার" })} value={farmId} onChange={(v) => { setFarmId(v); setFieldId(""); }} options={farmOptions} />
            {farmId && <Dropdown label={tc({ en: "Field", hi: "खेत", bn: "মাঠ" })} value={fieldId} onChange={onSelectField} options={fieldOptions} />}
            {field?.currentCrop && (
              <div style={{ fontSize: 12, color: T.inkFaint }}>Previous crop on this field: {field.currentCrop}</div>
            )}
          </div>
        </Section>

        <Section title={tc({ en: "Crop & area", hi: "फ़सल और क्षेत्रफल", bn: "ফসল ও আয়তন" })} icon="Sprout">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Dropdown label={tc({ en: "Crop", hi: "फ़सल", bn: "ফসল" })} value={cropId} onChange={setCropId} options={cropOptions} />
            {!cropId && <Input label={tc({ en: "Crop name", hi: "फ़सल का नाम", bn: "ফসলের নাম" })} value={customCropName} onChange={setCustomCropName} placeholder={tc({ en: "e.g. Cauliflower", hi: "उदा. फूलगोभी", bn: "যেমন ফুলকপি" })} />}
            <Input label={tc({ en: "Variety / seed type (optional)", hi: "किस्म / बीज प्रकार (वैकल्पिक)", bn: "জাত / বীজের ধরন (ঐচ্ছিক)" })} value={variety} onChange={setVariety} placeholder={tc({ en: "e.g. Hybrid, Certified", hi: "उदा. हाइब्रिड, प्रमाणित", bn: "যেমন হাইব্রিড, প্রত্যয়িত" })} />
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
              <Input label={tc({ en: "Area", hi: "क्षेत्रफल", bn: "আয়তন" })} value={num(areaValue)} onChange={setAreaValue} type="number" inputMode="decimal" placeholder="0" />
              <Dropdown label={tc({ en: "Unit", hi: "इकाई", bn: "একক" })} value={areaUnit} onChange={setAreaUnit} options={areaUnitOptions} />
            </div>
            {areaUnit !== "acre" && areaValue !== "" && (
              <div style={{ fontSize: 12, color: T.inkFaint }}>
                = {areaAcres.toFixed(2)} acres internally{AREA_UNITS[areaUnit].approx ? " (bigha varies by state — treat as approximate)" : ""}
              </div>
            )}
          </div>
        </Section>

        <Section title={tc({ en: "Seed", hi: "बीज", bn: "বীজ" })} icon="Wheat">
          <Card pad={12}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input label={tc({ en: "Seed rate (kg / acre)", hi: "बीज दर (किग्रा / एकड़)", bn: "বীজের হার (কেজি / একর)" })} value={num(seedRate)} onChange={setSeedRate} type="number" inputMode="decimal" placeholder={tc({ en: "e.g. 50", hi: "उदा. 50", bn: "যেমন ৫০" })} />
                <Input label={tc({ en: "Seed price (₹ / kg)", hi: "बीज मूल्य (₹ / किग्रा)", bn: "বীজের দাম (₹ / কেজি)" })} value={num(seedPrice)} onChange={setSeedPrice} type="number" inputMode="decimal" prefix="₹" placeholder={tc({ en: "e.g. 55", hi: "उदा. 55", bn: "যেমন ৫৫" })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input label="Wastage %" value={num(wastagePct)} onChange={setWastagePct} type="number" inputMode="decimal" placeholder="0" />
                <Input label={tc({ en: "Seed treatment cost (₹)", hi: "बीज उपचार लागत (₹)", bn: "বীজ শোধনের ব্যয় (₹)" })} value={num(seedTreatmentCost)} onChange={setSeedTreatmentCost} type="number" inputMode="decimal" prefix="₹" placeholder="0" />
              </div>
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
              <div style={{ fontSize: 11.5, color: T.inkSoft }}>{tc({ en: "Seed required (final)", hi: "आवश्यक बीज (अंतिम)", bn: "প্রয়োজনীয় বীজ (চূড়ান্ত)" })}</div>
              <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, marginTop: 2 }}>{plan.seed.finalRequiredKg.toLocaleString("en-IN")} kg</div>
              {plan.seed.wastageKg > 0 && <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2 }}>incl. {plan.seed.wastageKg} kg wastage</div>}
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "13px 12px" }}>
              <div style={{ fontSize: 11.5, color: T.inkSoft }}>{tc({ en: "Total seed cost", hi: "कुल बीज लागत", bn: "মোট বীজের ব্যয়" })}</div>
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
            <RowEditor title={tc({ en: "Fertilizer", hi: "उर्वरक", bn: "সার" })} icon="Leaf" rows={fertilizer} setRows={setFertilizer}
              addLabel={tc({ en: "Add fertilizer", hi: "उर्वरक जोड़ें", bn: "সার যোগ করুন" })}
              fields={[
                { key: "name", label: tc({ en: "Product (e.g. Urea, DAP)", hi: "उत्पाद (जैसे यूरिया, DAP)", bn: "পণ্য (যেমন ইউরিয়া, DAP)" }), full: true },
                { key: "rate", label: tc({ en: "Rate (kg or L / acre / app)", hi: "मात्रा (किग्रा या लीटर / एकड़ / छिड़काव)", bn: "পরিমাণ (কেজি বা লিটার / একর / প্রয়োগ)" }), type: "number" },
                { key: "applications", label: tc({ en: "No. of applications", hi: "कितनी बार डाला", bn: "কতবার প্রয়োগ" }), type: "number", placeholder: "1" },
                { key: "price", label: tc({ en: "Price (₹ / kg or L)", hi: "क़ीमत (₹ / किग्रा या लीटर)", bn: "দাম (₹ / কেজি বা লিটার)" }), type: "number", prefix: "₹" },
              ]} />

            <RowEditor title={tc({ en: "Crop protection", hi: "फ़सल सुरक्षा", bn: "ফসল সুরক্ষা" })} icon="ShieldCheck" rows={protection} setRows={setProtection}
              addLabel={tc({ en: "Add pesticide / fungicide", hi: "कीटनाशक / फफूँदनाशक जोड़ें", bn: "কীটনাশক / ছত্রাকনাশক যোগ করুন" })}
              fields={[
                { key: "product", label: tc({ en: "Product", hi: "उत्पाद", bn: "পণ্য" }), full: true },
                { key: "rate", label: tc({ en: "Rate (per acre / app)", hi: "मात्रा (प्रति एकड़ / छिड़काव)", bn: "পরিমাণ (প্রতি একর / প্রয়োগ)" }), type: "number" },
                { key: "applications", label: tc({ en: "No. of applications", hi: "कितनी बार डाला", bn: "কতবার প্রয়োগ" }), type: "number", placeholder: "1" },
                { key: "price", label: tc({ en: "Price (₹ / unit)", hi: "क़ीमत (₹ / इकाई)", bn: "দাম (₹ / একক)" }), type: "number", prefix: "₹" },
              ]} />

            <RowEditor title={tc({ en: "Organic inputs", hi: "जैविक इनपुट", bn: "জৈব উপকরণ" })} icon="Leaf" rows={organic} setRows={setOrganic}
              addLabel={tc({ en: "Add organic input", hi: "जैविक इनपुट जोड़ें", bn: "জৈব উপকরণ যোগ করুন" })}
              fields={[
                { key: "name", label: tc({ en: "Input (e.g. Vermicompost)", hi: "इनपुट (जैसे वर्मीकम्पोस्ट)", bn: "উপকরণ (যেমন কেঁচো সার)" }), full: true },
                { key: "rate", label: tc({ en: "Rate (kg / acre / app)", hi: "मात्रा (किग्रा / एकड़ / प्रयोग)", bn: "পরিমাণ (কেজি / একর / প্রয়োগ)" }), type: "number" },
                { key: "applications", label: tc({ en: "No. of applications", hi: "कितनी बार डाला", bn: "কতবার প্রয়োগ" }), type: "number", placeholder: "1" },
                { key: "price", label: tc({ en: "Price (₹ / kg)", hi: "क़ीमत (₹ / किग्रा)", bn: "দাম (₹ / কেজি)" }), type: "number", prefix: "₹" },
              ]} />

            <Section title={tc({ en: "Irrigation", hi: "सिंचाई", bn: "সেচ" })} icon="Droplets">
              <Card pad={12}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Input label={tc({ en: "No. of irrigations", hi: "सिंचाई की संख्या", bn: "সেচের সংখ্যা" })} value={num(irrigation.numIrrigations)} onChange={(v) => setIrrigation((s) => ({ ...s, numIrrigations: v }))} type="number" inputMode="decimal" />
                    <Input label={tc({ en: "Cost per irrigation (₹)", hi: "प्रति सिंचाई लागत (₹)", bn: "প্রতি সেচের ব্যয় (₹)" })} value={num(irrigation.waterCostPerIrrigation)} onChange={(v) => setIrrigation((s) => ({ ...s, waterCostPerIrrigation: v }))} type="number" inputMode="decimal" prefix="₹" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Input label={tc({ en: "Electricity / pump (₹)", hi: "बिजली / पंप (₹)", bn: "বিদ্যুৎ / পাম্প (₹)" })} value={num(irrigation.electricityCost)} onChange={(v) => setIrrigation((s) => ({ ...s, electricityCost: v }))} type="number" inputMode="decimal" prefix="₹" />
                    <Input label={tc({ en: "Diesel (₹)", hi: "डीज़ल (₹)", bn: "ডিজেল (₹)" })} value={num(irrigation.dieselCost)} onChange={(v) => setIrrigation((s) => ({ ...s, dieselCost: v }))} type="number" inputMode="decimal" prefix="₹" />
                  </div>
                </div>
              </Card>
            </Section>

            <RowEditor title={tc({ en: "Labour", hi: "श्रम", bn: "শ্রম" })} icon="Users" rows={labour} setRows={setLabour}
              addLabel={tc({ en: "Add labour entry", hi: "श्रम प्रविष्टि जोड़ें", bn: "শ্রমের এন্ট্রি যোগ করুন" })}
              fields={[
                { key: "type", label: tc({ en: "Activity (e.g. Weeding, Sowing)", hi: "काम (जैसे निराई, बुवाई)", bn: "কাজ (যেমন আগাছা পরিষ্কার, বপন)" }), full: true },
                { key: "workers", label: tc({ en: "Workers", hi: "मज़दूर", bn: "শ্রমিক" }), type: "number" },
                { key: "days", label: tc({ en: "Days", hi: "दिन", bn: "দিন" }), type: "number" },
                { key: "wage", label: tc({ en: "Daily wage (₹)", hi: "दैनिक मज़दूरी (₹)", bn: "দৈনিক মজুরি (₹)" }), type: "number", prefix: "₹" },
              ]} />

            <RowEditor title={tc({ en: "Machinery", hi: "मशीनरी", bn: "যন্ত্রপাতি" })} icon="Tractor" rows={machinery} setRows={setMachinery}
              addLabel={tc({ en: "Add machine", hi: "मशीन जोड़ें", bn: "যন্ত্র যোগ করুন" })}
              fields={[
                { key: "machine", label: tc({ en: "Machine (e.g. Tractor)", hi: "मशीन (जैसे ट्रैक्टर)", bn: "যন্ত্র (যেমন ট্রাক্টর)" }), full: true },
                { key: "hours", label: tc({ en: "Hours", hi: "घंटे", bn: "ঘণ্টা" }), type: "number" },
                { key: "ratePerHour", label: tc({ en: "Rate / hour (₹)", hi: "प्रति घंटा दर (₹)", bn: "প্রতি ঘণ্টার হার (₹)" }), type: "number", prefix: "₹" },
                { key: "fuelCost", label: tc({ en: "Fuel cost (₹)", hi: "ईंधन लागत (₹)", bn: "জ্বালানির খরচ (₹)" }), type: "number", prefix: "₹" },
                { key: "operatorCost", label: tc({ en: "Operator cost (₹)", hi: "चालक लागत (₹)", bn: "চালকের খরচ (₹)" }), type: "number", prefix: "₹" },
              ]} />

            <RowEditor title={tc({ en: "Other costs", hi: "अन्य लागत", bn: "অন্যান্য ব্যয়" })} icon="Receipt" rows={other} setRows={setOther}
              addLabel={tc({ en: "Add other cost", hi: "अन्य लागत जोड़ें", bn: "অন্য খরচ যোগ করুন" })}
              fields={[
                { key: "label", label: tc({ en: "Description (e.g. Transport, Packaging)", hi: "विवरण (जैसे परिवहन, पैकेजिंग)", bn: "বিবরণ (যেমন পরিবহন, প্যাকেজিং)" }), full: true },
                { key: "amount", label: tc({ en: "Amount (₹)", hi: "राशि (₹)", bn: "পরিমাণ (₹)" }), type: "number", prefix: "₹" },
              ]} />

            <Section title={tc({ en: "Yield & expected selling price", hi: "उपज और अपेक्षित विक्रय मूल्य", bn: "ফলন ও প্রত্যাশিত বিক্রয় মূল্য" })} icon="BarChart3">
              <Card pad={12}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Input label={tc({ en: "Expected yield (qty / acre) — planning estimate", hi: "अपेक्षित उपज (मात्रा / एकड़) — योजना अनुमान", bn: "প্রত্যাশিত ফলন (পরিমাণ / একর) — পরিকল্পনার অনুমান" })} value={num(yieldPerAcre)} onChange={setYieldPerAcre} type="number" inputMode="decimal" placeholder={tc({ en: "Not a guaranteed figure", hi: "यह गारंटीशुदा आँकड़ा नहीं है", bn: "এটি নিশ্চিত সংখ্যা নয়" })} />
                  <Input label={tc({ en: "Expected selling price (₹ / qty unit)", hi: "अपेक्षित विक्रय मूल्य (₹ / इकाई)", bn: "প্রত্যাশিত বিক্রয় মূল্য (₹ / একক)" })} value={num(sellingPrice)} onChange={setSellingPrice} type="number" inputMode="decimal" prefix="₹"
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

            <Section title={tc({ en: "Notes", hi: "टिप्पणी", bn: "মন্তব্য" })} icon="FileText">
              <Input value={notes} onChange={setNotes} placeholder={tc({ en: "Optional notes about this plan", hi: "इस योजना के बारे में वैकल्पिक टिप्पणी", bn: "এই পরিকল্পনা সম্পর্কে ঐচ্ছিক মন্তব্য" })} />
            </Section>
          </>
        )}

        <PlanSummary plan={plan} showProfitability={n2(yieldPerAcre) > 0 || n2(sellingPrice) > 0} />

        <Button full onClick={save} disabled={!canSave || saving} icon="Save">
          {saving ? "Saving…" : editing ? "Update crop plan" : "Save crop plan"}
        </Button>
        {!canSave && <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center" }}>{tc({ en: "Enter a crop name and area to save.", hi: "सहेजने के लिए फ़सल का नाम और क्षेत्रफल भरें।", bn: "সংরক্ষণ করতে ফসলের নাম ও আয়তন লিখুন।" })}</div>}

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          This is a planning and estimation tool. Rates, doses, yields, and prices are what you enter — verify locally before purchase or sale.
        </div>
      </Screen>
    </>
  );
}
