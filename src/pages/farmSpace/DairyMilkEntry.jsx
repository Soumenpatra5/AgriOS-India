import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Button, EmptyState, ErrorState, Spinner,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { dairyApi } from "../../services/dairy/dairyApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const todayStr = () => new Date().toISOString().slice(0, 10);

function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function fmtDate(dateStr) {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return dateStr; }
}

export default function DairyMilkEntry({ spaceId }) {
  const { pop, tc, toast } = useApp();

  const [date, setDate]       = useState(todayStr);
  const [space, setSpace]     = useState(null);
  const [animals, setAnimals] = useState([]);
  const [rows, setRows]       = useState({});
  const [state, setState]     = useState("loading");
  const [reason, setReason]   = useState(null);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async (targetDate) => {
    setState("loading");
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);

      const sid = spaceId || active.id;
      const [animalList, milkList] = await Promise.all([
        dairyApi.listAnimals(sid, { includeTerminal: false }),
        dairyApi.listMilk(sid, { fromDate: targetDate, toDate: targetDate, limit: 200 }),
      ]);

      /* Only milking animals appear in bulk entry; heifer/dry are excluded. */
      const milking = (animalList || []).filter(a => a.current_status === "milking");
      setAnimals(milking);

      const newRows = {};
      for (const a of milking) {
        const existing = (milkList || []).find(r => r.animal_id === a.id);
        newRows[a.id] = {
          am:         existing != null ? String(existing.am_yield_kg ?? "") : "",
          pm:         existing != null ? String(existing.pm_yield_kg ?? "") : "",
          clientUuid: crypto.randomUUID(),
          error:      null,
          saved:      !!existing,
        };
      }
      setRows(newRows);
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [spaceId]);

  useEffect(() => { load(todayStr()); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goDate = (delta) => {
    const newDate = shiftDate(date, delta);
    if (newDate > todayStr()) return;
    setDate(newDate);
    load(newDate);
  };

  const setRow = (animalId, field, value) => {
    setRows(prev => ({ ...prev, [animalId]: { ...prev[animalId], [field]: value, error: null } }));
  };

  const totalKg = animals.reduce((sum, a) => {
    const r = rows[a.id] || {};
    return sum + (parseFloat(r.am) || 0) + (parseFloat(r.pm) || 0);
  }, 0);

  const saveAll = async () => {
    if (!space) return;
    setSaving(true);
    const sid = spaceId || space.id;

    const tasks = animals
      .map(a => {
        const r = rows[a.id] || {};
        const am = parseFloat(r.am) || 0;
        const pm = parseFloat(r.pm) || 0;
        if (am === 0 && pm === 0) return null;
        return { animalId: a.id, am, pm, clientUuid: r.clientUuid };
      })
      .filter(Boolean);

    if (tasks.length === 0) {
      toast(tc({ en: "No yields entered", hi: "कोई उत्पाद दर्ज नहीं", bn: "কোনো পরিমাণ লেখা হয়নি" }), "warning");
      setSaving(false);
      return;
    }

    const settled = await Promise.allSettled(
      tasks.map(t =>
        dairyApi.upsertMilk(sid, {
          animalId:   t.animalId,
          recordDate: date,
          amYieldKg:  t.am,
          pmYieldKg:  t.pm,
          clientUuid: t.clientUuid,
        })
        .then(() => ({ animalId: t.animalId, ok: true }))
        .catch(() => ({ animalId: t.animalId, ok: false }))
      )
    );

    const results   = settled.map(s => s.value);
    const successes = results.filter(r => r.ok).length;
    const failures  = results.filter(r => !r.ok);

    if (failures.length > 0) {
      setRows(prev => {
        const next = { ...prev };
        for (const f of failures) next[f.animalId] = { ...next[f.animalId], error: "failed" };
        return next;
      });
    }

    if (failures.length === 0) {
      toast(tc({ en: "Milk recorded", hi: "दूध दर्ज किया गया", bn: "দুধ নথিভুক্ত হয়েছে" }), "success");
      pop();
    } else if (successes > 0) {
      toast(
        tc({ en: `${successes} saved, ${failures.length} failed — highlighted in red`,
             hi: `${successes} सहेजे, ${failures.length} विफल — लाल में चिह्नित`,
             bn: `${successes}টি সংরক্ষিত, ${failures.length}টি ব্যর্থ — লাল রঙে চিহ্নিত` }),
        "warning"
      );
    } else {
      toast(
        tc({ en: "All entries failed — check your connection", hi: "सभी प्रविष्टियाँ विफल — कनेक्शन जाँचें", bn: "সব প্রবিষ্টি ব্যর্থ — সংযোগ পরীক্ষা করুন" }),
        "error"
      );
    }

    setSaving(false);
  };

  const isToday = date === todayStr();

  const bar = (
    <AppBar
      title={tc({ en: "Daily Milk", hi: "दैनिक दूध", bn: "দৈনিক দুধ" })}
      onBack={pop}
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button onClick={() => goDate(-1)}
            style={{ background: "none", border: "none", cursor: "pointer",
              padding: "6px 8px", borderRadius: T.rSm, lineHeight: 0 }}>
            <Icon name="ChevronLeft" size={18} color={T.ink} />
          </button>
          <span style={{ fontSize: 12, color: T.ink, fontFamily: T.body, fontWeight: 600,
            minWidth: 96, textAlign: "center", userSelect: "none" }}>
            {fmtDate(date)}
          </span>
          <button onClick={() => goDate(1)} disabled={isToday}
            style={{ background: "none", border: "none",
              cursor: isToday ? "default" : "pointer",
              padding: "6px 8px", borderRadius: T.rSm, lineHeight: 0,
              opacity: isToday ? 0.3 : 1 }}>
            <Icon name="ChevronRight" size={18} color={T.ink} />
          </button>
        </div>
      }
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error")   return <>{bar}<div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={() => load(date)} /></div></>;

  if (animals.length === 0) {
    return (
      <>
        {bar}
        <EmptyState
          icon="Milk"
          title={tc({ en: "No milking animals", hi: "कोई दुधारू पशु नहीं", bn: "কোনো দুগ্ধবতী প্রাণী নেই" })}
          body={tc({
            en: "Mark animals as Milking in the herd to record daily yields.",
            hi: "दैनिक उत्पाद दर्ज करने के लिए पशुओं को 'दुधारू' चिह्नित करें।",
            bn: "দৈনিক উৎপাদন লিখতে প্রাণীদের 'দুগ্ধবতী' হিসেবে চিহ্নিত করুন।",
          })}
        />
      </>
    );
  }

  return (
    <>
      {bar}
      <div style={{ padding: "12px 16px 120px" }}>

        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 8,
          marginBottom: 6, padding: "0 2px" }}>
          <span style={{ fontSize: 11, color: T.inkFaint, fontWeight: 600, fontFamily: T.body }}>
            {tc({ en: "Animal", hi: "पशु", bn: "প্রাণী" })}
          </span>
          <span style={{ fontSize: 11, color: T.inkFaint, fontWeight: 600, fontFamily: T.body, textAlign: "center" }}>
            {tc({ en: "AM (kg)", hi: "सुबह (कि.ग्रा.)", bn: "সকাল (কেজি)" })}
          </span>
          <span style={{ fontSize: 11, color: T.inkFaint, fontWeight: 600, fontFamily: T.body, textAlign: "center" }}>
            {tc({ en: "PM (kg)", hi: "शाम (कि.ग्रा.)", bn: "সন্ধ্যা (কেজি)" })}
          </span>
        </div>

        {/* Animal rows */}
        {animals.map(animal => {
          const r = rows[animal.id] || { am: "", pm: "", error: null };
          const rowTotal  = (parseFloat(r.am) || 0) + (parseFloat(r.pm) || 0);
          const hasError  = r.error === "failed";
          const inputBase = {
            width: "100%", padding: "8px 4px", textAlign: "center",
            border: `1px solid ${hasError ? T.red : T.line}`, borderRadius: T.rSm,
            fontSize: 15, fontFamily: T.body, color: T.ink,
            background: T.bg, boxSizing: "border-box",
          };
          return (
            <div key={animal.id} style={{
              display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 8,
              alignItems: "center", marginBottom: 8,
              background: hasError ? T.redSoft : T.surface,
              borderRadius: T.rMd, padding: "10px 12px",
              border: `1px solid ${hasError ? T.red : T.line}`,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: T.body,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {animal.name}
                </div>
                {animal.tag_id && (
                  <div style={{ fontSize: 10.5, color: T.inkSoft, fontFamily: T.body }}>
                    {animal.tag_id}
                  </div>
                )}
                {rowTotal > 0 && (
                  <div style={{ fontSize: 10.5, fontWeight: 600, fontFamily: T.body,
                    color: hasError ? T.red : T.primary }}>
                    {rowTotal.toFixed(1)} kg
                  </div>
                )}
              </div>
              <input type="number" inputMode="decimal" min="0" step="0.1"
                value={r.am} placeholder="0"
                onChange={e => setRow(animal.id, "am", e.target.value)}
                style={inputBase} />
              <input type="number" inputMode="decimal" min="0" step="0.1"
                value={r.pm} placeholder="0"
                onChange={e => setRow(animal.id, "pm", e.target.value)}
                style={inputBase} />
            </div>
          );
        })}

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 14px", background: T.primarySoft, borderRadius: T.rMd, marginTop: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.primary, fontFamily: T.body }}>
            {tc({ en: "Total", hi: "कुल", bn: "মোট" })}
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, color: T.primary, fontFamily: T.display }}>
            {totalKg.toFixed(1)} kg
          </span>
        </div>
      </div>

      {/* Sticky save */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "12px 16px",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        background: T.bg, borderTop: `1px solid ${T.line}`,
      }}>
        <Button variant="primary" busy={saving} onClick={saveAll}
          style={{ width: "100%", height: 48 }}>
          {tc({ en: "Save all", hi: "सभी सहेजें", bn: "সব সংরক্ষণ করুন" })}
        </Button>
      </div>
    </>
  );
}
