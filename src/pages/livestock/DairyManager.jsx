import { useState, useEffect, useMemo } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, SectionHeader, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { animalService, productionService, eventService } from "../../services/livestock/livestockService.js";
import { rupee } from "../../utils/format.js";

const TABS   = ["Animals", "Milk Log", "Events"];
const BREEDS = ["HF / Holstein","Jersey","Sahiwal","Gir","Murrah Buffalo","Surti Buffalo","Mixed","Other"];
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (d) => new Date(d + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function DairyManager() {
  const { pop, push, toast } = useApp();
  const [tab, setTab]       = useState("Animals");
  const [animals, setAnimals] = useState([]);
  const [prods, setProds]   = useState([]);
  const [events, setEvents] = useState([]);
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [animalOpen, setAnimalOpen] = useState(false);
  const [animalForm, setAnimalForm] = useState({ name: "", breed: "", type: "cow", tagNo: "", lactationStatus: "lactating" });

  const [prodOpen, setProdOpen] = useState(false);
  const [prodForm, setProdForm] = useState({ date: todayStr(), amLitres: "", pmLitres: "", animalId: "", salePrice: "" });

  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ date: todayStr(), type: "vaccination", note: "", dueDate: "" });

  const [delId, setDelId]     = useState(null);
  const [delStore, setDelStore] = useState(null);

  useEffect(() => {
    animalService.getAll("dairy").then(setAnimals);
    productionService.getForEnterprise("dairy", 60).then(setProds);
    eventService.getForEnterprise("dairy").then(setEvents);
  }, [tick]);

  const totalAnimals = animals.length;
  const monthMilk = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return prods.filter((p) => p.date.startsWith(prefix))
      .reduce((s, p) => s + (Number(p.amLitres) || 0) + (Number(p.pmLitres) || 0), 0);
  }, [prods]);

  const animalOptions = [{ value: "", label: "All animals" }, ...animals.map((a) => ({ value: a.id, label: `${a.name} (${a.type})` }))];

  const addAnimal = async () => {
    if (!animalForm.name) return;
    await animalService.add({ ...animalForm, enterprise: "dairy" });
    setAnimalOpen(false); setAnimalForm({ name: "", breed: "", type: "cow", tagNo: "", lactationStatus: "lactating" });
    refresh(); toast("Animal added", "success");
  };

  const addProd = async () => {
    if (!prodForm.date) return;
    const total = (Number(prodForm.amLitres) || 0) + (Number(prodForm.pmLitres) || 0);
    await productionService.add({ ...prodForm, enterprise: "dairy", quantity: total });
    setProdOpen(false); setProdForm({ date: todayStr(), amLitres: "", pmLitres: "", animalId: "", salePrice: "" });
    refresh(); toast("Milk log saved", "success");
  };

  const addEvent = async () => {
    await eventService.add({ ...eventForm, enterprise: "dairy" });
    setEventOpen(false); setEventForm({ date: todayStr(), type: "vaccination", note: "", dueDate: "" });
    refresh(); toast("Event saved", "success");
  };

  const handleDelete = async () => {
    if (delStore === "animals")     await animalService.remove(delId);
    if (delStore === "productions") await productionService.remove(delId);
    if (delStore === "events")      await eventService.remove(delId);
    setDelId(null); setDelStore(null); refresh(); toast("Deleted", "info");
  };

  return (
    <>
      <AppBar title="Dairy" onBack={pop} action={
        <button onClick={() => tab === "Animals" ? setAnimalOpen(true) : tab === "Milk Log" ? setProdOpen(true) : setEventOpen(true)}
          style={{ background: T.blue, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> Add
        </button>
      } />

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        {[
          { label: "Animals", value: totalAnimals },
          { label: "Milk This Month (L)", value: monthMilk.toFixed(1) },
          { label: "Events", value: events.length },
        ].map((s) => (
          <div key={s.label} style={{ flexShrink: 0, background: T.blueSoft, borderRadius: T.rMd, padding: "10px 14px", minWidth: 100 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.blue, fontFamily: T.display }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "6px 16px 0" }}>
        <button onClick={() => push({ kind: "feedBatchList", props: { enterprise: "dairy" } })}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: T.blueSoft,
            border: "none", borderRadius: T.rMd, padding: "10px 12px", cursor: "pointer", color: T.blue,
            fontFamily: T.body, fontSize: 12.5, fontWeight: 600 }}>
          <Icon name="Package" size={15} /> Feed & FCR for this herd <Icon name="ChevronRight" size={15} style={{ marginLeft: "auto" }} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {TABS.map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {tab === "Animals" && (
          animals.length === 0
            ? <EmptyHint icon="Milk" text="Add your first cow or buffalo to start tracking" />
            : animals.map((a) => (
              <Card key={a.id} pad={14}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: T.blueSoft, display: "grid", placeItems: "center" }}>
                      <Icon name="Milk" size={20} color={T.blue} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>
                        {a.type === "cow" ? "Cow" : "Buffalo"} · {a.breed || "Unknown breed"}
                        {a.tagNo ? ` · Tag #${a.tagNo}` : ""}
                        <span style={{ marginLeft: 6, background: a.lactationStatus === "lactating" ? T.primarySoft : T.surface2,
                          color: a.lactationStatus === "lactating" ? T.primary : T.inkSoft,
                          borderRadius: 5, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>
                          {a.lactationStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setDelId(a.id); setDelStore("animals"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              </Card>
            ))
        )}

        {tab === "Milk Log" && (
          prods.length === 0
            ? <EmptyHint icon="Milk" text="Log morning and evening milk to track yield" />
            : prods.slice(0, 30).map((p) => {
              const total = (Number(p.amLitres) || 0) + (Number(p.pmLitres) || 0);
              return (
                <Card key={p.id} pad={12}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(p.date)}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                        🌅 {p.amLitres || 0}L AM · 🌆 {p.pmLitres || 0}L PM · Total: {total.toFixed(1)}L
                        {p.salePrice > 0 && ` · ${rupee(p.salePrice)}/L`}
                      </div>
                    </div>
                    <button onClick={() => { setDelId(p.id); setDelStore("productions"); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                      <Icon name="Trash2" size={15} />
                    </button>
                  </div>
                </Card>
              );
            })
        )}

        {tab === "Events" && (
          events.length === 0
            ? <EmptyHint icon="Syringe" text="Log vaccinations, AI, and health events" />
            : events.slice(0, 30).map((ev) => (
              <Card key={ev.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{ev.type.replace(/_/g, " ")}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      {fmtDate(ev.date)}{ev.note ? ` · ${ev.note}` : ""}
                    </div>
                  </div>
                  <button onClick={() => { setDelId(ev.id); setDelStore("events"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              </Card>
            ))
        )}
      </div>

      <BottomSheet open={animalOpen} onClose={() => setAnimalOpen(false)} title="Add Animal">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Name / ID" placeholder="e.g. Lakshmi" value={animalForm.name} onChange={(v) => setAnimalForm((f) => ({ ...f, name: v }))} />
          <Dropdown label="Type" value={animalForm.type} onChange={(v) => setAnimalForm((f) => ({ ...f, type: v }))}
            options={[{ value: "cow", label: "Cow" }, { value: "buffalo", label: "Buffalo" }]} />
          <Dropdown label="Breed" value={animalForm.breed} onChange={(v) => setAnimalForm((f) => ({ ...f, breed: v }))}
            options={["", ...BREEDS].map((b) => ({ value: b, label: b || "Select breed…" }))} />
          <Input label="Tag / Ear number" placeholder="Optional" value={animalForm.tagNo} onChange={(v) => setAnimalForm((f) => ({ ...f, tagNo: v }))} />
          <Dropdown label="Status" value={animalForm.lactationStatus} onChange={(v) => setAnimalForm((f) => ({ ...f, lactationStatus: v }))}
            options={[{ value: "lactating", label: "Lactating" }, { value: "dry", label: "Dry" }, { value: "pregnant", label: "Pregnant" }]} />
          <Button full onClick={addAnimal} disabled={!animalForm.name}>Add Animal</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={prodOpen} onClose={() => setProdOpen(false)} title="Log Milk Production">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Date" type="date" value={prodForm.date} onChange={(v) => setProdForm((f) => ({ ...f, date: v }))} />
          <Dropdown label="Animal (optional)" value={prodForm.animalId} onChange={(v) => setProdForm((f) => ({ ...f, animalId: v }))} options={animalOptions} />
          <Input label="Morning milk (litres)" type="number" placeholder="0" value={prodForm.amLitres} onChange={(v) => setProdForm((f) => ({ ...f, amLitres: v }))} />
          <Input label="Evening milk (litres)" type="number" placeholder="0" value={prodForm.pmLitres} onChange={(v) => setProdForm((f) => ({ ...f, pmLitres: v }))} />
          <Input label="Sale price (₹/L)" type="number" placeholder="0" value={prodForm.salePrice} onChange={(v) => setProdForm((f) => ({ ...f, salePrice: v }))} />
          <Button full onClick={addProd}>Save Log</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={eventOpen} onClose={() => setEventOpen(false)} title="Add Event">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Date" type="date" value={eventForm.date} onChange={(v) => setEventForm((f) => ({ ...f, date: v }))} />
          <Dropdown label="Event type" value={eventForm.type} onChange={(v) => setEventForm((f) => ({ ...f, type: v }))}
            options={[
              { value: "vaccination", label: "Vaccination" },
              { value: "ai_breeding", label: "AI Breeding" },
              { value: "pregnancy_check", label: "Pregnancy Check" },
              { value: "calving", label: "Calving" },
              { value: "treatment", label: "Treatment" },
              { value: "deworming", label: "Deworming" },
              { value: "other", label: "Other" },
            ]} />
          <Input label="Notes" placeholder="Details…" value={eventForm.note} onChange={(v) => setEventForm((f) => ({ ...f, note: v }))} />
          <Input label="Next due date" type="date" value={eventForm.dueDate} onChange={(v) => setEventForm((f) => ({ ...f, dueDate: v }))} />
          <Button full onClick={addEvent}>Save Event</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title="Delete?" onClose={() => { setDelId(null); setDelStore(null); }}
        actions={[
          { label: "Cancel", variant: "outline", onClick: () => { setDelId(null); setDelStore(null); } },
          { label: "Delete", variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>This record will be permanently removed.</div>
      </Dialog>
    </>
  );
}

function EmptyHint({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: T.inkFaint }}>
      <Icon name={icon} size={36} color={T.line} />
      <div style={{ marginTop: 12, fontSize: 13 }}>{text}</div>
    </div>
  );
}
