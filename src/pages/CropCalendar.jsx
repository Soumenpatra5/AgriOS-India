import { useState, useMemo, useEffect } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card, Chip, SectionHeader, IconTile, Button } from "../components/index.js";
import { BottomSheet, Dialog, Dropdown, Input } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { cropCalendarService, CROPS } from "../services/calendar/cropCalendarService.js";
import { reminderService } from "../services/calendar/reminderService.js";

const FILTERS = ["Upcoming", "Overdue", "Done"];

const CROP_OPTIONS = [
  { value: "", label: "Select crop…" },
  ...CROPS.map((c) => ({ value: c.id, label: `${c.name} (${c.season})` })),
];

const TODAY_STR = new Date().toISOString().slice(0, 10);

export default function CropCalendar() {
  const { pop, toast, tc } = useApp();
  const [filter, setFilter]   = useState("Upcoming");
  const [tick, setTick]       = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm]       = useState({ cropId: "", sowingDate: "", areaAcres: "", fieldName: "" });

  const instances    = useMemo(() => cropCalendarService.all(),            [tick]);
  const overdueCount = useMemo(() => cropCalendarService.overdueTasks().length, [tick]);
  const weekCount    = useMemo(() => cropCalendarService.upcomingTasks(7).length, [tick]);

  const tasks = useMemo(() => {
    if (filter === "Upcoming") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return cropCalendarService.allTasks().filter((t) => !t.done && new Date(t.dueDate) >= today);
    }
    if (filter === "Overdue") return cropCalendarService.overdueTasks();
    return cropCalendarService.allTasks().filter((t) => t.done);
  }, [tick, filter]);

  const refresh = () => setTick((n) => n + 1);
  useEffect(() => { reminderService.boot(); }, []);

  const toggleTask = (task) => {
    if (task.done) cropCalendarService.markUndone(task.taskKey);
    else { cropCalendarService.markDone(task.taskKey); reminderService.remove(task.taskKey); }
    refresh();
  };

  const toggleReminder = (task) => {
    if (reminderService.has(task.taskKey)) {
      reminderService.remove(task.taskKey);
      toast(tc({ en: "Reminder removed", hi: "रिमाइंडर हटाया", bn: "রিমাইন্ডার সরানো হয়েছে" }), "info");
    } else {
      const label = `${task.type.label} — ${task.cropName}${task.note ? ` (${task.note})` : ""}`;
      reminderService.set(task.taskKey, { label, dueDate: task.dueDate, hoursBefore: 24 });
      toast(tc({ en: "Reminder set for 1 day before", hi: "1 दिन पहले रिमाइंडर सेट", bn: "১ দিন আগে রিমাইন্ডার সেট" }), "success");
    }
    refresh();
  };

  const canSubmit = !!(form.cropId && form.sowingDate);

  const handleAdd = () => {
    cropCalendarService.add({
      cropId:    form.cropId,
      sowingDate: form.sowingDate,
      areaAcres: parseFloat(form.areaAcres) || 0,
      fieldName: form.fieldName.trim(),
    });
    setForm({ cropId: "", sowingDate: "", areaAcres: "", fieldName: "" });
    setAddOpen(false);
    refresh();
    toast(tc({en:"Crop registered", hi:"फसल दर्ज हुई", bn:"ফসল নিবন্ধিত হয়েছে"}), "success");
  };

  const handleDelete = () => {
    cropCalendarService.remove(deleteId);
    setDeleteId(null);
    refresh();
    toast(tc({en:"Crop removed", hi:"फसल हटाई गई", bn:"ফসল সরানো হয়েছে"}), "success");
  };

  return (
    <>
      <AppBar title={tc({en:"Crop Calendar", hi:"फसल कैलेंडर", bn:"ফসল ক্যালেন্ডার"})} onBack={pop} action={
        <button onClick={() => setAddOpen(true)}
          style={{ background: T.primary, border: "none", borderRadius: 12,
            padding: "8px 14px", cursor: "pointer", color: "#fff",
            display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> {tc({en:"Add crop", hi:"फसल जोड़ें", bn:"ফসল যোগ করুন"})}
        </button>
      } />

      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column",
        gap: 20, animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* Empty state */}
        {instances.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "64px 24px", textAlign: "center", gap: 18 }}>
            <div style={{ width: 68, height: 68, borderRadius: 22, background: T.primarySoft,
              display: "grid", placeItems: "center", color: T.primary }}>
              <Icon name="CalendarDays" size={34} />
            </div>
            <div>
              <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 700, color: T.ink }}>
                {tc({en:"No crops yet", hi:"अभी कोई फसल नहीं", bn:"এখনও কোনো ফসল নেই"})}
              </div>
              <div style={{ fontSize: 13.5, color: T.inkSoft, marginTop: 5, lineHeight: 1.55 }}>
                {tc({en:"Register a crop to get a personalised task schedule with real due dates.", hi:"व्यक्तिगत कार्य सूची पाने के लिए फसल दर्ज करें।", bn:"ব্যক্তিগত কাজের তালিকা পেতে ফসল নিবন্ধন করুন।"})}
              </div>
            </div>
            <Button onClick={() => setAddOpen(true)}>{tc({en:"Register first crop", hi:"पहली फसल दर्ज करें", bn:"প্রথম ফসল নিবন্ধন করুন"})}</Button>
          </div>
        )}

        {instances.length > 0 && (
          <>
            {/* Summary tiles */}
            <div style={{ display: "flex", gap: 10 }}>
              <SummaryTile icon="CalendarDays" label={tc({en:"Crops", hi:"फसलें", bn:"ফসল"})}     value={instances.length} bg={T.primarySoft} color={T.primary} />
              <SummaryTile icon="Timer"        label={tc({en:"This week", hi:"इस सप्ताह", bn:"এই সপ্তাহ"})} value={weekCount}         bg={T.orangeSoft}  color={T.orange}  />
              <SummaryTile icon="AlertCircle"  label={tc({en:"Overdue", hi:"विलंबित", bn:"বিলম্বিত"})}   value={overdueCount}      bg={T.redSoft}     color={T.red}     />
            </div>

            {/* Registered crop cards */}
            <div>
              <SectionHeader title={tc({en:"Registered crops", hi:"दर्ज फसलें", bn:"নিবন্ধিত ফসল"})} />
              <div style={{ display: "flex", gap: 12, overflowX: "auto",
                paddingBottom: 4, marginLeft: -16, paddingLeft: 16, marginRight: -16, paddingRight: 16 }}>
                {instances.map((inst) => <CropCard key={inst.id} inst={inst} onDelete={() => setDeleteId(inst.id)} />)}
              </div>
            </div>

            {/* Task list */}
            <div>
              <SectionHeader title={tc({en:"Tasks", hi:"कार्य", bn:"কাজ"})} />
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {FILTERS.map((f) => (
                  <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
                    {tc({Upcoming:{en:"Upcoming",hi:"आगामी",bn:"আসন্ন"}, Overdue:{en:"Overdue",hi:"विलंबित",bn:"বিলম্বিত"}, Done:{en:"Done",hi:"पूर्ण",bn:"সম্পন্ন"}}[f])}
                  </Chip>
                ))}
              </div>

              {tasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 0",
                  color: T.inkFaint, fontSize: 14 }}>
                  {tc({Upcoming:{en:"No upcoming tasks",hi:"कोई आगामी कार्य नहीं",bn:"কোনো আসন্ন কাজ নেই"}, Overdue:{en:"No overdue tasks",hi:"कोई विलंबित कार्य नहीं",bn:"কোনো বিলম্বিত কাজ নেই"}, Done:{en:"No done tasks",hi:"कोई पूर्ण कार्य नहीं",bn:"কোনো সম্পন্ন কাজ নেই"}}[filter])}
                </div>
              ) : (
                <Card pad={6}>
                  {tasks.map((task, i) => (
                    <TaskRow key={task.taskKey} task={task} i={i}
                      onToggle={() => toggleTask(task)}
                      onReminder={() => toggleReminder(task)} />
                  ))}
                </Card>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add crop sheet */}
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={tc({en:"Register crop", hi:"फसल दर्ज करें", bn:"ফসল নিবন্ধন করুন"})}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Dropdown
            label={tc({en:"Crop *", hi:"फसल *", bn:"ফসল *"})}
            value={form.cropId}
            onChange={(v) => setForm((f) => ({ ...f, cropId: v }))}
            options={CROP_OPTIONS}
          />
          <Input
            label={tc({en:"Sowing / planting date *", hi:"बुवाई / रोपण तिथि *", bn:"বপন / রোপণ তারিখ *"})}
            type="date"
            value={form.sowingDate}
            onChange={(v) => setForm((f) => ({ ...f, sowingDate: v }))}
          />
          <Input
            label={tc({en:"Area (acres)", hi:"क्षेत्रफल (एकड़)", bn:"ক্ষেত্রফল (একর)"})}
            type="number"
            value={form.areaAcres}
            onChange={(v) => setForm((f) => ({ ...f, areaAcres: v }))}
            placeholder={tc({en:"e.g. 2.5", hi:"जैसे 2.5", bn:"যেমন 2.5"})}
          />
          <Input
            label={tc({en:"Field name (optional)", hi:"खेत का नाम (वैकल्पिक)", bn:"জমির নাম (ঐচ্ছিক)"})}
            value={form.fieldName}
            onChange={(v) => setForm((f) => ({ ...f, fieldName: v }))}
            placeholder={tc({en:"e.g. North field", hi:"जैसे उत्तर खेत", bn:"যেমন উত্তর জমি"})}
          />
          <Button full disabled={!canSubmit} onClick={handleAdd}>{tc({en:"Save crop", hi:"फसल सहेजें", bn:"ফসল সংরক্ষণ করুন"})}</Button>
        </div>
      </BottomSheet>

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={tc({en:"Remove crop?", hi:"फसल हटाएं?", bn:"ফসল সরাবেন?"})}
        body={tc({en:"This will remove the crop and all its task history.", hi:"इससे फसल और उसका सारा कार्य इतिहास हट जाएगा।", bn:"এটি ফসল এবং তার সমস্ত কাজের ইতিহাস সরিয়ে দেবে।"})}
        icon="Trash2"
        danger
        confirmLabel={tc({en:"Remove", hi:"हटाएं", bn:"সরান"})}
        cancelLabel={tc({en:"Cancel", hi:"रद्द करें", bn:"বাতিল"})}
        onConfirm={handleDelete}
      />
    </>
  );
}

function CropCard({ inst, onDelete }) {
  const { tc } = useApp();
  const def      = cropCalendarService.cropDef(inst.cropId);
  const sowDays  = Math.floor((Date.now() - new Date(inst.sowingDate)) / 86400000);
  const daysLeft = def ? def.days - sowDays : null;

  return (
    <div style={{ minWidth: 162, background: T.surface, border: `1px solid ${T.line}`,
      borderRadius: T.rLg, padding: 14, flexShrink: 0, position: "relative" }}>
      <button onClick={onDelete}
        style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none",
          cursor: "pointer", color: T.inkFaint, display: "flex", padding: 4 }}>
        <Icon name="X" size={14} />
      </button>
      <IconTile name={def?.icon || "Sprout"} a="primary" size={36} iconSize={17} />
      <div style={{ fontFamily: T.display, fontSize: 15, fontWeight: 700,
        color: T.ink, marginTop: 10 }}>{def?.name}</div>
      {inst.fieldName && (
        <div style={{ fontSize: 11.5, color: T.inkSoft }}>{inst.fieldName}</div>
      )}
      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{tc({en:`Sown ${inst.sowingDate}`, hi:`बुवाई ${inst.sowingDate}`, bn:`বপন ${inst.sowingDate}`})}</div>
      {inst.areaAcres > 0 && (
        <div style={{ fontSize: 11.5, color: T.inkSoft }}>{inst.areaAcres} ac</div>
      )}
      {daysLeft !== null && (
        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 8, padding: "3px 8px",
          borderRadius: 7, display: "inline-block",
          background: daysLeft > 0 ? T.primarySoft : T.redSoft,
          color: daysLeft > 0 ? T.primary : T.red }}>
          {daysLeft > 0 ? tc({en:`${daysLeft}d to harvest`, hi:`कटाई में ${daysLeft} दिन`, bn:`ফসল কাটতে ${daysLeft} দিন`}) : tc({en:"Harvest due", hi:"कटाई का समय", bn:"ফসল কাটার সময়"})}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, i, onToggle, onReminder }) {
  const { tc } = useApp();
  const hasReminder = reminderService.has(task.taskKey);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.floor((new Date(task.dueDate) - today) / 86400000);

  let dateLabel;
  if (task.done)    dateLabel = tc({en:"Done", hi:"पूर्ण", bn:"সম্পন্ন"});
  else if (diff < 0) dateLabel = tc({en:`${Math.abs(diff)}d overdue`, hi:`${Math.abs(diff)} दिन विलंबित`, bn:`${Math.abs(diff)} দিন বিলম্বিত`});
  else if (diff === 0) dateLabel = tc({en:"Today", hi:"आज", bn:"আজ"});
  else if (diff === 1) dateLabel = tc({en:"Tomorrow", hi:"कल", bn:"আগামীকাল"});
  else dateLabel = task.dueDate;

  const dateColor = task.done ? T.inkFaint
    : diff < 0 ? T.red
    : diff <= 1 ? T.orange
    : T.inkSoft;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px",
      borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
      <button onClick={onToggle} aria-label="Toggle done"
        style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, cursor: "pointer",
          display: "grid", placeItems: "center",
          border: `1.5px solid ${task.done ? T.primary : T.line}`,
          background: task.done ? T.primary : "transparent", transition: "all .15s" }}>
        {task.done && <Icon name="Check" size={13} color="#fff" strokeWidth={3} />}
      </button>

      <div style={{ width: 34, height: 34, borderRadius: 11, background: T.surface2,
        color: T.inkSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={task.type.icon} size={17} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600,
          color: task.done ? T.inkFaint : T.ink,
          textDecoration: task.done ? "line-through" : "none" }}>
          {task.type.label}
          {task.note && (
            <span style={{ fontWeight: 400, color: T.inkSoft }}> — {task.note}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: T.inkSoft }}>{task.cropName}</div>
      </div>

      {!task.done && (
        <button onClick={() => onReminder(task)} aria-label={hasReminder ? "Remove reminder" : "Set reminder"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex",
            color: hasReminder ? T.orange : T.inkFaint }}>
          <Icon name={hasReminder ? "BellRing" : "Bell"} size={15} />
        </button>
      )}
      <div style={{ fontSize: 11.5, fontWeight: 600, color: dateColor, flexShrink: 0 }}>
        {dateLabel}
      </div>
    </div>
  );
}

function SummaryTile({ icon, label, value, bg, color }) {
  return (
    <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.line}`,
      borderRadius: T.rLg, padding: "13px 12px" }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: bg, color,
        display: "grid", placeItems: "center", marginBottom: 9 }}>
        <Icon name={icon} size={16} strokeWidth={2.4} />
      </div>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700,
        color: T.ink, marginTop: 1 }}>{value}</div>
    </div>
  );
}
