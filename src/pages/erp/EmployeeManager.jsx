import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Button, Chip, Card } from "../../components/index.js";
import Icon from "../../components/Icon.jsx";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { employeeService, EMPLOYEE_TYPES, DEPARTMENTS, ATTENDANCE_STATUSES } from "../../services/employees/employeeService.js";
import { rupee } from "../../utils/format.js";
import StatTile from "../../components/erp/StatTile.jsx";
import { EmptyHint, Pill } from "../../components/erp/RecordList.jsx";

const TABS = ["Team", "Attendance", "Wages"];
const ymNow = () => new Date().toISOString().slice(0, 7);
const initials = (n) => (n || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const NEW_FORM = { name: "", designation: "field_worker", department: "", type: "permanent", phone: "", dailyWage: "", joiningDate: new Date().toISOString().slice(0, 10) };

export default function EmployeeManager() {
  const { pop, toast, push } = useApp();
  const [tab, setTab]         = useState("Team");
  const [employees, setEmployees] = useState([]);
  const [todayMap, setTodayMap]   = useState({});
  const [wages, setWages]     = useState([]);
  const [tick, setTick]       = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(NEW_FORM);
  const [delId, setDelId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [markEmp, setMarkEmp] = useState(null);      // employee being detail-marked
  const [markForm, setMarkForm] = useState({});

  const designationOpts = employeeService.designations().map((d) => ({ value: d.id, label: d.label }));

  useEffect(() => {
    employeeService.getAll().then(setEmployees);
    employeeService.todayStatus().then(setTodayMap);
    employeeService.monthWages(undefined, ymNow()).then(setWages);
    employeeService.attendanceSummary().then(setSummary);
  }, [tick]);

  const openMark = async (e) => {
    const rows = await employeeService.getAttendance(e.id);
    const today = rows.find((r) => r.date === new Date().toISOString().slice(0, 10)) || {};
    setMarkForm({ status: today.status || "present", checkIn: today.checkIn || "", checkOut: today.checkOut || "", overtimeHours: today.overtimeHours || "", remarks: today.remarks || "" });
    setMarkEmp(e);
  };
  const saveMark = async () => {
    await employeeService.mark(markEmp.id, markForm);
    setMarkEmp(null); refresh(); toast("Attendance saved", "success");
  };

  const add = async () => {
    if (!form.name) return;
    await employeeService.add(form);
    setOpen(false); setForm(NEW_FORM);
    refresh(); toast("Employee added", "success");
  };

  const mark = async (id, status) => {
    await employeeService.mark(id, status);
    refresh(); toast(`Marked ${status}`, "success");
  };

  const handleDelete = async () => { await employeeService.remove(delId); setDelId(null); refresh(); toast("Removed", "info"); };

  const presentToday = Object.values(todayMap).filter((s) => s === "present" || s === "halfday").length;
  const totalWages = wages.reduce((s, w) => s + w.wage, 0);

  const ATT_BTNS = [
    { status: "present", label: "P", fg: T.primary, bg: T.primarySoft },
    { status: "halfday", label: "½", fg: T.orange,  bg: T.orangeSoft  },
    { status: "absent",  label: "A", fg: T.red,     bg: T.redSoft     },
  ];

  return (
    <>
      <AppBar title="Team" onBack={pop} action={
        <button onClick={() => setOpen(true)}
          style={{ background: T.blue, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" /> Add
        </button>
      } />

      <div style={{ display: "flex", gap: 10, padding: "8px 16px 4px", overflowX: "auto" }}>
        <StatTile a="blue" label="Employees" value={employees.length} />
        <StatTile a="primary" label="Present Today" value={presentToday} />
        <StatTile a="orange" label="Wages This Month" value={rupee(totalWages)} minWidth={130} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {TABS.map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {employees.length === 0 && <EmptyHint icon="Users" text="Add farm workers to track attendance and wages" />}

        {tab === "Team" && employees.map((e) => (
          <Card key={e.id} pad={13} onClick={() => push({ kind: "employeeDetail", props: { id: e.id } })} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              {e.photo
                ? <img src={e.photo} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 40, height: 40, borderRadius: 10, background: T.blueSoft, color: T.blue, display: "grid", placeItems: "center", flexShrink: 0, fontFamily: T.display, fontWeight: 800, fontSize: 14 }}>{initials(e.name)}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</span>
                  {e.status && e.status !== "active" && <Pill fg={T.orange} bg={T.orangeSoft}>{employeeService.statusLabel(e.status).toUpperCase()}</Pill>}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {employeeService.jobTitle(e)}
                  {e.department ? ` · ${employeeService.deptLabel(e.department)}` : ""}
                  {e.dailyWage ? ` · ${rupee(Number(e.dailyWage))}/day` : ""}
                </div>
                <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 1 }}>{e.code || ""}</div>
              </div>
              <button onClick={(ev) => { ev.stopPropagation(); setDelId(e.id); }} aria-label="Remove employee"
                style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4 }}>
                <Icon name="Trash2" size={15} />
              </button>
              <Icon name="ChevronRight" size={16} style={{ color: T.inkFaint }} />
            </div>
          </Card>
        ))}

        {tab === "Attendance" && summary && employees.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 4 }}>
            <AttPill label="Present" value={summary.present + summary.late + summary.overtime} fg={T.primary} bg={T.primarySoft} />
            <AttPill label="Absent" value={summary.absent} fg={T.red} bg={T.redSoft} />
            <AttPill label="Leave" value={summary.leave} fg={T.blue} bg={T.blueSoft} />
            <AttPill label="Half day" value={summary.halfday} fg={T.orange} bg={T.orangeSoft} />
            <AttPill label="Not marked" value={summary.notMarked} fg={T.inkSoft} bg={T.surface2} />
          </div>
        )}

        {tab === "Attendance" && employees.map((e) => {
          const st = todayMap[e.id];
          const meta = st ? ATTENDANCE_STATUSES.find((a) => a.id === st) : null;
          return (
            <Card key={e.id} pad={13}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}>
                    {e.name}
                    {meta && <Pill fg={T[meta.tone] || T.inkSoft} bg={meta.tone === "primary" ? T.primarySoft : meta.tone === "red" ? T.redSoft : meta.tone === "orange" ? T.orangeSoft : meta.tone === "blue" ? T.blueSoft : T.surface2}>{meta.label.toUpperCase()}</Pill>}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Mark today · tap ⓘ for shift & overtime</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {ATT_BTNS.map((b) => (
                    <button key={b.status} onClick={() => mark(e.id, b.status)} aria-label={b.status}
                      style={{ width: 34, height: 34, borderRadius: 10, border: "none", cursor: "pointer",
                        background: st === b.status ? b.fg : b.bg, color: st === b.status ? "#fff" : b.fg,
                        fontWeight: 800, fontSize: 13, fontFamily: T.body }}>
                      {b.label}
                    </button>
                  ))}
                  <button onClick={() => openMark(e)} aria-label="Attendance details"
                    style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.line}`, cursor: "pointer",
                      background: T.surface, color: T.inkSoft, display: "grid", placeItems: "center" }}>
                    <Icon name="Clock" size={16} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}

        {tab === "Wages" && (
          wages.length === 0
            ? (employees.length > 0 && <EmptyHint icon="Banknote" text="Mark attendance to build this month's wage sheet" />)
            : wages.map((w) => (
              <Card key={w.employee.id} pad={13}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{w.employee.name}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      {w.daysWorked} day{w.daysWorked !== 1 ? "s" : ""} worked this month
                      {w.employee.dailyWage ? ` × ${rupee(Number(w.employee.dailyWage))}` : " · set daily wage to compute"}
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.primary, fontFamily: T.display }}>
                    {rupee(w.wage)}
                  </div>
                </div>
              </Card>
            ))
        )}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Add Employee">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Name" placeholder="e.g. Ramesh" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Dropdown label="Designation" value={form.designation} onChange={(v) => setForm((f) => ({ ...f, designation: v }))} options={designationOpts} />
          <Dropdown label="Department" value={form.department} onChange={(v) => setForm((f) => ({ ...f, department: v }))}
            options={[{ value: "", label: "— Select —" }, ...DEPARTMENTS.map((d) => ({ value: d.id, label: d.label }))]} />
          <Dropdown label="Employee type" value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))}
            options={EMPLOYEE_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          <Input label="Joining date" type="date" value={form.joiningDate} onChange={(v) => setForm((f) => ({ ...f, joiningDate: v }))} />
          <Input label="Phone" placeholder="Optional" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
          <Input label="Daily wage (₹)" type="number" placeholder="0" value={form.dailyWage} onChange={(v) => setForm((f) => ({ ...f, dailyWage: v }))} />
          <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.5 }}>Add more details (address, emergency contact, farm) after saving — tap the employee to open their profile.</div>
          <Button full onClick={add} disabled={!form.name}>Add Employee</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!markEmp} onClose={() => setMarkEmp(null)} title={markEmp ? `Attendance · ${markEmp.name}` : ""}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label="Status" value={markForm.status} onChange={(v) => setMarkForm((f) => ({ ...f, status: v }))}
            options={ATTENDANCE_STATUSES.map((a) => ({ value: a.id, label: a.label }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Input label="Check-in" type="time" value={markForm.checkIn} onChange={(v) => setMarkForm((f) => ({ ...f, checkIn: v }))} /></div>
            <div style={{ flex: 1 }}><Input label="Check-out" type="time" value={markForm.checkOut} onChange={(v) => setMarkForm((f) => ({ ...f, checkOut: v }))} /></div>
          </div>
          <Input label="Overtime hours" type="number" placeholder="0" value={markForm.overtimeHours} onChange={(v) => setMarkForm((f) => ({ ...f, overtimeHours: v }))} />
          <Input label="Remarks" placeholder="Optional" value={markForm.remarks} onChange={(v) => setMarkForm((f) => ({ ...f, remarks: v }))} />
          <Button full onClick={saveMark}>Save attendance</Button>
        </div>
      </BottomSheet>

      <Dialog open={!!delId} title="Remove employee?" onClose={() => setDelId(null)}
        actions={[
          { label: "Cancel", variant: "outline", onClick: () => setDelId(null) },
          { label: "Remove", variant: "danger",  onClick: handleDelete },
        ]}>
        <div style={{ fontSize: 14, color: T.inkSoft }}>The profile and attendance history will be removed.</div>
      </Dialog>
    </>
  );
}

function AttPill({ label, value, fg, bg }) {
  return (
    <div style={{ flexShrink: 0, minWidth: 78, background: bg, borderRadius: T.rLg, padding: "10px 12px" }}>
      <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 800, color: fg }}>{value}</div>
      <div style={{ fontSize: 11, color: fg, opacity: .85 }}>{label}</div>
    </div>
  );
}
