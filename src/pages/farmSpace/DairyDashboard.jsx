import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { dairyApi } from "../../services/dairy/dairyApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const today = () => new Date().toISOString().slice(0, 10);

/* Status colour tokens — dairy animals have ongoing lifecycle statuses. */
const STATUS_CFG = {
  heifer:   { label: { en: "Heifer",   hi: "बछिया",   bn: "হেফার"   }, fg: T.inkSoft,   bg: T.surface2 },
  milking:  { label: { en: "Milking",  hi: "दुधारू",   bn: "দুগ্ধবতী" }, fg: T.primary,   bg: T.primarySoft },
  dry:      { label: { en: "Dry",      hi: "शुष्क",    bn: "শুষ্ক"   }, fg: T.blue,      bg: T.blueSoft },
  sold:     { label: { en: "Sold",     hi: "बेचा",     bn: "বিক্রিত" }, fg: "#6b6b6b",   bg: "#f0f0f0" },
  deceased: { label: { en: "Deceased", hi: "मृत",      bn: "মৃত"     }, fg: "#6b6b6b",   bg: "#f0f0f0" },
  retired:  { label: { en: "Retired",  hi: "सेवानिवृत्त", bn: "অবসরপ্রাপ্ত" }, fg: "#6b6b6b", bg: "#f0f0f0" },
};

const FILTER_TABS = [
  { id: "",         label: { en: "All",     hi: "सभी",   bn: "সব"     } },
  { id: "milking",  label: { en: "Milking", hi: "दुधारू", bn: "দুগ্ধবতী" } },
  { id: "dry",      label: { en: "Dry",     hi: "शुष्क",  bn: "শুষ্ক"  } },
  { id: "heifer",   label: { en: "Heifer",  hi: "बछिया",  bn: "হেফার"  } },
];

const BREEDS = [
  { value: "HF / Holstein",  label: { en: "HF / Holstein",  hi: "एचएफ / होल्स्टीन", bn: "এইচএফ / হোলস্টেইন" } },
  { value: "Jersey",         label: { en: "Jersey",         hi: "जर्सी",            bn: "জার্সি"            } },
  { value: "Sahiwal",        label: { en: "Sahiwal",        hi: "साहीवाल",          bn: "সাহিওয়াল"         } },
  { value: "Gir",            label: { en: "Gir",            hi: "गिर",              bn: "গির"               } },
  { value: "Murrah Buffalo", label: { en: "Murrah Buffalo", hi: "मुर्रा भैंस",       bn: "মুররা মহিষ"        } },
  { value: "Surti Buffalo",  label: { en: "Surti Buffalo",  hi: "सुरती भैंस",        bn: "সুরতি মহিষ"        } },
  { value: "Mixed",          label: { en: "Mixed",          hi: "मिश्रित",          bn: "মিশ্র"             } },
  { value: "Other",          label: { en: "Other",          hi: "अन्य",             bn: "অন্যান্য"          } },
];

function StatusChip({ status, tc }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.heifer;
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, fontFamily: T.body,
      color: cfg.fg, background: cfg.bg,
      borderRadius: 5, padding: "2px 7px", letterSpacing: 0.3,
    }}>
      {tc(cfg.label)}
    </span>
  );
}

function MetricTile({ value, label, icon, accent }) {
  const fg = accent === "primary" ? T.primary : accent === "blue" ? T.blue : T.orange;
  const bg = accent === "primary" ? T.primarySoft : accent === "blue" ? T.blueSoft : "#fff3e8";
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, background: bg, borderRadius: T.rMd, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon name={icon} size={14} color={fg} />
        <span style={{ fontSize: 10.5, color: fg, fontWeight: 600, fontFamily: T.body }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: fg, fontFamily: T.display, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

export default function DairyDashboard() {
  const { pop, push, tc, toast } = useApp();

  const [space, setSpace]     = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [filter, setFilter]   = useState("");
  const [state, setState]     = useState("loading");
  const [reason, setReason]   = useState(null);

  /* Add animal sheet */
  const [addOpen, setAddOpen]   = useState(false);
  const [aform, setAform] = useState({
    name: "", species: "cow", breed: "", tagId: "", dob: "",
    acquisitionDate: today(), acquisitionSource: "", currentStatus: "heifer", notes: "",
  });
  const [abusy, setAbusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const [m, list] = await Promise.all([
        dairyApi.herdMetrics(active.id),
        dairyApi.listAnimals(active.id, { includeTerminal: false }),
      ]);
      setMetrics(m);
      setAnimals(list || []);
      setState("ready");
    } catch (err) {
      if (state !== "ready") { setReason(err?.reason || FARM_ERROR.FAILED); setState("error"); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const canManage = space && farmSpaceService.can(space, "farm.dairy.manage");

  const filtered = filter
    ? animals.filter((a) => a.current_status === filter)
    : animals;

  const addAnimal = async () => {
    if (!aform.name.trim()) return;
    setAbusy(true);
    try {
      const animal = await dairyApi.createAnimal(space.id, {
        name: aform.name.trim(),
        species: aform.species,
        breed: aform.breed || null,
        tagId: aform.tagId || null,
        dob: aform.dob || null,
        acquisitionDate: aform.acquisitionDate || null,
        acquisitionSource: aform.acquisitionSource || null,
        currentStatus: aform.currentStatus,
        notes: aform.notes || null,
      });
      setAnimals((prev) => [animal, ...prev]);
      setAddOpen(false);
      setAform({ name: "", species: "cow", breed: "", tagId: "", dob: "",
        acquisitionDate: today(), acquisitionSource: "", currentStatus: "heifer", notes: "" });
      toast(tc({ en: "Animal added", hi: "पशु जोड़ा गया", bn: "প্রাণী যোগ হয়েছে" }), "success");
      /* Refresh metrics */
      dairyApi.herdMetrics(space.id).then(setMetrics).catch(() => {});
    } catch (err) {
      toast(err.message || tc({ en: "Failed to add animal", hi: "पशु नहीं जोड़ा जा सका", bn: "প্রাণী যোগ করা যায়নি" }), "error");
    } finally {
      setAbusy(false);
    }
  };

  const bar = (
    <AppBar
      title={tc({ en: "Dairy Herd", hi: "डेयरी पशु", bn: "ডেয়ারি পাল" })}
      onBack={pop}
      action={canManage && (
        <button
          onClick={() => setAddOpen(true)}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" />
          {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      )}
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error")   return <>{bar}<div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;

  return (
    <>
      {bar}

      {/* Metrics strip */}
      {metrics && (
        <div style={{ display: "flex", gap: 8, padding: "10px 16px 0" }}>
          <MetricTile
            value={Object.values(metrics.status_counts || {}).reduce((s, n) => s + n, 0)}
            label={tc({ en: "Animals", hi: "पशु", bn: "প্রাণী" })}
            icon="Milk" accent="primary" />
          <MetricTile
            value={metrics.today_milk_kg != null ? `${Number(metrics.today_milk_kg).toFixed(1)} kg` : "—"}
            label={tc({ en: "Today milk", hi: "आज दूध", bn: "আজ দুধ" })}
            icon="Droplets" accent="blue" />
          <MetricTile
            value={metrics.month_milk_kg != null ? `${Number(metrics.month_milk_kg).toFixed(0)} kg` : "—"}
            label={tc({ en: "This month", hi: "इस माह", bn: "এ মাসে" })}
            icon="TrendingUp" accent="orange" />
        </div>
      )}

      {/* Health due alert */}
      {metrics?.health_due_in_14_days > 0 && (
        <div style={{ margin: "8px 16px 0", background: "#fff3e8", borderRadius: T.rMd,
          padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="Bell" size={15} color={T.orange} />
          <span style={{ fontSize: 12.5, color: T.orange, fontWeight: 600, fontFamily: T.body }}>
            {tc({
              en: `${metrics.health_due_in_14_days} health event${metrics.health_due_in_14_days > 1 ? "s" : ""} due in 14 days`,
              hi: `14 दिन में ${metrics.health_due_in_14_days} स्वास्थ्य घटना देय`,
              bn: `14 দিনে ${metrics.health_due_in_14_days}টি স্বাস্থ্য ঘটনা দেয়`,
            })}
          </span>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px", overflowX: "auto" }}>
        {FILTER_TABS.map((ft) => (
          <Chip key={ft.id} active={filter === ft.id} onClick={() => setFilter(ft.id)}>
            {tc(ft.label)}
          </Chip>
        ))}
      </div>

      {/* Animal list */}
      <div style={{ padding: "6px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="Milk"
            title={tc({ en: "No animals", hi: "कोई पशु नहीं", bn: "কোনো প্রাণী নেই" })}
            body={canManage
              ? tc({ en: "Tap + Add to register your first cow or buffalo.", hi: "पहली गाय या भैंस जोड़ने के लिए + जोड़ें दबाएँ।", bn: "প্রথম গরু বা মহিষ নিবন্ধন করতে + যোগ চাপুন।" })
              : tc({ en: "The herd is empty.", hi: "झुंड खाली है।", bn: "পাল খালি।" })}
          />
        ) : (
          filtered.map((animal) => (
            <AnimalCard key={animal.id} animal={animal} tc={tc} onPress={() =>
              push({ kind: "dairyAnimalDetail", props: { animalId: animal.id, spaceId: space.id } })
            } />
          ))
        )}
      </div>

      {/* Add animal sheet */}
      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={tc({ en: "Add Animal", hi: "पशु जोड़ें", bn: "প্রাণী যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label={tc({ en: "Name / ID", hi: "नाम / आईडी", bn: "নাম / আইডি" })}
            placeholder={tc({ en: "e.g. Lakshmi", hi: "उदा. लक्ष्मी", bn: "যেমন লক্ষ্মী" })}
            value={aform.name}
            onChange={(v) => setAform((f) => ({ ...f, name: v }))} />
          <Dropdown
            label={tc({ en: "Species", hi: "प्रजाति", bn: "প্রজাতি" })}
            value={aform.species}
            onChange={(v) => setAform((f) => ({ ...f, species: v }))}
            options={[
              { value: "cow",     label: tc({ en: "Cow",     hi: "गाय",  bn: "গরু"   }) },
              { value: "buffalo", label: tc({ en: "Buffalo", hi: "भैंस", bn: "মহিষ" }) },
            ]} />
          <Dropdown
            label={tc({ en: "Breed (optional)", hi: "नस्ल (वैकल्पिक)", bn: "জাত (ঐচ্ছিক)" })}
            value={aform.breed}
            onChange={(v) => setAform((f) => ({ ...f, breed: v }))}
            options={[
              { value: "", label: tc({ en: "Unknown / Mixed", hi: "अज्ञात / मिश्रित", bn: "অজানা / মিশ্র" }) },
              ...BREEDS.map((b) => ({ value: b.value, label: tc(b.label) })),
            ]} />
          <Input
            label={tc({ en: "Tag / Ear number (optional)", hi: "टैग / कान नंबर (वैकल्पिक)", bn: "ট্যাগ / কান নম্বর (ঐচ্ছিক)" })}
            placeholder={tc({ en: "e.g. 042", hi: "उदा. 042", bn: "যেমন 042" })}
            value={aform.tagId}
            onChange={(v) => setAform((f) => ({ ...f, tagId: v }))} />
          <Dropdown
            label={tc({ en: "Current status", hi: "वर्तमान स्थिति", bn: "বর্তমান অবস্থা" })}
            value={aform.currentStatus}
            onChange={(v) => setAform((f) => ({ ...f, currentStatus: v }))}
            options={[
              { value: "heifer",  label: tc({ en: "Heifer",  hi: "बछिया",  bn: "হেফার"   }) },
              { value: "milking", label: tc({ en: "Milking", hi: "दुधारू",  bn: "দুগ্ধবতী" }) },
              { value: "dry",     label: tc({ en: "Dry",     hi: "शुष्क",   bn: "শুষ্ক"   }) },
            ]} />
          <Input
            label={tc({ en: "Date of birth (optional)", hi: "जन्म तिथि (वैकल्पिक)", bn: "জন্ম তারিখ (ঐচ্ছিক)" })}
            type="date"
            value={aform.dob}
            onChange={(v) => setAform((f) => ({ ...f, dob: v }))} />
          <Input
            label={tc({ en: "Acquisition date", hi: "प्राप्ति तिथि", bn: "অধিগ্রহণের তারিখ" })}
            type="date"
            value={aform.acquisitionDate}
            onChange={(v) => setAform((f) => ({ ...f, acquisitionDate: v }))} />
          <Input
            label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            placeholder={tc({ en: "Any notes about this animal", hi: "इस पशु के बारे में टिप्पणी", bn: "এই প্রাণী সম্পর্কে মন্তব্য" })}
            value={aform.notes}
            onChange={(v) => setAform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addAnimal} disabled={!aform.name.trim() || abusy}>
            {abusy
              ? tc({ en: "Adding…", hi: "जोड़ा जा रहा है…", bn: "যোগ হচ্ছে…" })
              : tc({ en: "Add Animal", hi: "पशु जोड़ें", bn: "প্রাণী যোগ করুন" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

function AnimalCard({ animal, tc, onPress }) {
  const cfg = STATUS_CFG[animal.current_status] || STATUS_CFG.heifer;
  const speciesLabel = animal.species === "buffalo"
    ? tc({ en: "Buffalo", hi: "भैंस", bn: "মহিষ" })
    : tc({ en: "Cow", hi: "गाय", bn: "গরু" });

  return (
    <Card pad={0}>
      <button
        onClick={onPress}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px",
          background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: T.body }}>
        {/* Avatar */}
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: cfg.bg, display: "grid", placeItems: "center" }}>
          <Icon name="Milk" size={20} color={cfg.fg} />
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>{animal.name}</span>
            <StatusChip status={animal.current_status} tc={tc} />
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
            {speciesLabel}
            {animal.breed ? ` · ${animal.breed}` : ""}
            {animal.tag_id ? ` · #${animal.tag_id}` : ""}
          </div>
        </div>
        <Icon name="ChevronRight" size={16} color={T.line} />
      </button>
    </Card>
  );
}
