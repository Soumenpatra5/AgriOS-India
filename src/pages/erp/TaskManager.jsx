import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Button, Chip, Card } from "../../components/index.js";
import Icon from "../../components/Icon.jsx";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { taskService, PRIORITIES, RECURRENCE } from "../../services/tasks/taskService.js";
import { employeeService } from "../../services/employees/employeeService.js";
import { EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

const FILTERS = ["Today", "Upcoming", "Overdue", "Done"];
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (d) => d ? new Date(d + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "No date";

const PRIORITY_STYLE = {
  high:   { fg: "red",    label: "HIGH"   },
  medium: { fg: "orange", label: "MED"    },
  low:    { fg: "blue",   label: "LOW"    },
};

export default function TaskManager() {
  const { pop, toast, can } = useApp();
  const [filter, setFilter]   = useState("Today");
  const [buckets, setBuckets] = useState({ overdue: [], today: [], upcoming: [], done: [] });
  const [employees, setEmployees] = useState([]);
  const [tick, setTick]       = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", dueDate: todayStr(), priority: "medium", recurrence: "", assigneeId: "", note: "" });
  const [delId, setDelId] = useState(null);

  useEffect(() => {
    taskService.buckets().then(setBuckets);
    employeeService.getAll().then(setEmployees);
  }, [tick]);

  const list = filter === "Today" ? buckets.today
    : filter === "Upcoming" ? buckets.upcoming
    : filter === "Overdue" ? buckets.overdue
    : buckets.done;

  const add = async () => {
    if (!form.title) return;
    await taskService.add(form);
    setOpen(false);
    setForm({ title: "", dueDate: todayStr(), priority: "medium", recurrence: "", assigneeId: "", note: "" });
    refresh(); toast("Task added", "success");
  };

  const toggle = async (t) => {
    if (t.status === "done") await taskService.reopen(t.id);
    else {
      const next = await taskService.complete(t.id);
      if (next) toast(`Done — next ${t.recurrence} occurrence created`, "success");
      else toast("Task completed", "success");
    }
    refresh();
  };

  const handleDelete = async () => { await taskService.remove(delId); setDelId(null); refresh(); toast("Deleted", "info"); };

  const assigneeName = (id) => employees.find((e) => e.id === id)?.name;

  const fgOf = (k) => ({ red: T.red, orange: T.orange, blue: T.blue }[k]);
  const bgOf = (k) => ({ red: T.redSoft, orange: T.orangeSoft, blue: T.blueSoft }[k]);

  return (
    <>
      <AppBar title="Tasks" onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.blue, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> Add
        </button>
      } />

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px", overflowX: "auto" }}>
        {FILTERS.map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f}{f === "Overdue" && buckets.overdue.length > 0 ? ` (${buckets.overdue.length})` : ""}
          </Chip>
        ))}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {list.length === 0
          ? <EmptyHint icon="ListChecks" text={filter === "Done" ? "No completed tasks yet" : `No ${filter.toLowerCase()} tasks`} />
          : list.map((t) => {
            const pr = PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.medium;
            return (
              <Card key={t.id} pad={13}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                  <button onClick={() => toggle(t)}
                    style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, cursor: "pointer",
                      border: t.status === "done" ? "none" : `2px solid ${T.line}`,
                      background: t.status === "done" ? T.primary : "transparent",
                      display: "grid", placeItems: "center", marginTop: 1 }}>
                    {t.status === "done" && <Icon name="Check" size={14} color="#fff" strokeWidth={3} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: T.ink,
                      textDecoration: t.status === "done" ? "line-through" : "none",
                      opacity: t.status === "done" ? .6 : 1,
                      display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {t.title}
                      <Pill fg={fgOf(pr.fg)} bg={bgOf(pr.fg)}>{pr.label}</Pill>
                      {t.recurrence && <Pill fg={T.blue} bg={T.blueSoft}>↻ {t.recurrence}</Pill>}
                    </div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 3 }}>
                      {fmtDate(t.dueDate)}
                      {assigneeName(t.assigneeId) ? ` · 👤 ${assigneeName(t.assigneeId)}` : ""}
                      {t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                  {can("records.delete") && (
                  <button onClick={() => setDelId(t.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4, flexShrink: 0 }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                  )}
                </div>
              </Card>
            );
          })}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Add Task">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Task" placeholder="e.g. Vaccinate batch A" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
          <Input label="Due date" type="date" value={form.dueDate} onChange={(v) => setForm((f) => ({ ...f, dueDate: v }))} />
          <Dropdown label="Priority" value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
            options={PRIORITIES.map((p) => ({ value: p.id, label: p.label }))} />
          <Dropdown label="Repeats" value={form.recurrence} onChange={(v) => setForm((f) => ({ ...f, recurrence: v }))}
            options={RECURRENCE.map((r) => ({ value: r.id, label: r.label }))} />
          {employees.length > 0 && (
            <Dropdown label="Assign to" value={form.assigneeId} onChange={(v) => setForm((f) => ({ ...f, assigneeId: v }))}
              options={[{ value: "", label: "Unassigned" }, ...employees.map((e) => ({ value: e.id, label: e.name }))]} />
          )}
          <Input label="Notes" placeholder="Optional" value={form.note} onChange={(v) => setForm((f) => ({ ...f, note: v }))} />
          <Button full onClick={add} disabled={!form.title}>Add Task</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title="Delete task?" onClose={() => setDelId(null)}
        actions={[
          { label: "Cancel", variant: "outline", onClick: () => setDelId(null) },
          { label: "Delete", variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>This task will be permanently removed.</div>
      </Dialog>
    </>
  );
}
