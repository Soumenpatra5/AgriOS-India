import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Button, Chip } from "../../components/index.js";
import Icon from "../../components/Icon.jsx";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmService, FARM_TYPES } from "../../services/farm/farmService.js";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

export default function FarmProfiles() {
  const { pop, toast, can, tc } = useApp();
  const [farms, setFarms]   = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "mixed", village: "", district: "", state: "", sizeAcres: "", ownerName: "" });
  const [delId, setDelId] = useState(null);

  useEffect(() => {
    farmService.getAll().then((list) => {
      setFarms(list);
      setActiveId(farmService.getActiveId() || list[0]?.id || null);
    });
  }, [tick]);

  const add = async () => {
    if (!form.name) return;
    const rec = await farmService.add(form);
    if (farms.length === 0) farmService.setActive(rec.id);
    setOpen(false);
    setForm({ name: "", type: "mixed", village: "", district: "", state: "", sizeAcres: "", ownerName: "" });
    refresh(); toast(tc({ en: "Farm added", hi: "फार्म जोड़ा गया", bn: "খামার যোগ হয়েছে" }), "success");
  };

  const activate = (id) => { farmService.setActive(id); setActiveId(id); toast(tc({ en: "Active farm switched", hi: "सक्रिय फार्म बदला", bn: "সক্রিয় খামার বদলেছে" }), "success"); };
  const handleDelete = async () => { await farmService.remove(delId); setDelId(null); refresh(); toast(tc({ en: "Farm removed", hi: "फार्म हटाया गया", bn: "খামার সরানো হয়েছে" }), "info"); };

  return (
    <>
      <AppBar title={tc({ en: "Farm Profiles", hi: "फार्म प्रोफ़ाइल", bn: "খামার প্রোফাইল" })} onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })} Farm
        </button>
      } />

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {farms.length === 0
          ? <EmptyHint icon="House" text={tc({ en: "Add your first farm — all records can then be organised per farm", hi: "अपना पहला फार्म जोड़ें — फिर सभी रिकॉर्ड फार्म अनुसार व्यवस्थित होंगे", bn: "আপনার প্রথম খামার যোগ করুন — এরপর সব রেকর্ড খামার অনুযায়ী সাজানো যাবে" })} />
          : farms.map((f) => (
            <RecordRow key={f.id} icon="House"
              title={f.name}
              badge={f.id === activeId ? <Pill>{tc({ en: "ACTIVE", hi: "सक्रिय", bn: "সক্রিয়" })}</Pill> : null}
              subtitle={`${tc(farmService.typeI18n(f.type))}${f.sizeAcres ? ` · ${f.sizeAcres} ${tc({ en: "acres", hi: "एकड़", bn: "একর" })}` : ""}${f.village ? ` · ${f.village}` : ""}${f.district ? `, ${f.district}` : ""}`}
              onClick={f.id !== activeId ? () => activate(f.id) : undefined}
              right={f.id !== activeId ? (
                <span style={{ fontSize: 11.5, color: T.primary, fontWeight: 600, flexShrink: 0 }}>{tc({ en: "Set active", hi: "सक्रिय करें", bn: "সক্রিয় করুন" })}</span>
              ) : null}
              onDelete={can("records.delete") ? () => setDelId(f.id) : undefined} />
          ))}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={tc({ en: "Add Farm", hi: "फार्म जोड़ें", bn: "খামার যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Farm name", hi: "फार्म का नाम", bn: "খামারের নাম" })} placeholder={tc({ en: "e.g. Patra Agro Farm", hi: "उदा. पात्रा एग्रो फार्म", bn: "যেমন পাত্র এগ্রো ফার্ম" })} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Dropdown label={tc({ en: "Farm type", hi: "फार्म प्रकार", bn: "খামারের ধরন" })} value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))}
            options={FARM_TYPES.map((t) => ({ value: t.id, label: t.i18n ? tc(t.i18n) : t.label }))} />
          <Input label={tc({ en: "Owner name", hi: "मालिक का नाम", bn: "মালিকের নাম" })} placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} value={form.ownerName} onChange={(v) => setForm((f) => ({ ...f, ownerName: v }))} />
          <Input label={tc({ en: "Village / Town", hi: "गाँव / शहर", bn: "গ্রাম / শহর" })} placeholder="" value={form.village} onChange={(v) => setForm((f) => ({ ...f, village: v }))} />
          <Input label={tc({ en: "District", hi: "ज़िला", bn: "জেলা" })} placeholder="" value={form.district} onChange={(v) => setForm((f) => ({ ...f, district: v }))} />
          <Input label={tc({ en: "State", hi: "राज्य", bn: "রাজ্য" })} placeholder="" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v }))} />
          <Input label="Total size (acres)" type="number" placeholder="0" value={form.sizeAcres} onChange={(v) => setForm((f) => ({ ...f, sizeAcres: v }))} />
          <Button full onClick={add} disabled={!form.name}>{tc({ en: "Add Farm", hi: "फार्म जोड़ें", bn: "খামার যোগ করুন" })}</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title={tc({ en: "Delete farm?", hi: "फार्म हटाएँ?", bn: "খামার মুছবেন?" })} onClose={() => setDelId(null)}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" }), variant: "outline", onClick: () => setDelId(null) },
          { label: tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }), variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>
          The farm profile will be removed. Records tagged to it are kept.
        </div>
      </Dialog>
    </>
  );
}
