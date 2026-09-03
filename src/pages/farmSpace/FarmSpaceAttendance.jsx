import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, Dropdown, EmptyState, ErrorState, Spinner } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmSpaceApi } from "../../services/farmSpace/farmSpaceApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

/* Farm attendance.

   Two different screens wearing one name. A worker sees their own record and a
   button to mark themselves in; a manager sees the whole team and can mark for
   anyone. That difference is decided by the server — a worker's list request
   simply comes back with one row — so this file mostly decides what to draw
   around whatever it is given. */

const STATUS = {
  present:  { a: "primary", label: { en: "Present",  hi: "उपस्थित", bn: "উপস্থিত" } },
  absent:   { a: "red",     label: { en: "Absent",   hi: "अनुपस्थित", bn: "অনুপস্থিত" } },
  leave:    { a: "orange",  label: { en: "On leave", hi: "छुट्टी पर", bn: "ছুটিতে" } },
  half_day: { a: "blue",    label: { en: "Half day", hi: "आधा दिन",  bn: "অর্ধ দিন" } },
};
const TONE = {
  primary: [T.primary, T.primarySoft], blue: [T.blue, T.blueSoft],
  orange: [T.orange, T.orangeSoft], red: [T.red, T.redSoft], faint: [T.inkSoft, T.surface2],
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function FarmSpaceAttendance() {
  const { pop, tc, toast } = useApp();
  const [space, setSpace] = useState(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);

      /* Only a manager needs the roster, and only they are allowed it. */
      if (farmSpaceService.can(active, "farm.attendance.manage")) {
        farmSpaceService.members(active.id).then(setMembers).catch(() => setMembers([]));
      }

      const cached = farmSpaceService.peekAttendanceToday(active.id);
      let paintedFromCache = false;
      if (cached) {
        setRows(cached.rows);
        setSummary(cached.summary);
        setState("ready");
        paintedFromCache = true;
      } else {
        setState("loading");
      }

      try {
        const { rows: list, summary: sum } = await farmSpaceService.attendanceToday(active.id, { fresh: true });
        setRows(list);
        setSummary(sum);
        setState("ready");
      } catch (err) {
        if (!paintedFromCache) throw err;
      }
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const canManage = farmSpaceService.can(space, "farm.attendance.manage");
  const mine = rows.find((r) => r.user_id === space?.user_id);

  const mark = async (payload) => {
    setBusy(true);
    try {
      await farmSpaceApi.markAttendance(space.id, payload);
      /* Invalidated rather than patched: a first mark for the day CREATES a
         row, so there is no existing entry to update in place. Invalidating
         means load() finds no cache and goes straight to a fresh fetch,
         rather than briefly repainting the pre-mark state before correcting
         itself — the farmer just acted, and should not see it undone even
         for a moment. */
      farmSpaceService.invalidateAttendanceToday(space.id);
      await load();
    } catch (err) {
      toast(err?.status === 400 || err?.status === 403 ? err.message : farmErrorText(err?.reason, tc), "error");
    } finally { setBusy(false); }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await farmSpaceApi.checkOut(space.id, {});
      farmSpaceService.invalidateAttendanceToday(space.id);
      await load();
    } catch (err) {
      toast(err?.status === 409 ? err.message : farmErrorText(err?.reason, tc), "error");
    } finally { setBusy(false); }
  };

  const title = tc({ en: "Attendance", hi: "उपस्थिति", bn: "উপস্থিতি" });

  if (state === "loading") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }
  if (state === "error") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  }

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* my own day, first — it is the only part a worker can act on */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                {tc({ en: "Today", hi: "आज", bn: "আজ" })} · {todayStr()}
              </div>
              <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: T.ink, marginTop: 1 }}>
                {mine
                  ? tc(STATUS[mine.status]?.label ?? STATUS.present.label)
                  : tc({ en: "Not marked", hi: "चिह्नित नहीं", bn: "চিহ্নিত নয়" })}
              </div>
            </div>
            {mine?.check_in && (
              <div style={{ fontSize: 12, color: T.inkSoft, textAlign: "right" }}>
                {tc({ en: "In", hi: "आगमन", bn: "প্রবেশ" })} {new Date(mine.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {mine.check_out && <><br />{tc({ en: "Out", hi: "प्रस्थान", bn: "প্রস্থান" })} {new Date(mine.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 9 }}>
            {!mine ? (
              <div style={{ flex: 1 }}>
                <Button full disabled={busy} onClick={() => mark({ status: "present" })}>
                  {tc({ en: "Mark me present", hi: "मुझे उपस्थित करें", bn: "আমাকে উপস্থিত করুন" })}
                </Button>
              </div>
            ) : !mine.check_out ? (
              <div style={{ flex: 1 }}>
                <Button full variant="soft" disabled={busy} onClick={leave}>
                  {tc({ en: "Check out", hi: "प्रस्थान दर्ज करें", bn: "প্রস্থান নথিভুক্ত" })}
                </Button>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                {tc({ en: "Your day is recorded.", hi: "आपका दिन दर्ज हो गया।", bn: "আপনার দিন নথিভুক্ত হয়েছে।" })}
              </div>
            )}
          </div>
        </Card>

        {/* the farm's day — managers only, and the server enforces that too */}
        {canManage && summary && (
          <div style={{ display: "flex", gap: 10 }}>
            <Stat label={tc({ en: "Present", hi: "उपस्थित", bn: "উপস্থিত" })} value={`${summary.present}/${summary.members}`} tone="primary" />
            <Stat label={tc({ en: "On leave", hi: "छुट्टी", bn: "ছুটি" })} value={summary.on_leave} tone="orange" />
            <Stat label={tc({ en: "Absent", hi: "अनुपस्थित", bn: "অনুপস্থিত" })} value={summary.absent} tone="red" />
          </div>
        )}

        {canManage && (
          <MarkForOthers members={members} rows={rows} tc={tc} busy={busy} onMark={mark} />
        )}

        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, marginBottom: 8 }}>
            {canManage
              ? tc({ en: "Today's roll", hi: "आज की हाज़िरी", bn: "আজকের হাজিরা" })
              : tc({ en: "My record", hi: "मेरा रिकॉर्ड", bn: "আমার রেকর্ড" })}
          </div>
          {!rows.length ? (
            <EmptyState icon="CalendarCheck"
              title={tc({ en: "Nothing marked yet", hi: "अभी कुछ चिह्नित नहीं", bn: "এখনও কিছু চিহ্নিত হয়নি" })}
              body={tc({ en: "Attendance for today will appear here.",
                            hi: "आज की उपस्थिति यहाँ दिखेगी।",
                            bn: "আজকের উপস্থিতি এখানে দেখা যাবে।" })} />
          ) : (
            <Card pad={0}>
              {rows.map((r, i) => {
                const meta = STATUS[r.status] || STATUS.present;
                const [fg, bg] = TONE[meta.a] || TONE.faint;
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px",
                    borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{r.member_name}</div>
                      {r.note && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1 }}>{r.note}</div>}
                    </div>
                    <span style={{ background: bg, color: fg, borderRadius: 99, padding: "2.5px 8px",
                      fontSize: 10.5, fontWeight: 700 }}>{tc(meta.label)}</span>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone }) {
  const [fg, bg] = TONE[tone] || TONE.faint;
  return (
    <div style={{ flex: 1, background: bg, borderRadius: T.rLg, padding: "12px 12px" }}>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: fg, marginTop: 1 }}>{value}</div>
    </div>
  );
}

function MarkForOthers({ members, rows, tc, busy, onMark }) {
  const [who, setWho] = useState("");
  const [status, setStatus] = useState("present");

  /* Nobody left to mark is worth saying rather than showing an empty picker. */
  const unmarked = members.filter((m) => !rows.some((r) => r.user_id === m.user_id));
  if (!members.length) return null;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>
        {tc({ en: "Mark for someone", hi: "किसी और के लिए चिह्नित करें", bn: "অন্য কারও জন্য চিহ্নিত করুন" })}
      </div>
      {!unmarked.length ? (
        <div style={{ fontSize: 12.5, color: T.inkSoft }}>
          {tc({ en: "Everyone is marked for today.", hi: "आज सभी चिह्नित हैं।", bn: "আজ সবাই চিহ্নিত।" })}
        </div>
      ) : (
        <>
          <Dropdown value={who} onChange={setWho}
            options={[{ value: "", label: tc({ en: "Choose a member", hi: "सदस्य चुनें", bn: "সদস্য বাছুন" }) },
              ...unmarked.map((m) => ({ value: m.user_id, label: m.name || m.phone || "—" }))]} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Dropdown value={status} onChange={setStatus}
                options={Object.entries(STATUS).map(([id, s]) => ({ value: id, label: tc(s.label) }))} />
            </div>
            <Button disabled={busy || !who} onClick={() => { onMark({ userId: who, status }); setWho(""); }}>
              <Icon name="Check" size={15} /> {tc({ en: "Mark", hi: "चिह्नित", bn: "চিহ্নিত" })}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
