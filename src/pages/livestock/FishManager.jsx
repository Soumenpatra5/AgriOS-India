import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, Button } from "../../components/index.js";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { animalService, productionService, eventService } from "../../services/livestock/livestockService.js";
import { rupee } from "../../utils/format.js";

const TABS    = ["Ponds", "Feed Log", "Harvests"];
const SPECIES = ["Rohu","Katla","Mrigal","Common Carp","Pangasius","Tilapia","Catfish","Prawn","Other"];
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (d) => new Date(d + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function FishManager() {
  const { pop, push, toast } = useApp();
  const [tab, setTab]       = useState("Ponds");
  const [ponds, setPonds]   = useState([]);
  const [prods, setProds]   = useState([]);
  const [events, setEvents] = useState([]);
  const [tick, setTick]     = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [pondOpen, setPondOpen] = useState(false);
  const [pondForm, setPondForm] = useState({ name: "", species: "", sizeAcres: "", stockingCount: "", stockingDate: todayStr() });

  const [prodOpen, setProdOpen] = useState(false);
  const [prodForm, setProdForm] = useState({ date: todayStr(), feedKg: "", pondId: "", waterQuality: "good" });

  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ date: todayStr(), type: "harvest", weightKg: "", pricePerKg: "", note: "" });

  const [delId, setDelId]     = useState(null);
  const [delStore, setDelStore] = useState(null);

  useEffect(() => {
    animalService.getAll("fish").then(setPonds);
    productionService.getForEnterprise("fish", 60).then(setProds);
    eventService.getForEnterprise("fish").then(setEvents);
  }, [tick]);

  const pondOptions = [{ value: "", label: "Select pond…" }, ...ponds.map((p) => ({ value: p.id, label: p.name }))];

  const addPond = async () => {
    if (!pondForm.name) return;
    await animalService.add({ ...pondForm, enterprise: "fish" });
    setPondOpen(false); setPondForm({ name: "", species: "", sizeAcres: "", stockingCount: "", stockingDate: todayStr() });
    refresh(); toast("Pond added", "success");
  };

  const addProd = async () => {
    if (!prodForm.feedKg) return;
    await productionService.add({ ...prodForm, enterprise: "fish", quantity: Number(prodForm.feedKg) });
    setProdOpen(false); setProdForm({ date: todayStr(), feedKg: "", pondId: "", waterQuality: "good" });
    refresh(); toast("Feed log saved", "success");
  };

  const addEvent = async () => {
    if (!eventForm.type) return;
    await eventService.add({ ...eventForm, enterprise: "fish" });
    setEventOpen(false); setEventForm({ date: todayStr(), type: "harvest", weightKg: "", pricePerKg: "", note: "" });
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
      <AppBar title="Fish / Aquaculture" onBack={pop} action={
        <button onClick={() => tab === "Ponds" ? setPondOpen(true) : tab === "Feed Log" ? setProdOpen(true) : setEventOpen(true)}
          style={{ background: T.blue, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> Add
        </button>
      } />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        {[
          { label: "Ponds", value: ponds.length },
          { label: "Feed Logs", value: prods.length },
          { label: "Harvests", value: events.filter((e) => e.type === "harvest").length },
        ].map((s) => (
          <div key={s.label} style={{ flexShrink: 0, background: T.blueSoft, borderRadius: T.rMd, padding: "10px 14px", minWidth: 90 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.blue, fontFamily: T.display }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "6px 16px 0" }}>
        <button onClick={() => push({ kind: "feedBatchList", props: { enterprise: "fish" } })}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: T.blueSoft,
            border: "none", borderRadius: T.rMd, padding: "10px 12px", cursor: "pointer", color: T.blue,
            fontFamily: T.body, fontSize: 12.5, fontWeight: 600 }}>
          <Icon name="Package" size={15} /> Feed & FCR for this pond <Icon name="ChevronRight" size={15} style={{ marginLeft: "auto" }} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {TABS.map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {tab === "Ponds" && (
          ponds.length === 0
            ? <EmptyHint icon="Fish" text="Add your first pond or tank to start tracking" />
            : ponds.map((p) => (
              <Card key={p.id} pad={14}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: T.blueSoft, display: "grid", placeItems: "center" }}>
                      <Icon name="Fish" size={20} color={T.blue} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>
                        {p.species || "Mixed species"}{p.sizeAcres ? ` · ${p.sizeAcres} acres` : ""}
                        {p.stockingCount ? ` · ${Number(p.stockingCount).toLocaleString("en-IN")} stocked` : ""}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setDelId(p.id); setDelStore("animals"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              </Card>
            ))
        )}

        {tab === "Feed Log" && (
          prods.length === 0
            ? <EmptyHint icon="Package" text="Log daily feed to calculate FCR and costs" />
            : prods.slice(0, 30).map((p) => (
              <Card key={p.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(p.date)}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>
                      🌾 {p.feedKg} kg feed · Water: {p.waterQuality}
                      {p.pondId ? ` · ${ponds.find((x) => x.id === p.pondId)?.name || ""}` : ""}
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

        {tab === "Harvests" && (
          events.length === 0
            ? <EmptyHint icon="ShoppingBag" text="Log harvests, treatments and other events" />
            : events.slice(0, 30).map((ev) => (
              <Card key={ev.id} pad={12}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{ev.type.replace(/_/g, " ")}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>
                      {fmtDate(ev.date)}
                      {ev.weightKg ? ` · ${ev.weightKg} kg` : ""}
                      {ev.pricePerKg ? ` · ${rupee(ev.pricePerKg)}/kg` : ""}
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

      <BottomSheet open={pondOpen} onClose={() => setPondOpen(false)} title="Add Pond / Tank">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Pond name" placeholder="e.g. Pond 1" value={pondForm.name} onChange={(v) => setPondForm((f) => ({ ...f, name: v }))} />
          <Dropdown label="Species" value={pondForm.species} onChange={(v) => setPondForm((f) => ({ ...f, species: v }))}
            options={["", ...SPECIES].map((s) => ({ value: s, label: s || "Select species…" }))} />
          <Input label="Size (acres)" type="number" placeholder="0" value={pondForm.sizeAcres} onChange={(v) => setPondForm((f) => ({ ...f, sizeAcres: v }))} />
          <Input label="Stocking count" type="number" placeholder="0" value={pondForm.stockingCount} onChange={(v) => setPondForm((f) => ({ ...f, stockingCount: v }))} />
          <Input label="Stocking date" type="date" value={pondForm.stockingDate} onChange={(v) => setPondForm((f) => ({ ...f, stockingDate: v }))} />
          <Button full onClick={addPond} disabled={!pondForm.name}>Add Pond</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={prodOpen} onClose={() => setProdOpen(false)} title="Log Daily Feed">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Date" type="date" value={prodForm.date} onChange={(v) => setProdForm((f) => ({ ...f, date: v }))} />
          <Dropdown label="Pond" value={prodForm.pondId} onChange={(v) => setProdForm((f) => ({ ...f, pondId: v }))} options={pondOptions} />
          <Input label="Feed given (kg)" type="number" placeholder="0" value={prodForm.feedKg} onChange={(v) => setProdForm((f) => ({ ...f, feedKg: v }))} />
          <Dropdown label="Water quality" value={prodForm.waterQuality} onChange={(v) => setProdForm((f) => ({ ...f, waterQuality: v }))}
            options={[{ value: "good", label: "Good" }, { value: "fair", label: "Fair" }, { value: "poor", label: "Poor" }]} />
          <Button full onClick={addProd} disabled={!prodForm.feedKg}>Save Log</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={eventOpen} onClose={() => setEventOpen(false)} title="Add Event">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Date" type="date" value={eventForm.date} onChange={(v) => setEventForm((f) => ({ ...f, date: v }))} />
          <Dropdown label="Type" value={eventForm.type} onChange={(v) => setEventForm((f) => ({ ...f, type: v }))}
            options={[
              { value: "harvest",   label: "Harvest" },
              { value: "treatment", label: "Treatment / Lime" },
              { value: "restocking",label: "Restocking" },
              { value: "other",     label: "Other" },
            ]} />
          <Input label="Weight harvested (kg)" type="number" placeholder="0" value={eventForm.weightKg} onChange={(v) => setEventForm((f) => ({ ...f, weightKg: v }))} />
          <Input label="Sale price (₹/kg)" type="number" placeholder="0" value={eventForm.pricePerKg} onChange={(v) => setEventForm((f) => ({ ...f, pricePerKg: v }))} />
          <Input label="Notes" placeholder="Details…" value={eventForm.note} onChange={(v) => setEventForm((f) => ({ ...f, note: v }))} />
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
