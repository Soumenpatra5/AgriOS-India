import { useState, useEffect, useCallback, useMemo } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown, EmptyState, ErrorState, Spinner, BottomSheet,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmSpaceApi } from "../../services/farmSpace/farmSpaceApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";
import { allowedTransitions } from "../../../api/_lib/farm/tasks.js";
import { notificationService } from "../../services/notifications/notificationService.js";
import { useResponsive } from "../../hooks/useResponsive.js";
import { computeKanbanBuckets, KANBAN_COLUMNS } from "./farmTasksKanban.js";

/* Shared farm tasks.

   The list a member sees is narrowed on the server: a worker's request returns
   their own tasks, a manager's returns the farm's. The client never asks for
   "only mine", which is why a worker cannot see the farm's work by editing a
   request.

   The action buttons come from allowedTransitions() — the same table the
   server enforces — so the app never offers a move that will be refused. */

const STATUS_META = {
  pending:     { a: "faint",   label: { en: "Pending",     hi: "लंबित",        bn: "মুলতুবি" } },
  accepted:    { a: "blue",    label: { en: "Accepted",    hi: "स्वीकृत",       bn: "গৃহীত" } },
  in_progress: { a: "blue",    label: { en: "In progress", hi: "चल रहा है",     bn: "চলছে" } },
  completed:   { a: "primary", label: { en: "Completed",   hi: "पूरा",          bn: "সম্পন্ন" } },
  verified:    { a: "primary", label: { en: "Verified",    hi: "सत्यापित",      bn: "যাচাইকৃত" } },
  rejected:    { a: "red",     label: { en: "Sent back",   hi: "वापस भेजा",     bn: "ফেরত পাঠানো" } },
  cancelled:   { a: "faint",   label: { en: "Cancelled",   hi: "रद्द",          bn: "বাতিল" } },
};

/* What a member is about to do, in their words rather than the database's. */
const ACTION_LABEL = {
  accepted:    { en: "Accept",      hi: "स्वीकारें",   bn: "গ্রহণ করুন" },
  in_progress: { en: "Start",       hi: "शुरू करें",   bn: "শুরু করুন" },
  completed:   { en: "Mark done",   hi: "पूरा करें",   bn: "সম্পন্ন করুন" },
  verified:    { en: "Verify",      hi: "सत्यापित करें", bn: "যাচাই করুন" },
  rejected:    { en: "Send back",   hi: "वापस भेजें",  bn: "ফেরত পাঠান" },
  cancelled:   { en: "Cancel task", hi: "कार्य रद्द करें", bn: "কাজ বাতিল করুন" },
};

const PRIORITY_TONE = { high: "red", medium: "orange", low: "faint" };

const TONE = {
  primary: [T.primary, T.primarySoft], blue: [T.blue, T.blueSoft],
  orange: [T.orange, T.orangeSoft], red: [T.red, T.redSoft],
  faint: [T.inkSoft, T.surface2],
};

/* Newly assigned work is announced through the app's existing notification
   service — the brief is explicit that there must not be a second one. Only
   tasks seen for the first time fire, so a refresh does not re-announce work
   the farmer already knows about. */
const seen = new Set();
function announceNew(tasks, userId, tc) {
  if (!notificationService.isEnabled?.()) return;
  for (const t of tasks) {
    if (t.assigned_to !== userId || seen.has(t.id)) continue;
    seen.add(t.id);
    if (t.status !== "pending") continue;
    notificationService.dispatch(
      tc({ en: "New farm task", hi: "नया फ़ार्म कार्य", bn: "নতুন খামার কাজ" }),
      t.title, `farm-task-${t.id}`,
    );
  }
}

export default function FarmSpaceTasks() {
  const { pop, tc, toast } = useApp();
  const { isDesktop } = useResponsive(768);
  const [space, setSpace] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);
  const [filter, setFilter] = useState("open");

  const [openTask, setOpenTask] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const kanbanBuckets = useMemo(() => computeKanbanBuckets(tasks), [tasks]);

  /* Cache-first, same pattern as the hub: paint whatever this session already
     knows instantly, confirm it against the server in the background, and
     only let a spinner or an error replace something that was never on
     screen to begin with. */
  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);

      const cached = farmSpaceService.peekTasks(active.id);
      let paintedFromCache = false;
      if (cached) {
        setTasks(cached);
        announceNew(cached, active.user_id, tc);
        setState("ready");
        paintedFromCache = true;
      } else {
        setState("loading");
      }

      try {
        const list = await farmSpaceService.tasks(active.id, { fresh: true });
        setTasks(list);
        announceNew(list, active.user_id, tc);
        setState("ready");
      } catch (err) {
        if (!paintedFromCache) throw err;
        /* A cache that was truthy but genuinely empty — `[]`, from before any
           task existed — used to make this failure invisible: the screen was
           already showing "nothing here" for a legitimate reason, so nothing
           looked wrong when the background refresh silently failed too. Told
           here instead, since a real bug hiding behind a real empty state is
           exactly what a silent background refresh must not be allowed to
           produce. */
        toast(farmErrorText(err?.reason, tc), "error");
      }
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [tc, toast]);

  useEffect(() => { load(); }, [load]);

  const canCreate = farmSpaceService.can(space, "farm.tasks.create");

  const shown = useMemo(() => {
    const open = ["pending", "accepted", "in_progress", "rejected"];
    if (filter === "open") return tasks.filter((t) => open.includes(t.status));
    if (filter === "done") return tasks.filter((t) => ["completed", "verified"].includes(t.status));
    return tasks;
  }, [tasks, filter]);

  const move = async (task, status, note) => {
    setBusy(true);
    try {
      const updated = await farmSpaceApi.setTaskStatus(space.id, task.id, status, note ?? null);
      setTasks((list) => list.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
      farmSpaceService.patchTask(space.id, updated.id, updated);
      setOpenTask(null);
    } catch (err) {
      /* 403 and 409 carry a message written for a farmer — "a pending task
         cannot be marked completed" — so it is shown rather than flattened. */
      toast(err?.status === 403 || err?.status === 409 ? err.message : farmErrorText(err?.reason, tc), "error");
    } finally { setBusy(false); }
  };

  const title = tc({ en: "Farm tasks", hi: "फ़ार्म कार्य", bn: "খামারের কাজ" });

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
      {/* ── Desktop Team Kanban Board (Screen >= 768px) ── */}
      {isDesktop ? (
        <div style={{ padding: "8px 24px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Top Bar with Stats & Controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface, padding: "14px 18px", borderRadius: 14, border: `1px solid ${T.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="CheckSquare" size={18} color={T.primary} />
                {tc({ en: "Team Task Flow", hi: "टीम कार्य प्रवाह", bn: "দলের কাজের প্রবাহ" })} ({tasks.length})
              </div>
            </div>
            {canCreate && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Icon name="Plus" size={15} /> {tc({ en: "New Task", hi: "नया कार्य", bn: "নতুন কাজ" })}
              </Button>
            )}
          </div>

          {/* 4-Column Kanban Canvas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, alignItems: "start" }}>
            {KANBAN_COLUMNS.map((col) => {
              const colTasks = kanbanBuckets[col.id] || [];
              return (
                <div
                  key={col.id}
                  style={{
                    background: T.surface,
                    borderRadius: 14,
                    border: `1px solid ${T.line}`,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 460,
                  }}
                >
                  {/* Column Header */}
                  <div
                    style={{
                      padding: "12px 14px",
                      borderBottom: `1px solid ${T.line}`,
                      background: T.surface2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{tc(col.title)}</span>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        background: T.surface,
                        padding: "2px 7px",
                        borderRadius: 10,
                        border: `1px solid ${T.line}`,
                        color: T.inkSoft,
                      }}
                    >
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Task Cards in Column */}
                  <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    {colTasks.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "28px 10px", fontSize: 12, color: T.inkFaint }}>
                        {tc({ en: "No tasks", hi: "कोई कार्य नहीं", bn: "কোনো কাজ নেই" })}
                      </div>
                    ) : (
                      colTasks.map((t) => {
                        const moves = allowedTransitions(t.status, space?.my_role);
                        return (
                          <div
                            key={t.id}
                            onClick={() => setOpenTask(t)}
                            style={{
                              background: T.surface,
                              borderRadius: 10,
                              border: `1px solid ${T.lineSoft}`,
                              padding: "12px",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, lineHeight: 1.35 }}>
                                {t.title}
                              </span>
                              <StatusPill status={t.status} overdue={t.is_overdue} tc={tc} />
                            </div>

                            {t.note && (
                              <div style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                                {t.note}
                              </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 6, borderTop: `1px solid ${T.lineSoft}`, fontSize: 11, color: T.inkSoft }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <Icon name="User" size={12} color={T.inkFaint} />
                                {t.assignee_name || tc({ en: "Unassigned", hi: "अनपेक्षित", bn: "অনির্ধারিত" })}
                              </span>
                              {t.due_date && (
                                <span style={{ color: t.is_overdue ? T.red : T.inkFaint, fontWeight: t.is_overdue ? 700 : 500 }}>
                                  {t.due_date.slice(5)}
                                </span>
                              )}
                            </div>

                            {/* Direct Advance Action Button on Card */}
                            {moves.length > 0 && (
                              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                {moves.slice(0, 1).map((nextStatus) => {
                                  const lbl = ACTION_LABEL[nextStatus] || { en: nextStatus, hi: nextStatus, bn: nextStatus };
                                  return (
                                    <button
                                      key={nextStatus}
                                      disabled={busy}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        move(t, nextStatus);
                                      }}
                                      style={{
                                        width: "100%",
                                        padding: "5px 0",
                                        borderRadius: 6,
                                        background: T.primarySoft,
                                        color: T.primary,
                                        border: "none",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      {tc(lbl)}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Mobile layout (Screen < 768px): 100% untouched */
        <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {[["open", { en: "To do", hi: "करना है", bn: "করতে হবে" }],
              ["done", { en: "Done", hi: "हो गया", bn: "হয়ে গেছে" }],
              ["all",  { en: "All", hi: "सभी", bn: "সব" }]].map(([id, label]) => (
              <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>{tc(label)}</Chip>
            ))}
            <div style={{ flex: 1 }} />
            {canCreate && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Icon name="Plus" size={15} /> {tc({ en: "New", hi: "नया", bn: "নতুন" })}
              </Button>
            )}
          </div>

          {!shown.length ? (
            <EmptyState icon="ClipboardList"
              title={tc({ en: "Nothing here", hi: "यहाँ कुछ नहीं", bn: "এখানে কিছু নেই" })}
              body={canCreate
                ? tc({ en: "Create a task and assign it to someone on your team.",
                       hi: "एक कार्य बनाएँ और अपनी टीम के किसी सदस्य को सौंपें।",
                       bn: "একটি কাজ তৈরি করে দলের কাউকে দিন।" })
                : tc({ en: "You have no tasks assigned right now.",
                       hi: "अभी आपको कोई कार्य नहीं सौंपा गया है।",
                       bn: "এখন আপনাকে কোনও কাজ দেওয়া হয়নি।" })} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {shown.map((t) => <TaskRow key={t.id} task={t} tc={tc} onOpen={() => setOpenTask(t)} />)}
            </div>
          )}
        </div>
      )}

      <TaskSheet task={openTask} space={space} busy={busy} tc={tc}
        onClose={() => setOpenTask(null)} onMove={move} />

      {canCreate && (
        <CreateSheet open={createOpen} space={space} tc={tc} toast={toast}
          onClose={() => setCreateOpen(false)}
          onCreated={(t) => { setTasks((l) => [t, ...l]); farmSpaceService.prependTask(space.id, t); setCreateOpen(false); }} />
      )}
    </>
  );
}

function StatusPill({ status, overdue, tc }) {
  /* Overdue outranks the status: a pending task three days late is not
     usefully described as "pending". */
  const meta = overdue
    ? { a: "red", label: { en: "Overdue", hi: "विलंबित", bn: "বিলম্বিত" } }
    : STATUS_META[status] || STATUS_META.pending;
  const [fg, bg] = TONE[meta.a] || TONE.faint;
  return (
    <span style={{ background: bg, color: fg, borderRadius: 99, padding: "2.5px 8px",
      fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>{tc(meta.label)}</span>
  );
}

function TaskRow({ task, tc, onOpen }) {
  const [pfg] = TONE[PRIORITY_TONE[task.priority]] || TONE.faint;
  return (
    <Card pad={0}>
      <button onClick={onOpen}
        style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 11, padding: "12px 12px",
          background: "none", border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
        <div style={{ width: 8, height: 8, borderRadius: 99, background: pfg, marginTop: 6, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, flex: 1, minWidth: 0 }}>{task.title}</span>
            <StatusPill status={task.status} overdue={task.overdue} tc={tc} />
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
            {task.assignee_name || task.assignee_phone || task.assignee_agrios_id || tc({ en: "Unassigned", hi: "किसी को नहीं", bn: "কাউকে দেওয়া হয়নি" })}
            {task.unit ? ` · ${task.unit}` : ""}
            {task.due_date ? ` · ${tc({ en: "due", hi: "देय", bn: "সময়" })} ${String(task.due_date).slice(0, 10)}` : ""}
          </div>
        </div>
      </button>
    </Card>
  );
}

function TaskSheet({ task, space, busy, tc, onClose, onMove }) {
  const [note, setNote] = useState("");
  useEffect(() => { setNote(""); }, [task?.id]);
  if (!task) return null;

  /* The same table the server enforces, so no button here can 403. */
  const moves = allowedTransitions(
    { user_id: space?.user_id, role: space?.role, permissions: space?.permissions, status: "active" },
    task,
  );

  return (
    <BottomSheet open onClose={onClose} title={task.title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StatusPill status={task.status} overdue={task.overdue} tc={tc} />
          <span style={{ fontSize: 12.5, color: T.inkSoft }}>
            {task.assignee_name || task.assignee_phone || task.assignee_agrios_id || tc({ en: "Unassigned", hi: "किसी को नहीं", bn: "কাউকে দেওয়া হয়নি" })}
          </span>
        </div>

        {task.description && (
          <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55 }}>{task.description}</div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, color: T.inkSoft }}>
          {task.unit && <span>{tc({ en: "Unit", hi: "इकाई", bn: "ইউনিট" })}: {task.unit}</span>}
          {task.due_date && <span>{tc({ en: "Due", hi: "देय", bn: "সময়" })}: {String(task.due_date).slice(0, 10)}</span>}
          {task.creator_name && <span>{tc({ en: "By", hi: "द्वारा", bn: "দিয়েছেন" })}: {task.creator_name}</span>}
        </div>

        {task.notes && (
          <Card pad={12} style={{ background: T.surface2 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.inkFaint, marginBottom: 4 }}>
              {tc({ en: "NOTE", hi: "टिप्पणी", bn: "নোট" })}
            </div>
            <div style={{ fontSize: 13, color: T.ink }}>{task.notes}</div>
          </Card>
        )}

        {moves.length > 0 && (
          <>
            {(moves.includes("completed") || moves.includes("rejected")) && (
              <Input label={tc({ en: "Add a note (optional)", hi: "टिप्पणी जोड़ें (वैकल्पिक)", bn: "নোট যোগ করুন (ঐচ্ছিক)" })}
                placeholder={tc({ en: "What was done?", hi: "क्या किया गया?", bn: "কী করা হয়েছে?" })}
                value={note} onChange={setNote} maxLength={2000} />
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {moves.map((m) => (
                <div key={m} style={{ flex: m === "cancelled" ? "1 1 100%" : "1 1 45%" }}>
                  <Button full disabled={busy}
                    variant={m === "cancelled" || m === "rejected" ? "soft" : "solid"}
                    onClick={() => onMove(task, m, note || null)}>
                    {tc(ACTION_LABEL[m])}
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function CreateSheet({ open, space, tc, toast, onClose, onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", unit: "", priority: "medium", due_date: "", assigned_to: "" });
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !space) return;
    farmSpaceService.members(space.id).then(setMembers).catch(() => setMembers([]));
  }, [open, space]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim() || busy) return;
    setBusy(true);
    try {
      const created = await farmSpaceApi.createTask(space.id, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        unit: form.unit.trim() || undefined,
        priority: form.priority,
        due_date: form.due_date || undefined,
        assigned_to: form.assigned_to || undefined,
      });
      onCreated(created);
      setForm({ title: "", description: "", unit: "", priority: "medium", due_date: "", assigned_to: "" });
    } catch (err) {
      toast(err?.status === 400 || err?.status === 403 ? err.message : farmErrorText(err?.reason, tc), "error");
    } finally { setBusy(false); }
  };

  return (
    <BottomSheet open={open} onClose={onClose}
      title={tc({ en: "New task", hi: "नया कार्य", bn: "নতুন কাজ" })}>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <Input label={tc({ en: "What needs doing?", hi: "क्या करना है?", bn: "কী করতে হবে?" })}
          placeholder={tc({ en: "e.g. Clean poultry shed 1", hi: "उदा. मुर्गी शेड 1 साफ़ करें", bn: "যেমন মুরগির শেড ১ পরিষ্কার" })}
          value={form.title} onChange={set("title")} maxLength={140} />

        <Dropdown label={tc({ en: "Assign to", hi: "किसे सौंपें", bn: "কাকে দেবেন" })}
          value={form.assigned_to} onChange={set("assigned_to")}
          options={[{ value: "", label: tc({ en: "Nobody yet", hi: "अभी किसी को नहीं", bn: "এখনও কাউকে নয়" }) },
            ...members.map((m) => ({ value: m.user_id, label: farmSpaceService.displayName(m) || "—" }))]} />

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Dropdown label={tc({ en: "Priority", hi: "प्राथमिकता", bn: "অগ্রাধিকার" })}
              value={form.priority} onChange={set("priority")}
              options={[
                { value: "high",   label: tc({ en: "High", hi: "उच्च", bn: "উচ্চ" }) },
                { value: "medium", label: tc({ en: "Medium", hi: "मध्यम", bn: "মাঝারি" }) },
                { value: "low",    label: tc({ en: "Low", hi: "निम्न", bn: "নিম্ন" }) },
              ]} />
          </div>
          <div style={{ flex: 1 }}>
            <Input label={tc({ en: "Due date", hi: "देय तिथि", bn: "শেষ তারিখ" })} type="date"
              value={form.due_date} onChange={set("due_date")} />
          </div>
        </div>

        <Input label={tc({ en: "Farm unit (optional)", hi: "फ़ार्म इकाई (वैकल्पिक)", bn: "খামার ইউনিট (ঐচ্ছিক)" })}
          placeholder={tc({ en: "Shed 1, Field 3…", hi: "शेड 1, खेत 3…", bn: "শেড ১, জমি ৩…" })}
          value={form.unit} onChange={set("unit")} maxLength={80} />

        <Button full onClick={submit} disabled={busy || !form.title.trim()}>
          {busy ? tc({ en: "Creating…", hi: "बन रहा है…", bn: "তৈরি হচ্ছে…" })
                : tc({ en: "Create task", hi: "कार्य बनाएँ", bn: "কাজ তৈরি করুন" })}
        </Button>
      </div>
    </BottomSheet>
  );
}
