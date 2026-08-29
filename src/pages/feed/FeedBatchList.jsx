/* Feed batch list — the FCR/consumption tracking unit. Optionally filtered
   to one enterprise when opened from a livestock manager page. */
import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Screen, Chip } from "../../components/index.js";
import { BottomSheet, Input, Dropdown } from "../../components/index.js";
import { Button } from "../../components/primitives.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";
import { useApp } from "../../store/AppStore.jsx";
import { feedBatchService, BATCH_STATUSES } from "../../services/feed/feedBatchService.js";
import { LIVESTOCK_TYPES } from "../../services/feed/feedService.js";
import { animalService } from "../../services/livestock/livestockService.js";

const emptyForm = { enterprise: "poultry", label: "", animalId: "", initialCount: "", initialWeight: "", startDate: new Date().toISOString().slice(0, 10), targetFCR: "" };

export default function FeedBatchList({ enterprise } = {}) {
  const { pop, push, toast, tc } = useApp();
  const [batches, setBatches] = useState(null);
  const [filter, setFilter] = useState(enterprise || "all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, enterprise: enterprise || "poultry" });
  const [animals, setAnimals] = useState([]);

  const refresh = () => feedBatchService.getAll().then(setBatches);
  useEffect(() => { refresh(); }, []);
  useEffect(() => { animalService.getAll(form.enterprise).then(setAnimals); }, [form.enterprise]);

  if (batches === null) {
    return (<><AppBar title={tc({ en: "Feed batches", hi: "चारा बैच", bn: "খাদ্য ব্যাচ" })} onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>{tc({ en: "Loading…", hi: "लोड हो रहा है…", bn: "লোড হচ্ছে…" })}</div></>);
  }

  const visible = filter === "all" ? batches : batches.filter((b) => b.enterprise === filter);

  const save = async () => {
    if (!form.label.trim()) return;
    const b = await feedBatchService.add({
      ...form, initialCount: Number(form.initialCount) || 0, initialWeight: Number(form.initialWeight) || 0,
      targetFCR: form.targetFCR === "" ? null : Number(form.targetFCR),
    });
    setOpen(false); setForm({ ...emptyForm, enterprise: enterprise || "poultry" });
    refresh(); toast(tc({ en: "Batch created", hi: "बैच बनाया गया", bn: "ব্যাচ তৈরি হয়েছে" }), "success");
    push({ kind: "feedBatchDetail", props: { id: b.id } });
  };

  const enterpriseOptions = LIVESTOCK_TYPES.map((t) => ({ value: t.id, label: t.i18n ? tc(t.i18n) : t.label }));
  const animalOptions = [{ value: "", label: tc({ en: "Not linked — general batch", hi: "लिंक नहीं — सामान्य बैच", bn: "লিঙ্ক নেই — সাধারণ ব্যাচ" }) }, ...animals.map((a) => ({ value: a.id, label: a.name || tc({ en: "Unnamed", hi: "बिना नाम", bn: "নামহীন" }) }))];

  return (
    <>
      <AppBar title={tc({ en: "Feed batches", hi: "चारा बैच", bn: "খাদ্য ব্যাচ" })} onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          + New batch
        </button>
      } />
      <Screen gap={16}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
          {LIVESTOCK_TYPES.map((t) => (
            <Chip key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)}>{t.label}</Chip>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyHint icon="Layers" text={tc({ en: "No feed batches yet — create one to start tracking FCR and feed cost.", hi: "अभी कोई चारा बैच नहीं — FCR और लागत देखने के लिए एक बनाएँ।", bn: "এখনও কোনও খাদ্য ব্যাচ নেই — FCR ও ব্যয় দেখতে একটি তৈরি করুন।" })} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.map((b) => (
              <RecordRow key={b.id} icon="Layers"
                title={b.label || tc({ en: "Unnamed batch", hi: "बिना नाम बैच", bn: "নামহীন ব্যাচ" })}
                subtitle={`${LIVESTOCK_TYPES.find((t) => t.id === b.enterprise)?.label || b.enterprise} · ${b.initialCount || 0} initial${b.currentCount != null ? ` · ${b.currentCount} current` : ""}`}
                badge={<Pill fg={b.status === "active" ? T.primary : T.inkSoft} bg={b.status === "active" ? T.primarySoft : T.surface2}>
                  {BATCH_STATUSES.find((s) => s.id === b.status)?.label || b.status}
                </Pill>}
                onClick={() => push({ kind: "feedBatchDetail", props: { id: b.id } })} />
            ))}
          </div>
        )}
      </Screen>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={tc({ en: "New Feed Batch", hi: "नया चारा बैच", bn: "নতুন খাদ্য ব্যাচ" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label={tc({ en: "Livestock type", hi: "पशु प्रकार", bn: "প্রাণীর ধরন" })} value={form.enterprise} onChange={(v) => setForm((f) => ({ ...f, enterprise: v, animalId: "" }))} options={enterpriseOptions} />
          <Input label={tc({ en: "Batch / pond label", hi: "बैच / तालाब नाम", bn: "ব্যাচ / পুকুরের নাম" })} value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} placeholder={tc({ en: "e.g. Batch #001", hi: "उदा. बैच #001", bn: "যেমন ব্যাচ #০০১" })} />
          <Dropdown label={tc({ en: "Link to existing animal / flock / pond (optional)", hi: "मौजूदा पशु / झुंड / तालाब से जोड़ें (वैकल्पिक)", bn: "বিদ্যমান প্রাণী / ঝাঁক / পুকুরের সঙ্গে যুক্ত করুন (ঐচ্ছিক)" })} value={form.animalId} onChange={(v) => setForm((f) => ({ ...f, animalId: v }))} options={animalOptions} />
          {form.animalId && (
            <div style={{ fontSize: 11.5, color: T.inkFaint }}>
              Linking enables species-specific insights (milk yield, eggs, biomass) once your existing production logs for this {form.enterprise === "dairy" ? "animal" : form.enterprise === "fish" ? "pond" : "flock"} are recorded.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Initial count", hi: "प्रारंभिक संख्या", bn: "প্রাথমিক সংখ্যা" })} type="number" value={form.initialCount} onChange={(v) => setForm((f) => ({ ...f, initialCount: v }))} />
            <Input label={tc({ en: "Initial avg weight (kg)", hi: "प्रारंभिक औसत वज़न (किग्रा)", bn: "প্রাথমিক গড় ওজন (কেজি)" })} type="number" value={form.initialWeight} onChange={(v) => setForm((f) => ({ ...f, initialWeight: v }))} placeholder="0" />
          </div>
          <Input label={tc({ en: "Start date", hi: "प्रारंभ तिथि", bn: "শুরুর তারিখ" })} type="date" value={form.startDate} onChange={(v) => setForm((f) => ({ ...f, startDate: v }))} />
          <Input label={tc({ en: "Target FCR (optional)", hi: "लक्ष्य FCR (वैकल्पिक)", bn: "লক্ষ্য FCR (ঐচ্ছিক)" })} type="number" value={form.targetFCR} onChange={(v) => setForm((f) => ({ ...f, targetFCR: v }))} placeholder={tc({ en: "You set this — not a built-in default", hi: "आप स्वयं तय करें — कोई डिफ़ॉल्ट नहीं", bn: "আপনি নিজে ঠিক করুন — কোনও ডিফল্ট নেই" })} />
          <Button full onClick={save} disabled={!form.label.trim()}>{tc({ en: "Create batch", hi: "बैच बनाएँ", bn: "ব্যাচ তৈরি করুন" })}</Button>
        </div>
      </BottomSheet>
    </>
  );
}
