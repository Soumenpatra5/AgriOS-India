import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Button } from "../../components/index.js";
import Icon from "../../components/Icon.jsx";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { landService, SOIL_TYPES, WATER_SOURCES, OWNERSHIP } from "../../services/land/landService.js";
import { farmService } from "../../services/farm/farmService.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

export default function LandManager() {
  const { pop, toast, can, tc } = useApp();
  const [parcels, setParcels] = useState([]);
  const [util, setUtil]       = useState(null);
  const [farmId, setFarmId]   = useState(null);
  const [tick, setTick]       = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", areaAcres: "", soilType: "", waterSource: "", ownership: "owned", currentCrop: "", leaseCost: "" });
  const [cropTarget, setCropTarget] = useState(null);
  const [cropName, setCropName]     = useState("");
  const [delId, setDelId] = useState(null);

  useEffect(() => {
    (async () => {
      const farm = await farmService.getActive();
      setFarmId(farm?.id || null);
      setParcels(await landService.getAll(farm?.id));
      setUtil(await landService.utilization(farm?.id));
    })();
  }, [tick]);

  const add = async () => {
    if (!form.name || !form.areaAcres) return;
    await landService.add({ ...form, farmId });
    setOpen(false);
    setForm({ name: "", areaAcres: "", soilType: "", waterSource: "", ownership: "owned", currentCrop: "", leaseCost: "" });
    refresh(); toast(tc({ en: "Parcel added", hi: "खंड जोड़ा गया", bn: "প্লট যোগ হয়েছে" }), "success");
  };

  const setCrop = async () => {
    if (!cropName) return;
    await landService.setCrop(cropTarget, cropName);
    setCropTarget(null); setCropName("");
    refresh(); toast(tc({ en: "Crop updated", hi: "फ़सल अपडेट हुई", bn: "ফসল হালনাগাদ হয়েছে" }), "success");
  };

  const handleDelete = async () => { await landService.remove(delId); setDelId(null); refresh(); toast(tc({ en: "Deleted", hi: "हटाया गया", bn: "মুছে ফেলা হয়েছে" }), "info"); };

  return (
    <>
      <AppBar title={tc({ en: "Land Parcels", hi: "भूमि खंड", bn: "জমির প্লট" })} onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.orange, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      } />

      {util && (
        <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
          <StatTile a="orange" label={tc({ en: "Parcels", hi: "खंड", bn: "প্লট" })} value={util.parcels} />
          <StatTile a="orange" label={tc({ en: "Total Acres", hi: "कुल एकड़", bn: "মোট একর" })} value={util.totalAcres.toFixed(1)} />
          <StatTile a="primary" label={tc({ en: "Utilised", hi: "उपयोग", bn: "ব্যবহৃত" })} value={`${util.pct}%`} />
        </div>
      )}

      <div style={{ padding: "10px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {parcels.length === 0
          ? <EmptyHint icon="Map" text={tc({ en: "Add land parcels — soil, water, lease and crop rotation are tracked per parcel", hi: "भूमि खंड जोड़ें — मिट्टी, पानी, पट्टा और फ़सल चक्र प्रति खंड दर्ज होते हैं", bn: "জমির প্লট যোগ করুন — মাটি, জল, ইজারা ও ফসল আবর্তন প্রতি প্লটে রাখা হয়" })} />
          : parcels.map((p) => (
            <RecordRow key={p.id} icon="Map" iconColor={T.orange} iconBg={T.orangeSoft}
              title={p.name}
              badge={p.ownership !== "owned" ? <Pill fg={T.blue} bg={T.blueSoft}>{p.ownership}</Pill> : null}
              subtitle={`${p.areaAcres} acres${p.soilType ? ` · ${p.soilType}` : ""}${p.waterSource ? ` · ${p.waterSource}` : ""}${p.currentCrop ? ` · 🌾 ${p.currentCrop}` : " · fallow"}`}
              right={
                <button onClick={(e) => { e.stopPropagation(); setCropTarget(p.id); setCropName(p.currentCrop || ""); }}
                  style={{ background: T.primarySoft, color: T.primary, border: "none", borderRadius: 9,
                    padding: "6px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: T.body, flexShrink: 0 }}>
                  Set crop
                </button>
              }
              onDelete={can("records.delete") ? () => setDelId(p.id) : undefined} />
          ))}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={tc({ en: "Add Land Parcel", hi: "भूमि खंड जोड़ें", bn: "জমির প্লট যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Parcel name", hi: "खंड का नाम", bn: "প্লটের নাম" })} placeholder={tc({ en: "e.g. North plot", hi: "उदा. उत्तरी खेत", bn: "যেমন উত্তরের প্লট" })} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Input label={tc({ en: "Area (acres)", hi: "क्षेत्रफल (एकड़)", bn: "আয়তন (একর)" })} type="number" placeholder="0" value={form.areaAcres} onChange={(v) => setForm((f) => ({ ...f, areaAcres: v }))} />
          <Dropdown label="Soil type" value={form.soilType} onChange={(v) => setForm((f) => ({ ...f, soilType: v }))}
            options={["", ...SOIL_TYPES].map((s) => ({ value: s, label: s || tc({ en: "Select…", hi: "चुनें…", bn: "বাছুন…" }) }))} />
          <Dropdown label="Water source" value={form.waterSource} onChange={(v) => setForm((f) => ({ ...f, waterSource: v }))}
            options={["", ...WATER_SOURCES].map((s) => ({ value: s, label: s || tc({ en: "Select…", hi: "चुनें…", bn: "বাছুন…" }) }))} />
          <Dropdown label="Ownership" value={form.ownership} onChange={(v) => setForm((f) => ({ ...f, ownership: v }))}
            options={OWNERSHIP.map((o) => ({ value: o.id, label: o.i18n ? tc(o.i18n) : o.label }))} />
          {form.ownership === "leased" && (
            <Input label="Lease cost (₹/year)" type="number" placeholder="0" value={form.leaseCost} onChange={(v) => setForm((f) => ({ ...f, leaseCost: v }))} />
          )}
          <Input label="Current crop (optional)" placeholder="e.g. Paddy" value={form.currentCrop} onChange={(v) => setForm((f) => ({ ...f, currentCrop: v }))} />
          <Button full onClick={add} disabled={!form.name || !form.areaAcres}>{tc({ en: "Add Parcel", hi: "खंड जोड़ें", bn: "প্লট যোগ করুন" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!cropTarget} onClose={() => setCropTarget(null)} title="Set Current Crop">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Crop" placeholder="e.g. Mustard" value={cropName} onChange={setCropName} />
          <div style={{ fontSize: 12, color: T.inkSoft }}>
            Setting a crop adds it to this parcel's rotation history.
          </div>
          <Button full onClick={setCrop} disabled={!cropName}>Save</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title={tc({ en: "Delete parcel?", hi: "खंड हटाएँ?", bn: "প্লট মুছবেন?" })} onClose={() => setDelId(null)}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" }), variant: "outline", onClick: () => setDelId(null) },
          { label: tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }), variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>This parcel and its rotation history will be removed.</div>
      </Dialog>
    </>
  );
}
