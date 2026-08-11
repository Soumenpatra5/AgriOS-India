import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { animalService, productionService, eventService } from "../../services/livestock/livestockService.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { RecordRow, EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

const TABS = ["Herd", "Weight Log", "Events"];
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (d) => new Date(d + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const FG = { primary: T.primary, blue: T.blue, orange: T.orange, red: T.red, yellow: T.yellow };
const BG = { primary: T.primarySoft, blue: T.blueSoft, orange: T.orangeSoft, red: T.redSoft, yellow: T.yellowSoft };

/* Generic ruminant/monogastric herd manager. Goat, Pig and Sheep use this
   with a config — identical workflows, zero duplicated screens. */
export default function HerdManager({ config }) {
  const { enterprise, title, noun, icon, accent, breeds, female, male, eventTypes } = config;
  const { pop, push, toast } = useApp();
  const fg = FG[accent] || T.primary;
  const bg = BG[accent] || T.primarySoft;

  const [tab, setTab]       = useState("Herd");
  const [animals, setAnimals] = useState([]);
  const [prods, setProds]   = useState([]);
  const [events, setEvents] = useState([]);
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [animalOpen, setAnimalOpen] = useState(false);
  const [animalForm, setAnimalForm] = useState({ name: "", breed: "", gender: "female", ageMonths: "", tagNo: "" });
  const [prodOpen, setProdOpen]     = useState(false);
  const [prodForm, setProdForm]     = useState({ date: todayStr(), weightKg: "", animalId: "" });
  const [eventOpen, setEventOpen]   = useState(false);
  const [eventForm, setEventForm]   = useState({ date: todayStr(), type: eventTypes[0].value, note: "", dueDate: "" });
  const [delTarget, setDelTarget]   = useState(null); // {id, store}

  useEffect(() => {
    animalService.getAll(enterprise).then(setAnimals);
    productionService.getForEnterprise(enterprise, 60).then(setProds);
    eventService.getForEnterprise(enterprise).then(setEvents);
  }, [tick, enterprise]);

  const animalOptions = [{ value: "", label: `Select ${noun.toLowerCase()}…` },
    ...animals.map((a) => ({ value: a.id, label: a.name }))];

  const addAnimal = async () => {
    if (!animalForm.name) return;
    await animalService.add({ ...animalForm, enterprise });
    setAnimalOpen(false); setAnimalForm({ name: "", breed: "", gender: "female", ageMonths: "", tagNo: "" });
    refresh(); toast(`${noun} added`, "success");
  };
  const addProd = async () => {
    if (!prodForm.weightKg) return;
    await productionService.add({ ...prodForm, enterprise, quantity: Number(prodForm.weightKg) });
    setProdOpen(false); setProdForm({ date: todayStr(), weightKg: "", animalId: "" });
    refresh(); toast("Weight logged", "success");
  };
  const addEvent = async () => {
    await eventService.add({ ...eventForm, enterprise });
    setEventOpen(false); setEventForm({ date: todayStr(), type: eventTypes[0].value, note: "", dueDate: "" });
    refresh(); toast("Event saved", "success");
  };
  const handleDelete = async () => {
    const { id, store } = delTarget;
    if (store === "animals")     await animalService.remove(id);
    if (store === "productions") await productionService.remove(id);
    if (store === "events")      await eventService.remove(id);
    setDelTarget(null); refresh(); toast("Deleted", "info");
  };

  return (
    <>
      <AppBar title={title} onBack={pop} action={
        <button onClick={() => tab === "Herd" ? setAnimalOpen(true) : tab === "Weight Log" ? setProdOpen(true) : setEventOpen(true)}
          style={{ background: fg, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> Add
        </button>
      } />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        <StatTile a={accent} label={`Total ${title}`} value={animals.length} />
        <StatTile a={accent} label={`${female}s`} value={animals.filter((a) => a.gender === "female").length} />
        <StatTile a={accent} label={`${male}s`} value={animals.filter((a) => a.gender === "male").length} />
      </div>

      <div style={{ padding: "6px 16px 0" }}>
        <button onClick={() => push({ kind: "feedBatchList", props: { enterprise } })}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: T.orangeSoft,
            border: "none", borderRadius: T.rMd, padding: "10px 12px", cursor: "pointer", color: T.orange,
            fontFamily: T.body, fontSize: 12.5, fontWeight: 600 }}>
          <Icon name="Package" size={15} /> Feed & FCR for this batch <Icon name="ChevronRight" size={15} style={{ marginLeft: "auto" }} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {TABS.map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {tab === "Herd" && (animals.length === 0
          ? <EmptyHint icon={icon} text={`Add ${noun.toLowerCase()}s to your herd register`} />
          : animals.map((a) => (
            <RecordRow key={a.id} icon={icon} iconColor={fg} iconBg={bg}
              title={a.name}
              subtitle={`${a.gender === "female" ? female : male} · ${a.breed || "Mixed"}${a.ageMonths ? ` · ${a.ageMonths}m` : ""}${a.tagNo ? ` · #${a.tagNo}` : ""}`}
              onDelete={() => setDelTarget({ id: a.id, store: "animals" })} />
          )))}

        {tab === "Weight Log" && (prods.length === 0
          ? <EmptyHint icon="Scale" text="Track weight gain to monitor growth" />
          : prods.slice(0, 30).map((p) => (
            <RecordRow key={p.id} icon="Scale" iconColor={fg} iconBg={bg}
              title={`${p.weightKg} kg`}
              subtitle={`${fmtDate(p.date)}${p.animalId ? ` · ${animals.find((a) => a.id === p.animalId)?.name || ""}` : ""}`}
              onDelete={() => setDelTarget({ id: p.id, store: "productions" })} />
          )))}

        {tab === "Events" && (events.length === 0
          ? <EmptyHint icon="Syringe" text="Log vaccinations, breeding and health events" />
          : events.slice(0, 30).map((ev) => (
            <RecordRow key={ev.id} icon="Syringe" iconColor={fg} iconBg={bg}
              title={(eventTypes.find((t) => t.value === ev.type)?.label) || ev.type}
              subtitle={`${fmtDate(ev.date)}${ev.dueDate ? ` · Due ${fmtDate(ev.dueDate)}` : ""}${ev.note ? ` · ${ev.note}` : ""}`}
              badge={ev.dueDate && ev.dueDate >= todayStr() ? <Pill fg={T.orange} bg={T.orangeSoft}>due</Pill> : null}
              onDelete={() => setDelTarget({ id: ev.id, store: "events" })} />
          )))}
      </div>

      <BottomSheet open={animalOpen} onClose={() => setAnimalOpen(false)} title={`Add ${noun}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Name / ID" placeholder="e.g. Kali" value={animalForm.name} onChange={(v) => setAnimalForm((f) => ({ ...f, name: v }))} />
          <Dropdown label="Gender" value={animalForm.gender} onChange={(v) => setAnimalForm((f) => ({ ...f, gender: v }))}
            options={[{ value: "female", label: `${female} (Female)` }, { value: "male", label: `${male} (Male)` }]} />
          <Dropdown label="Breed" value={animalForm.breed} onChange={(v) => setAnimalForm((f) => ({ ...f, breed: v }))}
            options={["", ...breeds].map((b) => ({ value: b, label: b || "Select breed…" }))} />
          <Input label="Age (months)" type="number" placeholder="0" value={animalForm.ageMonths} onChange={(v) => setAnimalForm((f) => ({ ...f, ageMonths: v }))} />
          <Input label="Tag number" placeholder="Optional" value={animalForm.tagNo} onChange={(v) => setAnimalForm((f) => ({ ...f, tagNo: v }))} />
          <Button full onClick={addAnimal} disabled={!animalForm.name}>Add {noun}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={prodOpen} onClose={() => setProdOpen(false)} title="Log Weight">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label={noun} value={prodForm.animalId} onChange={(v) => setProdForm((f) => ({ ...f, animalId: v }))} options={animalOptions} />
          <Input label="Date" type="date" value={prodForm.date} onChange={(v) => setProdForm((f) => ({ ...f, date: v }))} />
          <Input label="Weight (kg)" type="number" placeholder="0" value={prodForm.weightKg} onChange={(v) => setProdForm((f) => ({ ...f, weightKg: v }))} />
          <Button full onClick={addProd} disabled={!prodForm.weightKg}>Save Weight</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={eventOpen} onClose={() => setEventOpen(false)} title="Add Event">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Date" type="date" value={eventForm.date} onChange={(v) => setEventForm((f) => ({ ...f, date: v }))} />
          <Dropdown label="Event type" value={eventForm.type} onChange={(v) => setEventForm((f) => ({ ...f, type: v }))} options={eventTypes} />
          <Input label="Notes" placeholder="Details…" value={eventForm.note} onChange={(v) => setEventForm((f) => ({ ...f, note: v }))} />
          <Input label="Next due date" type="date" value={eventForm.dueDate} onChange={(v) => setEventForm((f) => ({ ...f, dueDate: v }))} />
          <Button full onClick={addEvent}>Save Event</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delTarget} title="Delete?" onClose={() => setDelTarget(null)}
        actions={[
          { label: "Cancel", variant: "outline", onClick: () => setDelTarget(null) },
          { label: "Delete", variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>This record will be permanently removed.</div>
      </Dialog>
    </>
  );
}
