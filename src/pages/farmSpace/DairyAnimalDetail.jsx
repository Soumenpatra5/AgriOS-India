import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet, Dialog,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { dairyApi } from "../../services/dairy/dairyApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const today = () => new Date().toISOString().slice(0, 10);

const fmtDate = (d, locale = "en-IN") => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }); }
  catch { return String(d).slice(0, 10); }
};

const fmtDateShort = (d, locale = "en-IN") => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short" }); }
  catch { return String(d).slice(0, 10); }
};

/* Terminal statuses — no further writes; still readable. */
const TERMINAL = new Set(["sold", "deceased", "retired"]);

const STATUS_CFG = {
  heifer:   { label: { en: "Heifer",   hi: "बछिया",      bn: "হেফার"    }, fg: T.inkSoft, bg: T.surface2 },
  milking:  { label: { en: "Milking",  hi: "दुधारू",      bn: "দুগ্ধবতী"  }, fg: T.primary, bg: T.primarySoft },
  dry:      { label: { en: "Dry",      hi: "शुष्क",       bn: "শুষ্ক"    }, fg: T.blue,    bg: T.blueSoft },
  sold:     { label: { en: "Sold",     hi: "बेचा",        bn: "বিক্রিত"  }, fg: "#6b6b6b", bg: "#f0f0f0" },
  deceased: { label: { en: "Deceased", hi: "मृत",         bn: "মৃত"      }, fg: "#6b6b6b", bg: "#f0f0f0" },
  retired:  { label: { en: "Retired",  hi: "सेवानिवृत्त", bn: "অবসরপ্রাপ্ত" }, fg: "#6b6b6b", bg: "#f0f0f0" },
};

const ALL_STATUSES = [
  { value: "heifer",   label: { en: "Heifer",   hi: "बछिया",      bn: "হেফার"    } },
  { value: "milking",  label: { en: "Milking",  hi: "दुधारू",      bn: "দুগ্ধবতী"  } },
  { value: "dry",      label: { en: "Dry",      hi: "शुष्क",       bn: "শুষ্ক"    } },
  { value: "sold",     label: { en: "Sold",     hi: "बेचा",        bn: "বিক্রিত"  } },
  { value: "deceased", label: { en: "Deceased", hi: "मृत",         bn: "মৃত"      } },
  { value: "retired",  label: { en: "Retired",  hi: "सेवानिवृत्त", bn: "অবসরপ্রাপ্ত" } },
];

const HISTORY_KIND_ICON = {
  milk_record:  { icon: "Droplets",  color: T.blue },
  repro_event:  { icon: "Heart",     color: "#e05",  },
  health_event: { icon: "Syringe",   color: T.orange },
  lactation:    { icon: "Baby",      color: T.primary },
};

const KIND_LABEL = {
  milk_record:  { en: "Milk record",       hi: "दूध रिकॉर्ड",   bn: "দুধ রেকর্ড"   },
  repro_event:  { en: "Reproductive event", hi: "प्रजनन घटना",  bn: "প্রজনন ঘটনা"  },
  health_event: { en: "Health event",      hi: "स्वास्थ्य घटना", bn: "স্বাস্থ্য ঘটনা" },
  lactation:    { en: "Lactation",         hi: "दुग्धावधि",      bn: "দুগ্ধকাল"     },
};

function StatusChip({ status, tc }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.heifer;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: T.body,
      color: cfg.fg, background: cfg.bg, borderRadius: 6, padding: "3px 8px" }}>
      {tc(cfg.label)}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 0", borderBottom: `1px solid ${T.line}` }}>
      <span style={{ fontSize: 13, color: T.inkSoft, fontFamily: T.body }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: T.body }}>{value || "—"}</span>
    </div>
  );
}

export default function DairyAnimalDetail({ animalId, spaceId }) {
  const { pop, tc, toast, locale } = useApp();

  const [space, setSpace]         = useState(null);
  const [animal, setAnimal]       = useState(null);
  const [milkList, setMilkList]   = useState([]);
  const [history, setHistory]     = useState([]);
  const [lactations, setLactations] = useState([]);
  const [tab, setTab]             = useState("overview");
  const [state, setState]         = useState("loading");
  const [reason, setReason]       = useState(null);

  /* Milk log sheet */
  const [milkOpen, setMilkOpen]   = useState(false);
  const [mform, setMform] = useState({ recordDate: today(), amYieldKg: "", pmYieldKg: "", fatPct: "", snfPct: "", remarks: "" });
  const [mbusy, setMbusy]         = useState(false);

  /* Delete milk confirm */
  const [delId, setDelId]         = useState(null);
  const [delBusy, setDelBusy]     = useState(false);

  /* Status change sheet */
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus]   = useState("");
  const [sBusy, setSBusy]           = useState(false);

  /* Edit animal sheet */
  const [editOpen, setEditOpen]   = useState(false);
  const [eform, setEform]         = useState({});
  const [ebusy, setEbusy]         = useState(false);

  const load = useCallback(async () => {
    try {
      const active = spaceId
        ? (await farmSpaceService.spaces()).find((s) => s.id === spaceId) || await farmSpaceService.active()
        : await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const [aData, mData, hData, lData] = await Promise.all([
        dairyApi.getAnimal(active.id, animalId),
        dairyApi.listMilk(active.id, { animalId, limit: 30 }),
        dairyApi.animalHistory(active.id, animalId),
        dairyApi.listLactations(active.id, animalId),
      ]);
      setAnimal(aData);
      setMilkList(mData || []);
      setHistory(hData?.history || []);
      setLactations(lData || []);
      setEform({
        name: aData.name, species: aData.species, breed: aData.breed || "",
        tagId: aData.tag_id || "", notes: aData.notes || "",
      });
      setState("ready");
    } catch (err) {
      if (state !== "ready") { setReason(err?.reason || FARM_ERROR.FAILED); setState("error"); }
    }
  }, [animalId, spaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const canManage = space && farmSpaceService.can(space, "farm.dairy.manage");
  const canRecord = space && farmSpaceService.can(space, "farm.dairy.record");
  const isTerminal = animal && TERMINAL.has(animal.current_status);

  /* ── Milk upsert ── */
  const saveMilk = async () => {
    if (!mform.recordDate) return;
    setMbusy(true);
    try {
      await dairyApi.upsertMilk(space.id, {
        animalId,
        recordDate: mform.recordDate,
        amYieldKg: parseFloat(mform.amYieldKg) || 0,
        pmYieldKg: parseFloat(mform.pmYieldKg) || 0,
        fatPct: mform.fatPct ? parseFloat(mform.fatPct) : null,
        snfPct: mform.snfPct ? parseFloat(mform.snfPct) : null,
        remarks: mform.remarks || null,
      });
      toast(tc({ en: "Milk record saved", hi: "दूध रिकॉर्ड सहेजा", bn: "দুধ রেকর্ড সংরক্ষিত" }), "success");
      setMilkOpen(false);
      setMform({ recordDate: today(), amYieldKg: "", pmYieldKg: "", fatPct: "", snfPct: "", remarks: "" });
      /* Reload milk list */
      dairyApi.listMilk(space.id, { animalId, limit: 30 }).then(setMilkList).catch(() => {});
    } catch (err) {
      toast(err.message || tc({ en: "Save failed", hi: "सहेजा नहीं जा सका", bn: "সংরক্ষণ ব্যর্থ" }), "error");
    } finally {
      setMbusy(false);
    }
  };

  /* ── Delete milk ── */
  const confirmDeleteMilk = async () => {
    setDelBusy(true);
    try {
      await dairyApi.deleteMilk(space.id, delId);
      setMilkList((prev) => prev.filter((r) => r.id !== delId));
      setDelId(null);
      toast(tc({ en: "Record deleted", hi: "रिकॉर्ड हटाया गया", bn: "রেকর্ড মুছে গেছে" }), "info");
    } catch (err) {
      toast(err.message || tc({ en: "Delete failed", hi: "हटाया नहीं जा सका", bn: "মুছতে ব্যর্থ" }), "error");
    } finally {
      setDelBusy(false);
    }
  };

  /* ── Set status ── */
  const applyStatus = async () => {
    if (!newStatus) return;
    setSBusy(true);
    try {
      const updated = await dairyApi.setStatus(space.id, animalId, newStatus);
      setAnimal((a) => ({ ...a, current_status: updated.current_status }));
      setStatusOpen(false);
      toast(tc({ en: "Status updated", hi: "स्थिति अपडेट हो गई", bn: "অবস্থা আপডেট হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Update failed", hi: "अपडेट नहीं हो सका", bn: "আপডেট ব্যর্থ" }), "error");
    } finally {
      setSBusy(false);
    }
  };

  /* ── Edit animal ── */
  const saveEdit = async () => {
    setEbusy(true);
    try {
      const updated = await dairyApi.updateAnimal(space.id, {
        animalId,
        name: eform.name.trim(),
        species: eform.species,
        breed: eform.breed || null,
        tagId: eform.tagId || null,
        notes: eform.notes || null,
      });
      setAnimal((a) => ({ ...a, ...updated }));
      setEditOpen(false);
      toast(tc({ en: "Animal updated", hi: "पशु अपडेट हो गया", bn: "প্রাণী আপডেট হয়েছে" }), "success");
    } catch (err) {
      toast(err.message || tc({ en: "Update failed", hi: "अपडेट नहीं हो सका", bn: "আপডেট ব্যর্থ" }), "error");
    } finally {
      setEbusy(false);
    }
  };

  const bar = (
    <AppBar
      title={animal?.name || tc({ en: "Animal", hi: "पशु", bn: "প্রাণী" })}
      onBack={pop}
      action={canManage && !isTerminal && (
        <button
          onClick={() => setEditOpen(true)}
          style={{ background: "none", border: "none", cursor: "pointer",
            color: T.inkSoft, padding: "6px 8px", display: "flex", alignItems: "center" }}>
          <Icon name="Pencil" size={18} />
        </button>
      )}
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error")   return <>{bar}<div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  if (!animal) return null;

  const cfg = STATUS_CFG[animal.current_status] || STATUS_CFG.heifer;

  return (
    <>
      {bar}

      {/* Profile header card */}
      <div style={{ padding: "10px 16px 0" }}>
        <Card elevated>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 54, height: 54, borderRadius: 16, flexShrink: 0,
              background: cfg.bg, display: "grid", placeItems: "center" }}>
              <Icon name="Milk" size={26} color={cfg.fg} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.ink }}>{animal.name}</span>
                <StatusChip status={animal.current_status} tc={tc} />
              </div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>
                {animal.species === "buffalo"
                  ? tc({ en: "Buffalo", hi: "भैंस", bn: "মহিষ" })
                  : tc({ en: "Cow", hi: "गाय", bn: "গরু" })}
                {animal.breed ? ` · ${animal.breed}` : ""}
                {animal.tag_id ? ` · #${animal.tag_id}` : ""}
              </div>
            </div>
          </div>

          {/* Terminal banner */}
          {isTerminal && (
            <div style={{ marginTop: 10, background: "#f5f5f5", borderRadius: T.rSm,
              padding: "7px 10px", fontSize: 12, color: "#6b6b6b", fontFamily: T.body }}>
              <Icon name="Lock" size={12} style={{ marginRight: 5 }} />
              {tc({ en: "This animal is terminal — records are read-only.",
                    hi: "यह पशु टर्मिनल स्थिति में है — रिकॉर्ड केवल पढ़ने के लिए।",
                    bn: "এই প্রাণীটি চূড়ান্ত অবস্থায় — রেকর্ড শুধু পড়ার যোগ্য।" })}
            </div>
          )}

          {/* Status change button — manager only, non-terminal */}
          {canManage && !isTerminal && (
            <button
              onClick={() => { setNewStatus(animal.current_status); setStatusOpen(true); }}
              style={{ marginTop: 10, width: "100%", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 6, background: T.surface2, border: "none",
                borderRadius: T.rSm, padding: "8px 0", cursor: "pointer",
                fontFamily: T.body, fontSize: 12.5, color: T.ink, fontWeight: 600 }}>
              <Icon name="RefreshCw" size={13} />
              {tc({ en: "Change status", hi: "स्थिति बदलें", bn: "অবস্থা পরিবর্তন করুন" })}
            </button>
          )}
        </Card>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px", overflowX: "auto" }}>
        {[
          { id: "overview", label: { en: "Overview",    hi: "सारांश",     bn: "সংক্ষিপ্ত"  } },
          { id: "milk",     label: { en: "Milk",        hi: "दूध",         bn: "দুধ"        } },
          { id: "history",  label: { en: "History",     hi: "इतिहास",      bn: "ইতিহাস"    } },
        ].map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {tc(t.label)}
          </Chip>
        ))}
      </div>

      {/* Tab bodies */}
      <div style={{ padding: "6px 16px 32px" }}>
        {tab === "overview" && <OverviewTab animal={animal} lactations={lactations} tc={tc} locale={locale} fmtDate={fmtDate} />}
        {tab === "milk"     && (
          <MilkTab
            milkList={milkList}
            canRecord={canRecord}
            isTerminal={isTerminal}
            tc={tc}
            locale={locale}
            fmtDateShort={fmtDateShort}
            onAdd={() => setMilkOpen(true)}
            onDelete={(id) => setDelId(id)}
          />
        )}
        {tab === "history"  && <HistoryTab history={history} tc={tc} fmtDate={fmtDate} />}
      </div>

      {/* Milk log sheet */}
      <BottomSheet
        open={milkOpen}
        onClose={() => setMilkOpen(false)}
        title={tc({ en: "Log Milk", hi: "दूध दर्ज करें", bn: "দুধ লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label={tc({ en: "Date", hi: "तारीख", bn: "তারিখ" })} type="date"
            value={mform.recordDate} onChange={(v) => setMform((f) => ({ ...f, recordDate: v }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Input label={tc({ en: "AM yield (kg)", hi: "सुबह (kg)", bn: "সকাল (kg)" })}
                type="number" placeholder="0" value={mform.amYieldKg}
                onChange={(v) => setMform((f) => ({ ...f, amYieldKg: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label={tc({ en: "PM yield (kg)", hi: "शाम (kg)", bn: "সন্ধ্যা (kg)" })}
                type="number" placeholder="0" value={mform.pmYieldKg}
                onChange={(v) => setMform((f) => ({ ...f, pmYieldKg: v }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Input label={tc({ en: "Fat %", hi: "वसा %", bn: "ফ্যাট %" })}
                type="number" placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })}
                value={mform.fatPct} onChange={(v) => setMform((f) => ({ ...f, fatPct: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label={tc({ en: "SNF %", hi: "SNF %", bn: "SNF %" })}
                type="number" placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })}
                value={mform.snfPct} onChange={(v) => setMform((f) => ({ ...f, snfPct: v }))} />
            </div>
          </div>
          <Input label={tc({ en: "Remarks (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            placeholder={tc({ en: "e.g. Low production, sick", hi: "उदा. कम उत्पादन", bn: "যেমন কম উৎপাদন" })}
            value={mform.remarks} onChange={(v) => setMform((f) => ({ ...f, remarks: v }))} />
          <Button full onClick={saveMilk} disabled={!mform.recordDate || mbusy}>
            {mbusy
              ? tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ হচ্ছে…" })
              : tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Delete milk confirm */}
      <Dialog
        open={!!delId}
        title={tc({ en: "Delete record?", hi: "रिकॉर्ड हटाएँ?", bn: "রেকর্ড মুছবেন?" })}
        onClose={() => setDelId(null)}
        actions={[
          { label: tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" }), variant: "outline", onClick: () => setDelId(null) },
          { label: delBusy ? "…" : tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" }), variant: "danger", onClick: confirmDeleteMilk },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>
          {tc({ en: "This milk record will be soft-deleted.",
                hi: "यह दूध रिकॉर्ड हटा दिया जाएगा।",
                bn: "এই দুধ রেকর্ড মুছে যাবে।" })}
        </div>
      </Dialog>

      {/* Status change sheet */}
      <BottomSheet
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title={tc({ en: "Change status", hi: "स्थिति बदलें", bn: "অবস্থা পরিবর্তন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown
            label={tc({ en: "New status", hi: "नई स्थिति", bn: "নতুন অবস্থা" })}
            value={newStatus}
            onChange={setNewStatus}
            options={ALL_STATUSES.map((s) => ({ value: s.value, label: tc(s.label) }))} />
          {["sold", "deceased", "retired"].includes(newStatus) && (
            <div style={{ background: "#fff3e8", borderRadius: T.rSm, padding: "8px 12px",
              fontSize: 12.5, color: T.orange, fontFamily: T.body }}>
              {tc({ en: "⚠ Terminal status — no further records can be added after this.",
                    hi: "⚠ टर्मिनल स्थिति — इसके बाद कोई रिकॉर्ड नहीं जोड़ा जा सकता।",
                    bn: "⚠ চূড়ান্ত অবস্থা — এর পরে আর কোনো রেকর্ড যোগ করা যাবে না।" })}
            </div>
          )}
          <Button full onClick={applyStatus} disabled={!newStatus || newStatus === animal.current_status || sBusy}>
            {sBusy
              ? tc({ en: "Updating…", hi: "अपडेट हो रहा है…", bn: "আপডেট হচ্ছে…" })
              : tc({ en: "Apply", hi: "लागू करें", bn: "প্রয়োগ করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Edit animal sheet */}
      <BottomSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={tc({ en: "Edit Animal", hi: "पशु संपादन", bn: "প্রাণী সম্পাদন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label={tc({ en: "Name", hi: "नाम", bn: "নাম" })}
            value={eform.name}
            onChange={(v) => setEform((f) => ({ ...f, name: v }))} />
          <Dropdown
            label={tc({ en: "Species", hi: "प्रजाति", bn: "প্রজাতি" })}
            value={eform.species}
            onChange={(v) => setEform((f) => ({ ...f, species: v }))}
            options={[
              { value: "cow",     label: tc({ en: "Cow",     hi: "गाय",  bn: "গরু"   }) },
              { value: "buffalo", label: tc({ en: "Buffalo", hi: "भैंस", bn: "মহিষ" }) },
            ]} />
          <Input
            label={tc({ en: "Breed (optional)", hi: "नस्ल (वैकल्पिक)", bn: "জাত (ঐচ্ছিক)" })}
            value={eform.breed}
            onChange={(v) => setEform((f) => ({ ...f, breed: v }))} />
          <Input
            label={tc({ en: "Tag number (optional)", hi: "टैग नंबर (वैकल्पिक)", bn: "ট্যাগ নম্বর (ঐচ্ছিক)" })}
            value={eform.tagId}
            onChange={(v) => setEform((f) => ({ ...f, tagId: v }))} />
          <Input
            label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            value={eform.notes}
            onChange={(v) => setEform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={saveEdit} disabled={!eform.name?.trim() || ebusy}>
            {ebusy
              ? tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ হচ্ছে…" })
              : tc({ en: "Save changes", hi: "बदलाव सहेजें", bn: "পরিবর্তন সংরক্ষণ" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

/* ── Sub-tab components ─────────────────────────────────────────────────── */

function OverviewTab({ animal, lactations, tc, locale, fmtDate }) {
  const lastLac = lactations[0] || animal.last_lactation;
  const lastMilk = animal.last_milk_record;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Profile details */}
      <Card>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, fontFamily: T.body,
          textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
          {tc({ en: "Profile", hi: "प्रोफ़ाइल", bn: "প্রোফাইল" })}
        </div>
        <InfoRow label={tc({ en: "Species", hi: "प्रजाति", bn: "প্রজাতি" })}
          value={animal.species === "buffalo"
            ? tc({ en: "Buffalo", hi: "भैंस", bn: "মহিষ" })
            : tc({ en: "Cow", hi: "गाय", bn: "গরু" })} />
        <InfoRow label={tc({ en: "Breed", hi: "नस्ल", bn: "জাত" })} value={animal.breed} />
        <InfoRow label={tc({ en: "Tag / Ear no.", hi: "टैग/कान नं.", bn: "ট্যাগ/কান নং" })} value={animal.tag_id} />
        <InfoRow label={tc({ en: "Date of birth", hi: "जन्म तिथि", bn: "জন্ম তারিখ" })} value={fmtDate(animal.dob, locale)} />
        <InfoRow label={tc({ en: "Acquired", hi: "प्राप्ति तिथि", bn: "অধিগ্রহণ" })} value={fmtDate(animal.acquisition_date, locale)} />
        <InfoRow label={tc({ en: "Source", hi: "स्रोत", bn: "উৎস" })} value={animal.acquisition_source} />
        {animal.notes && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: T.inkSoft, fontFamily: T.body,
            background: T.surface2, borderRadius: T.rSm, padding: "8px 10px" }}>
            {animal.notes}
          </div>
        )}
      </Card>

      {/* Last lactation */}
      {lastLac ? (
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, fontFamily: T.body,
            textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
            {tc({ en: "Current lactation", hi: "वर्तमान दुग्धावधि", bn: "বর্তমান দুগ্ধকাল" })}
          </div>
          <InfoRow label={tc({ en: "Lactation #", hi: "दुग्धावधि क्र.", bn: "দুগ্ধকাল #" })} value={lastLac.lactation_number} />
          <InfoRow label={tc({ en: "Calving date", hi: "बछड़ा जन्म", bn: "বাছুর জন্ম" })} value={fmtDate(lastLac.calving_date, locale)} />
          <InfoRow label={tc({ en: "Dry-off date", hi: "शुष्क तिथि", bn: "শুষ্ক তারিখ" })} value={fmtDate(lastLac.dry_off_date, locale)} />
          <InfoRow label={tc({ en: "Calf sex", hi: "बछड़ा लिंग", bn: "বাছুরের লিঙ্গ" })} value={lastLac.calf_sex} />
        </Card>
      ) : (
        <div style={{ padding: "16px 0", textAlign: "center", color: T.inkFaint, fontSize: 13, fontFamily: T.body }}>
          {tc({ en: "No lactation records yet.", hi: "अभी कोई दुग्धावधि रिकॉर्ड नहीं।", bn: "এখনো কোনো দুগ্ধকাল রেকর্ড নেই।" })}
        </div>
      )}

      {/* Last milk */}
      {lastMilk && (
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, fontFamily: T.body,
            textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
            {tc({ en: "Last milk record", hi: "अंतिम दूध रिकॉर्ड", bn: "সর্বশেষ দুধ রেকর্ড" })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
            <StatPill label={tc({ en: "Total", hi: "कुल", bn: "মোট" })}
              value={`${Number(lastMilk.total_yield_kg || 0).toFixed(1)} kg`} accent="blue" />
            <StatPill label={tc({ en: "AM", hi: "सुबह", bn: "সকাল" })}
              value={`${Number(lastMilk.am_yield_kg || 0).toFixed(1)} kg`} accent="primary" />
            <StatPill label={tc({ en: "PM", hi: "शाम", bn: "সন্ধ্যা" })}
              value={`${Number(lastMilk.pm_yield_kg || 0).toFixed(1)} kg`} accent="primary" />
          </div>
          {(lastMilk.fat_pct || lastMilk.snf_pct) && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: T.inkSoft, fontFamily: T.body }}>
              {lastMilk.fat_pct ? `Fat: ${lastMilk.fat_pct}%` : ""}
              {lastMilk.fat_pct && lastMilk.snf_pct ? " · " : ""}
              {lastMilk.snf_pct ? `SNF: ${lastMilk.snf_pct}%` : ""}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function StatPill({ label, value, accent }) {
  const fg = accent === "primary" ? T.primary : T.blue;
  const bg = accent === "primary" ? T.primarySoft : T.blueSoft;
  return (
    <div style={{ flex: 1, background: bg, borderRadius: T.rSm, padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: fg, fontFamily: T.display }}>{value}</div>
      <div style={{ fontSize: 11, color: fg, fontFamily: T.body, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MilkTab({ milkList, canRecord, isTerminal, tc, locale, fmtDateShort, onAdd, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {canRecord && !isTerminal && (
        <Button full variant="soft" onClick={onAdd}>
          <Icon name="Plus" size={15} style={{ marginRight: 6 }} />
          {tc({ en: "Log milk", hi: "दूध दर्ज करें", bn: "দুধ লিখুন" })}
        </Button>
      )}
      {milkList.length === 0 ? (
        <EmptyState
          icon="Droplets"
          title={tc({ en: "No milk records", hi: "कोई दूध रिकॉर्ड नहीं", bn: "কোনো দুধ রেকর্ড নেই" })}
          body={canRecord && !isTerminal
            ? tc({ en: "Tap Log milk to record today's yield.", hi: "आज का उत्पादन दर्ज करने के लिए दूध दर्ज करें दबाएँ।", bn: "আজকের উৎপাদন লিখতে দুধ লিখুন চাপুন।" })
            : tc({ en: "No records yet.", hi: "अभी कोई रिकॉर्ड नहीं।", bn: "এখনো কোনো রেকর্ড নেই।" })}
        />
      ) : (
        milkList.map((rec) => (
          <Card key={rec.id} pad={12}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: T.ink, fontFamily: T.display }}>
                  {Number(rec.total_yield_kg || 0).toFixed(1)} kg
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body, marginTop: 2 }}>
                  {fmtDateShort(rec.record_date, locale)}
                  {" · "}{tc({ en: "AM", hi: "सु", bn: "স" })} {Number(rec.am_yield_kg || 0).toFixed(1)}
                  {" · "}{tc({ en: "PM", hi: "श", bn: "স" })} {Number(rec.pm_yield_kg || 0).toFixed(1)}
                  {rec.fat_pct ? ` · Fat ${rec.fat_pct}%` : ""}
                  {rec.snf_pct ? ` · SNF ${rec.snf_pct}%` : ""}
                </div>
                {rec.remarks && (
                  <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 2, fontFamily: T.body }}>{rec.remarks}</div>
                )}
              </div>
              {canRecord && !isTerminal && (
                <button onClick={() => onDelete(rec.id)}
                  style={{ background: "none", border: "none", cursor: "pointer",
                    color: T.inkFaint, padding: "4px 6px", flexShrink: 0 }}>
                  <Icon name="Trash2" size={15} />
                </button>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function HistoryTab({ history, tc, fmtDate }) {
  if (!history.length) {
    return (
      <EmptyState
        icon="Clock"
        title={tc({ en: "No history", hi: "कोई इतिहास नहीं", bn: "কোনো ইতিহাস নেই" })}
        body={tc({ en: "Events will appear here as records are added.", hi: "रिकॉर्ड जोड़ने पर घटनाएँ यहाँ दिखेंगी।", bn: "রেকর্ড যোগ হলে ঘটনাগুলো এখানে দেখাবে।" })}
      />
    );
  }

  return (
    <div style={{ position: "relative", paddingLeft: 28 }}>
      {/* Vertical timeline line */}
      <div style={{ position: "absolute", left: 10, top: 8, bottom: 8, width: 2, background: T.line, borderRadius: 1 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {history.map((ev, i) => {
          const kCfg = HISTORY_KIND_ICON[ev.kind] || { icon: "Circle", color: T.inkSoft };
          const kindLabel = KIND_LABEL[ev.kind] ? tc(KIND_LABEL[ev.kind]) : ev.kind;
          return (
            <div key={ev.id || i} style={{ position: "relative" }}>
              {/* Timeline dot */}
              <div style={{ position: "absolute", left: -28, top: 14, width: 20, height: 20,
                borderRadius: "50%", background: kCfg.color + "22",
                display: "grid", placeItems: "center" }}>
                <Icon name={kCfg.icon} size={11} color={kCfg.color} />
              </div>

              <Card pad={11}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: kCfg.color, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: 0.5, fontFamily: T.body }}>
                      {kindLabel}
                    </div>
                    <HistoryEventBody ev={ev} tc={tc} />
                  </div>
                  <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.body, flexShrink: 0, marginTop: 2 }}>
                    {fmtDate(ev.event_date)}
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryEventBody({ ev, tc }) {
  if (ev.kind === "milk_record") {
    return (
      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: T.body, marginTop: 2 }}>
        {Number(ev.total_yield_kg || 0).toFixed(1)} kg
        <span style={{ fontSize: 12, fontWeight: 400, color: T.inkSoft }}>
          {" "}· AM {Number(ev.am_yield_kg || 0).toFixed(1)} · PM {Number(ev.pm_yield_kg || 0).toFixed(1)}
          {ev.fat_pct ? ` · Fat ${ev.fat_pct}%` : ""}
        </span>
      </div>
    );
  }
  if (ev.kind === "repro_event") {
    return (
      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: T.body, marginTop: 2 }}>
        {ev.event_type?.replace(/_/g, " ")}
        {ev.pregnancy_result && (
          <span style={{ fontSize: 12, fontWeight: 400, color: T.inkSoft }}> · {ev.pregnancy_result}</span>
        )}
        {ev.notes && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{ev.notes}</div>}
      </div>
    );
  }
  if (ev.kind === "health_event") {
    return (
      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: T.body, marginTop: 2 }}>
        {ev.title || ev.event_type?.replace(/_/g, " ")}
        {ev.medicine && <span style={{ fontSize: 12, fontWeight: 400, color: T.inkSoft }}> · {ev.medicine}</span>}
        {ev.next_due_date && (
          <div style={{ fontSize: 11, color: T.orange, marginTop: 2, fontFamily: T.body }}>
            {tc({ en: "Due:", hi: "देय:", bn: "দেয়:" })} {String(ev.next_due_date).slice(0, 10)}
          </div>
        )}
      </div>
    );
  }
  if (ev.kind === "lactation") {
    return (
      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: T.body, marginTop: 2 }}>
        {tc({ en: "Lactation", hi: "दुग्धावधि", bn: "দুগ্ধকাল" })} #{ev.lactation_number}
        {ev.calf_sex && (
          <span style={{ fontSize: 12, fontWeight: 400, color: T.inkSoft }}> · {ev.calf_sex} {tc({ en: "calf", hi: "बछड़ा", bn: "বাছুর" })}</span>
        )}
      </div>
    );
  }
  return null;
}
