import { useState, useEffect, useMemo } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, SectionHeader, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { animalService, productionService, eventService } from "../../services/livestock/livestockService.js";
import { rupee } from "../../utils/format.js";

const TABS     = ["Flocks", "Production", "Events"];
const BREEDS   = ["Broiler","Layer","Desi/Country","Kadaknath","Aseel","Other"];
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (d) => new Date(d + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function PoultryManager() {
  const { pop, push, toast } = useApp();
  const [tab, setTab]         = useState("Flocks");
  const [flocks, setFlocks]   = useState([]);
  const [prods, setProds]     = useState([]);
  const [events, setEvents]   = useState([]);
  const [tick, setTick]       = useState(0);
  const refresh = () => setTick((n) => n + 1);

  // Add flock sheet
  const [flockOpen, setFlockOpen] = useState(false);
  const [flockForm, setFlockForm] = useState({ name: "", breed: "", count: "", ageWeeks: "", purpose: "layer" });

  // Add production sheet
  const [prodOpen, setProdOpen]   = useState(false);
  const [prodForm, setProdForm]   = useState({ date: todayStr(), eggs: "", mortality: "", feedKg: "", flockId: "" });

  // Add event sheet
  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ date: todayStr(), type: "vaccination", note: "", dueDate: "" });

  // Delete
  const [delId, setDelId]     = useState(null);
  const [delStore, setDelStore] = useState(null);

  useEffect(() => {
    animalService.getAll("poultry").then(setFlocks);
    productionService.getForEnterprise("poultry", 60).then(setProds);
    eventService.getForEnterprise("poultry").then(setEvents);
  }, [tick]);

  const totalBirds = useMemo(() => flocks.reduce((s, f) => s + (Number(f.count) || 0), 0), [flocks]);
  const monthEggs  = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return prods.filter((p) => p.date.startsWith(prefix)).reduce((s, p) => s + (Number(p.eggs) || 0), 0);
  }, [prods]);

  const addFlock = async () => {
    if (!flockForm.name || !flockForm.count) return;
    await animalService.add({ ...flockForm, enterprise: "poultry" });
    setFlockOpen(false); setFlockForm({ name: "", breed: "", count: "", ageWeeks: "", purpose: "layer" });
    refresh(); toast("Flock added", "success");
  };

  const addProd = async () => {
    if (!prodForm.date) return;
    await productionService.add({ ...prodForm, enterprise: "poultry", quantity: Number(prodForm.eggs) || 0 });
    setProdOpen(false); setProdForm({ date: todayStr(), eggs: "", mortality: "", feedKg: "", flockId: "" });
    refresh(); toast("Production logged", "success");
  };

  const addEvent = async () => {
    if (!eventForm.type) return;
    await eventService.add({ ...eventForm, enterprise: "poultry" });
    setEventOpen(false); setEventForm({ date: todayStr(), type: "vaccination", note: "", dueDate: "" });
    refresh(); toast("Event saved", "success");
  };

  const handleDelete = async () => {
    if (delStore === "animals")     await animalService.remove(delId);
    if (delStore === "productions") await productionService.remove(delId);
    if (delStore === "events")      await eventService.remove(delId);
    setDelId(null); setDelStore(null); refresh(); toast("Deleted", "info");
  };

  const flockOptions = [{ value: "", label: "All flocks" }, ...flocks.map((f) => ({ value: f.id, label: f.name }))];

  return (
    <>
      <AppBar title="Poultry" onBack={pop} action={
        <button onClick={() => tab === "Flocks" ? setFlockOpen(true) : tab === "Production" ? setProdOpen(true) : setEventOpen(true)}
          style={{ background: T.orange, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> Add
        </button>
      } />

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        {[
          { label: "Total Birds", value: totalBirds, icon: "Bird" },
          { label: "Eggs This Month", value: monthEggs.toLocaleString("en-IN"), icon: "Egg" },
          { label: "Flocks", value: flocks.length, icon: "Layers" },
        ].map((s) => (
          <div key={s.label} style={{ flexShrink: 0, background: T.orangeSoft, borderRadius: T.rMd,
            padding: "10px 14px", minWidth: 100 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.orange, fontFamily: T.display }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "6px 16px 0" }}>
        <button onClick={() => push({ kind: "feedBatchList", props: { enterprise: "poultry" } })}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: T.orangeSoft,
            border: "none", borderRadius: T.rMd, padding: "10px 12px", cursor: "pointer", color: T.orange,
            fontFamily: T.body, fontSize: 12.5, fontWeight: 600 }}>
          <Icon name="Package" size={15} /> Feed & FCR for this flock <Icon name="ChevronRight" size={15} style={{ marginLeft: "auto" }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px", overflowX: "auto" }}>
        {TABS.map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* FLOCKS */}
        {tab === "Flocks" && (
          flocks.length === 0
            ? <EmptyHint icon="Bird" text="Add your first flock to start tracking" />
            : flocks.map((f) => (
              <Card key={f.id} pad={14}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: T.orangeSoft,
                      display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Icon name="Bird" size={20} color={T.orange} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>{f.name}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>
                        {f.breed || "Unknown breed"} · {f.count} birds · {f.purpose === "layer" ? "Layer" : "Broiler"}
                        {f.ageWeeks ? ` · ${f.ageWeeks}w old` : ""}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setDelId(f.id); setDelStore("animals"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              </Card>
            ))
        )}

        {/* PRODUCTION */}
        {tab === "Production" && (
          prods.length === 0
            ? <EmptyHint icon="Egg" text="Log daily egg production to track performance" />
            : prods.slice(0, 30).map((p) => (
              <Card key={p.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: T.ink }}>{fmtDate(p.date)}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      🥚 {p.eggs || 0} eggs
                      {p.mortality > 0 && ` · ☠ ${p.mortality} mortality`}
                      {p.feedKg > 0 && ` · 🌾 ${p.feedKg} kg feed`}
                    </div>
                  </div>
                  <button onClick={() => { setDelId(p.id); setDelStore("productions"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              </Card>
            ))
        )}

        {/* EVENTS */}
        {tab === "Events" && (
          events.length === 0
            ? <EmptyHint icon="Syringe" text="Log vaccinations and health events here" />
            : events.slice(0, 30).map((ev) => (
              <Card key={ev.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: T.ink, textTransform: "capitalize" }}>
                      {ev.type.replace(/_/g, " ")}
                    </div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      {fmtDate(ev.date)}{ev.dueDate ? ` · Due: ${fmtDate(ev.dueDate)}` : ""}
                      {ev.note ? ` · ${ev.note}` : ""}
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

      {/* Add Flock Sheet */}
      <BottomSheet open={flockOpen} onClose={() => setFlockOpen(false)} title="Add Flock">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Flock name" placeholder="e.g. Batch A" value={flockForm.name}
            onChange={(v) => setFlockForm((f) => ({ ...f, name: v }))} />
          <Dropdown label="Breed" value={flockForm.breed} onChange={(v) => setFlockForm((f) => ({ ...f, breed: v }))}
            options={["", ...BREEDS].map((b) => ({ value: b, label: b || "Select breed…" }))} />
          <Input label="Number of birds" type="number" placeholder="0" value={flockForm.count}
            onChange={(v) => setFlockForm((f) => ({ ...f, count: v }))} />
          <Input label="Age (weeks)" type="number" placeholder="0" value={flockForm.ageWeeks}
            onChange={(v) => setFlockForm((f) => ({ ...f, ageWeeks: v }))} />
          <Dropdown label="Purpose" value={flockForm.purpose} onChange={(v) => setFlockForm((f) => ({ ...f, purpose: v }))}
            options={[{ value: "layer", label: "Layer (eggs)" }, { value: "broiler", label: "Broiler (meat)" }]} />
          <Button full onClick={addFlock} disabled={!flockForm.name || !flockForm.count}>Add Flock</Button>
        </div>
      </BottomSheet>

      {/* Add Production Sheet */}
      <BottomSheet open={prodOpen} onClose={() => setProdOpen(false)} title="Log Production">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Date" type="date" value={prodForm.date}
            onChange={(v) => setProdForm((f) => ({ ...f, date: v }))} />
          <Dropdown label="Flock (optional)" value={prodForm.flockId}
            onChange={(v) => setProdForm((f) => ({ ...f, flockId: v }))} options={flockOptions} />
          <Input label="Eggs collected" type="number" placeholder="0" value={prodForm.eggs}
            onChange={(v) => setProdForm((f) => ({ ...f, eggs: v }))} />
          <Input label="Mortality" type="number" placeholder="0" value={prodForm.mortality}
            onChange={(v) => setProdForm((f) => ({ ...f, mortality: v }))} />
          <Input label="Feed given (kg)" type="number" placeholder="0" value={prodForm.feedKg}
            onChange={(v) => setProdForm((f) => ({ ...f, feedKg: v }))} />
          <Button full onClick={addProd} disabled={!prodForm.date}>Save Log</Button>
        </div>
      </BottomSheet>

      {/* Add Event Sheet */}
      <BottomSheet open={eventOpen} onClose={() => setEventOpen(false)} title="Add Event">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Date" type="date" value={eventForm.date}
            onChange={(v) => setEventForm((f) => ({ ...f, date: v }))} />
          <Dropdown label="Event type" value={eventForm.type}
            onChange={(v) => setEventForm((f) => ({ ...f, type: v }))}
            options={[
              { value: "vaccination", label: "Vaccination" },
              { value: "deworming",   label: "Deworming" },
              { value: "treatment",   label: "Treatment" },
              { value: "sale",        label: "Sale" },
              { value: "purchase",    label: "Purchase" },
              { value: "other",       label: "Other" },
            ]} />
          <Input label="Notes" placeholder="Details…" value={eventForm.note}
            onChange={(v) => setEventForm((f) => ({ ...f, note: v }))} />
          <Input label="Next due date (optional)" type="date" value={eventForm.dueDate}
            onChange={(v) => setEventForm((f) => ({ ...f, dueDate: v }))} />
          <Button full onClick={addEvent}>Save Event</Button>
        </div>
      </BottomSheet>

      {/* Delete confirm */}
      <Dialog open={!!delId} title="Delete?" onClose={() => { setDelId(null); setDelStore(null); }}
        actions={[
          { label: "Cancel",  variant: "outline", onClick: () => { setDelId(null); setDelStore(null); } },
          { label: "Delete",  variant: "danger",  onClick: handleDelete },
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
