import { useState, useEffect, useMemo } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, Button, BottomSheet, Input, Dropdown } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import {
  employeeService, EMPLOYEE_TYPES, DEPARTMENTS, STATUSES, GENDERS,
} from "../../services/employees/employeeService.js";
import { paymentService } from "../../services/employees/paymentService.js";
import { leaveService, LEAVE_TYPES, leaveDays } from "../../services/employees/leaveService.js";
import { documentService, DOC_TYPES } from "../../services/employees/documentService.js";
import { recordsService, SKILL_LEVELS, TRAINING_STATUSES } from "../../services/employees/recordsService.js";
import { assetService, ASSET_CATEGORIES } from "../../services/assets/assetService.js";
import { taskService } from "../../services/tasks/taskService.js";
import { farmService } from "../../services/farm/farmService.js";
import { rupee } from "../../utils/format.js";

const TONE = { primary: [T.primary, T.primarySoft], orange: [T.orange, T.orangeSoft], red: [T.red, T.redSoft], faint: [T.inkSoft, T.surface2] };
const initials = (n) => (n || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const fmtDate = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

/* Field configs drive both the read-only display and the edit form. */
const PERSONAL = [
  { key: "fatherName", label: "Father's Name" },
  { key: "motherName", label: "Mother's Name" },
  { key: "dob", label: "Date of Birth", type: "date", fmt: fmtDate },
  { key: "gender", label: "Gender", type: "select", options: GENDERS },
  { key: "phone", label: "Mobile Number" },
  { key: "altPhone", label: "Alternate Mobile" },
  { key: "email", label: "Email" },
  { key: "permanentAddress", label: "Permanent Address" },
  { key: "currentAddress", label: "Current Address" },
  { key: "emergencyName", label: "Emergency Contact" },
  { key: "emergencyPhone", label: "Emergency Number" },
  { key: "emergencyRelation", label: "Emergency Relation" },
];

const EMPLOYMENT = [
  { key: "code", label: "Employee ID", readOnly: true },
  { key: "joiningDate", label: "Joining Date", type: "date", fmt: fmtDate },
  { key: "department", label: "Department", type: "select", options: DEPARTMENTS },
  { key: "designation", label: "Designation", type: "designation" },
  { key: "type", label: "Employee Type", type: "select", options: EMPLOYEE_TYPES },
  { key: "status", label: "Status", type: "select", options: STATUSES },
  { key: "reportingManager", label: "Reporting Manager" },
  { key: "farmId", label: "Assigned Farm", type: "farm" },
  { key: "shift", label: "Work Shift" },
  { key: "workingHours", label: "Working Hours" },
  { key: "weeklyOff", label: "Weekly Off" },
  { key: "probation", label: "On Probation", type: "select", options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] },
  { key: "dailyWage", label: "Daily Wage (₹)", type: "number", fmt: (v) => (v ? rupee(Number(v)) : "—") },
  { key: "monthlySalary", label: "Monthly Salary (₹)", type: "number", fmt: (v) => (v ? rupee(Number(v)) : "—") },
  { key: "overtimeRate", label: "Overtime Rate (₹/hr)", type: "number", fmt: (v) => (v ? rupee(Number(v)) : "—") },
  { key: "exitDate", label: "Exit Date", type: "date", fmt: fmtDate },
  { key: "exitReason", label: "Exit Reason" },
];

/* WF-6 add-record field configs, keyed by kind. */
const REC_FIELDS = {
  skill: [
    { key: "name", label: "Skill" },
    { key: "level", label: "Level", type: "select", options: SKILL_LEVELS, default: "beginner" },
    { key: "experience", label: "Experience (years)", type: "number" },
    { key: "certificate", label: "Certificate" },
    { key: "expiryDate", label: "Certificate expiry", type: "date" },
  ],
  training: [
    { key: "name", label: "Training" },
    { key: "trainer", label: "Trainer" },
    { key: "date", label: "Date", type: "date" },
    { key: "duration", label: "Duration" },
    { key: "status", label: "Status", type: "select", options: TRAINING_STATUSES, default: "completed" },
    { key: "certExpiry", label: "Certificate expiry", type: "date" },
  ],
  performance: [
    { key: "rating", label: "Rating", type: "select", options: [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: `${n} / 5` })), default: "3" },
    { key: "reviewDate", label: "Review date", type: "date" },
    { key: "reviewer", label: "Reviewer" },
    { key: "remarks", label: "Remarks" },
  ],
  asset: [
    { key: "name", label: "Asset" },
    { key: "category", label: "Category", type: "select", options: ASSET_CATEGORIES, default: "tool" },
    { key: "condition", label: "Condition" },
    { key: "assignedDate", label: "Assigned date", type: "date" },
  ],
};
const REC_TITLE = { skill: "Add skill", training: "Add training", performance: "Add review", asset: "Assign asset" };

export default function EmployeeDetail({ id }) {
  const { pop, toast } = useApp();
  const [emp, setEmp] = useState(null);
  const [farms, setFarms] = useState([]);
  const [todayAtt, setTodayAtt] = useState(null);
  const [att, setAtt] = useState(null);      // month attendance summary
  const [payments, setPayments] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState("Overview");
  const [editSection, setEditSection] = useState(null); // "personal" | "employment"
  const [form, setForm] = useState({});
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: "casual", fromDate: "", toDate: "", reason: "" });
  const [documents, setDocuments] = useState([]);
  const [docOpen, setDocOpen] = useState(false);
  const [docForm, setDocForm] = useState({ type: "id_proof", name: "", number: "", issueDate: "", expiryDate: "" });
  const [docFile, setDocFile] = useState(null);
  const [docBusy, setDocBusy] = useState(false);
  const [recs, setRecs] = useState({ skill: [], training: [], performance: [], asset: [] });
  const [recAdd, setRecAdd] = useState(null);   // { kind, form }
  const [tick, setTick] = useState(0);

  useEffect(() => {
    employeeService.getById(id).then(setEmp);
    farmService.getAll().then(setFarms);
    const today = new Date().toISOString().slice(0, 10);
    employeeService.getAttendance(id).then((rows) => setTodayAtt(rows.find((r) => r.date === today)?.status || null));
    employeeService.monthAttendance(id, today.slice(0, 7)).then(setAtt);
    paymentService.forEmployee(id).then(setPayments);
    leaveService.forEmployee(id).then(setLeaves);
    leaveService.balance(id).then(setBalance);
    taskService.forEmployee(id).then(setTasks);
    documentService.forEmployee(id).then(setDocuments);
    Promise.all([
      recordsService.forEmployee(id, "skill"),
      recordsService.forEmployee(id, "training"),
      recordsService.forEmployee(id, "performance"),
      assetService.forEmployee(id),
    ]).then(([skill, training, performance, asset]) => setRecs({ skill, training, performance, asset }));
  }, [id, tick]);

  const openRec = (kind) => {
    const form = {};
    REC_FIELDS[kind].forEach((f) => { if (f.default) form[f.key] = f.default; });
    setRecAdd({ kind, form });
  };
  const saveRec = async () => {
    if (recAdd.kind === "asset") await assetService.assignToEmployee({ employeeId: id, ...recAdd.form });
    else await recordsService.add(recAdd.kind, { employeeId: id, employeeName: emp?.name, ...recAdd.form });
    setRecAdd(null); setTick((n) => n + 1);
  };
  const delRec = async (kind, rid) => {
    if (kind === "asset") await assetService.returnFromEmployee(rid);
    else await recordsService.remove(rid);
    setTick((n) => n + 1);
  };

  const uploadDoc = async () => {
    setDocBusy(true);
    await documentService.add({ employeeId: id, ...docForm }, docFile);
    setDocBusy(false); setDocOpen(false);
    setDocForm({ type: "id_proof", name: "", number: "", issueDate: "", expiryDate: "" }); setDocFile(null);
    setTick((n) => n + 1);
  };
  const openDoc = (d) => {
    const url = d.fileUrl || d.fileData;
    if (url) window.open(url, "_blank", "noopener");
  };

  const applyLeave = async () => {
    if (!leaveForm.fromDate) return;
    await leaveService.apply({ employeeId: id, employeeName: emp?.name, ...leaveForm });
    setLeaveOpen(false); setLeaveForm({ type: "casual", fromDate: "", toDate: "", reason: "" });
    setTick((n) => n + 1);
  };
  const decideLeave = async (lid, status) => { await leaveService.decide(lid, status); setTick((n) => n + 1); };

  const farmName = useMemo(() => farms.find((f) => f.id === emp?.farmId)?.name, [farms, emp]);
  const designationOpts = useMemo(() => employeeService.designations().map((d) => ({ value: d.id, label: d.label })), [tick]);

  if (!emp) return <><AppBar title="Employee" onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>Loading…</div></>;

  const jobTitle = employeeService.jobTitle(emp);
  const [stFg, stBg] = TONE[employeeService.statusTone(emp.status)] || TONE.faint;

  const openEdit = (section) => { setForm({ ...emp, customDesignation: "" }); setEditSection(section); };
  const save = async () => {
    const patch = { ...form };
    if (patch.designation === "other" && patch.customDesignation?.trim()) {
      patch.designation = employeeService.addCustomDesignation(patch.customDesignation);
    }
    delete patch.customDesignation;
    if ("farmId" in patch) patch.farmName = farms.find((f) => f.id === patch.farmId)?.name || "";
    await employeeService.update(id, patch);
    setEditSection(null); setTick((n) => n + 1);
    toast("Saved", "success");
  };

  const displayVal = (f) => {
    const v = f.key === "farmId" ? farmName : emp[f.key];
    if (v == null || v === "") return "—";
    if (f.fmt) return f.fmt(v);
    if (f.type === "select") return (f.options.find((o) => o.id === v)?.label) || v;
    if (f.key === "designation") return employeeService.designationLabel(v);
    return String(v);
  };

  const editFields = editSection === "personal" ? PERSONAL : EMPLOYMENT;

  return (
    <>
      <AppBar title="Employee" onBack={pop} action={
        (tab === "Personal" || tab === "Employment") && (
          <button onClick={() => openEdit(tab.toLowerCase())} aria-label="Edit"
            style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: "8px 13px", cursor: "pointer",
              color: T.primary, display: "flex", alignItems: "center", gap: 6, fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
            <Icon name="Pencil" size={14} /> Edit
          </button>
        )
      } />

      {/* header */}
      <div style={{ padding: "6px 16px 0", display: "flex", alignItems: "center", gap: 14 }}>
        {emp.photo
          ? <img src={emp.photo} alt="" style={{ width: 60, height: 60, borderRadius: 18, objectFit: "cover" }} />
          : <div style={{ width: 60, height: 60, borderRadius: 18, background: T.blueSoft, color: T.blue, display: "grid", placeItems: "center", fontFamily: T.display, fontWeight: 800, fontSize: 22 }}>{initials(emp.name)}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 800, color: T.ink }}>{emp.name}</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>{jobTitle}{emp.department ? ` · ${employeeService.deptLabel(emp.department)}` : ""}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: stFg, background: stBg, padding: "2px 8px", borderRadius: 6 }}>{employeeService.statusLabel(emp.status)}</span>
            <span style={{ fontSize: 11.5, color: T.inkFaint }}>{emp.code}</span>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 8, padding: "16px 16px 4px", overflowX: "auto" }}>
        {["Overview", "Personal", "Employment", "Attendance", "Payments", "Leave", "Tasks", "Documents", "Skills", "Training", "Performance", "Assets"].map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px" }}>
        {tab === "Overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <MiniStat label="Today" value={todayAtt ? todayAtt[0].toUpperCase() + todayAtt.slice(1) : "Not marked"} fg={todayAtt === "present" ? T.primary : todayAtt === "absent" ? T.red : T.inkSoft} />
              <MiniStat label={emp.type === "daily_wage" || emp.dailyWage ? "Daily wage" : "Salary"} value={emp.dailyWage ? rupee(Number(emp.dailyWage)) : emp.monthlySalary ? rupee(Number(emp.monthlySalary)) : "—"} fg={T.ink} />
            </div>
            <Card style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <InfoRow label="Type" value={employeeService.typeLabel(emp.type)} first />
              <InfoRow label="Department" value={emp.department ? employeeService.deptLabel(emp.department) : "—"} />
              <InfoRow label="Assigned farm" value={farmName || "—"} />
              <InfoRow label="Joined" value={fmtDate(emp.joiningDate)} />
              <InfoRow label="Mobile" value={emp.phone || "—"} />
            </Card>
            <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.5 }}>
              Attendance, wages, tasks, documents & more arrive in the next workforce phases.
            </div>
          </div>
        )}

        {(tab === "Personal" || tab === "Employment") && (
          <Card style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {(tab === "Personal" ? PERSONAL : EMPLOYMENT).map((f, i) => (
              <InfoRow key={f.key} label={f.label} value={displayVal(f)} first={i === 0} />
            ))}
          </Card>
        )}

        {tab === "Attendance" && att && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>This month</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <MiniStat label="Present" value={att.counts.present + att.counts.late + att.counts.overtime} fg={T.primary} />
              <MiniStat label="Half day" value={att.counts.halfday} fg={T.orange} />
              <MiniStat label="Absent" value={att.counts.absent} fg={T.red} />
              <MiniStat label="Leave" value={att.counts.leave} fg={T.blue} />
              <MiniStat label="Overtime" value={`${att.overtimeHours}h`} fg={T.ink} />
              <MiniStat label="Attendance" value={`${att.percent}%`} fg={att.percent >= 75 ? T.primary : T.orange} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginTop: 4 }}>History</div>
            {att.rows.length === 0
              ? <div style={{ textAlign: "center", padding: "24px 0", color: T.inkFaint, fontSize: 13 }}>No attendance marked this month.</div>
              : <Card pad={6}>
                  {att.rows.map((r, i) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                      <span style={{ fontSize: 12.5, color: T.inkSoft, width: 76, flexShrink: 0 }}>{fmtDate(r.date)}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.ink }}>
                        {employeeService.attStatusLabel(r.status)}
                        {(r.checkIn || r.checkOut) ? <span style={{ fontWeight: 400, color: T.inkSoft }}> · {r.checkIn || "—"}–{r.checkOut || "—"}</span> : ""}
                        {r.overtimeHours ? <span style={{ fontWeight: 400, color: T.inkSoft }}> · OT {r.overtimeHours}h</span> : ""}
                      </span>
                    </div>
                  ))}
                </Card>}
          </div>
        )}

        {tab === "Payments" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Card style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <InfoRow label="Daily wage" value={emp.dailyWage ? rupee(Number(emp.dailyWage)) : "—"} first />
              <InfoRow label="Monthly salary" value={emp.monthlySalary ? rupee(Number(emp.monthlySalary)) : "—"} />
              <InfoRow label="Overtime rate" value={emp.overtimeRate ? `${rupee(Number(emp.overtimeRate))}/hr` : "—"} />
              <InfoRow label="Total paid" value={rupee(payments.filter((p) => p.status === "paid").reduce((s, p) => s + (Number(p.net) || 0), 0))} />
            </Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>Payment history</div>
            {payments.length === 0
              ? <div style={{ textAlign: "center", padding: "24px 0", color: T.inkFaint, fontSize: 13 }}>No payments recorded yet — use the Wages tab to pay.</div>
              : <Card pad={6}>
                  {payments.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 8px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{rupee(Number(p.net))}</div>
                        <div style={{ fontSize: 11.5, color: T.inkSoft }}>
                          {fmtDate(p.date)} · {(p.method || "").toUpperCase()}{p.period ? ` · ${p.period}` : ""}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: p.status === "paid" ? T.primary : T.orange, background: p.status === "paid" ? T.primarySoft : T.orangeSoft, padding: "2px 8px", borderRadius: 6 }}>{(p.status || "paid").toUpperCase()}</span>
                    </div>
                  ))}
                </Card>}
          </div>
        )}

        {tab === "Leave" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>Balance ({new Date().getFullYear()})</div>
              <button onClick={() => setLeaveOpen(true)} style={{ background: T.primarySoft, border: "none", borderRadius: 10, padding: "7px 12px", cursor: "pointer", color: T.primary, fontSize: 12.5, fontWeight: 700, fontFamily: T.body, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon name="Plus" size={14} /> Apply leave
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {balance.map((b) => (
                <div key={b.type} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, color: T.inkSoft }}>{b.label}</div>
                  <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700, color: b.remaining > 0 ? T.primary : T.orange, marginTop: 2 }}>{b.remaining}<span style={{ fontSize: 12, color: T.inkFaint, fontWeight: 500 }}> / {b.allowance} left</span></div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginTop: 4 }}>Requests</div>
            {leaves.length === 0
              ? <div style={{ textAlign: "center", padding: "20px 0", color: T.inkFaint, fontSize: 13 }}>No leave requests.</div>
              : <Card pad={6}>
                  {leaves.map((l, i) => (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 8px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{leaveService.typeLabel(l.type)} · {l.days}d</div>
                        <div style={{ fontSize: 11.5, color: T.inkSoft }}>{fmtDate(l.fromDate)} – {fmtDate(l.toDate)}{l.reason ? ` · ${l.reason}` : ""}</div>
                      </div>
                      {l.status === "pending"
                        ? <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => decideLeave(l.id, "approved")} aria-label="Approve" style={{ background: T.primarySoft, border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: T.primary, display: "flex" }}><Icon name="Check" size={15} /></button>
                            <button onClick={() => decideLeave(l.id, "rejected")} aria-label="Reject" style={{ background: T.redSoft, border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: T.red, display: "flex" }}><Icon name="X" size={15} /></button>
                          </div>
                        : <span style={{ fontSize: 11, fontWeight: 700, color: l.status === "approved" ? T.primary : T.red, background: l.status === "approved" ? T.primarySoft : T.redSoft, padding: "2px 8px", borderRadius: 6 }}>{l.status.toUpperCase()}</span>}
                    </div>
                  ))}
                </Card>}
          </div>
        )}

        {tab === "Tasks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tasks.length === 0
              ? <div style={{ textAlign: "center", padding: "24px 0", color: T.inkFaint, fontSize: 13 }}>No tasks assigned. Assign tasks from the Task Manager.</div>
              : <Card pad={6}>
                  {tasks.map((t, i) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 8px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: t.status === "done" ? T.inkFaint : T.ink, textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</div>
                        <div style={{ fontSize: 11.5, color: T.inkSoft }}>{t.dueDate ? `Due ${fmtDate(t.dueDate)}` : "No due date"}{t.priority ? ` · ${t.priority}` : ""}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: t.status === "done" ? T.primary : T.orange, background: t.status === "done" ? T.primarySoft : T.orangeSoft, padding: "2px 8px", borderRadius: 6 }}>{(t.status || "open").toUpperCase()}</span>
                    </div>
                  ))}
                </Card>}
          </div>
        )}

        {tab === "Documents" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>{documents.length} document{documents.length !== 1 ? "s" : ""}</div>
              <button onClick={() => setDocOpen(true)} style={{ background: T.primarySoft, border: "none", borderRadius: 10, padding: "7px 12px", cursor: "pointer", color: T.primary, fontSize: 12.5, fontWeight: 700, fontFamily: T.body, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon name="Upload" size={14} /> Upload
              </button>
            </div>
            {documents.length === 0
              ? <div style={{ textAlign: "center", padding: "24px 0", color: T.inkFaint, fontSize: 13 }}>No documents yet. Upload IDs, certificates or agreements.</div>
              : <Card pad={6}>
                  {documents.map((d, i) => {
                    const exp = documentService.expiryState(d);
                    const [efg, ebg] = exp === "expired" ? [T.red, T.redSoft] : exp === "expiring_soon" ? [T.orange, T.orangeSoft] : [T.primary, T.primarySoft];
                    return (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 8px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: T.surface2, color: T.inkSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <Icon name="FileText" size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                          <div style={{ fontSize: 11.5, color: T.inkSoft }}>
                            {documentService.typeLabel(d.type)}{d.number ? ` · ${d.number}` : ""}
                            {d.expiryDate ? ` · exp ${fmtDate(d.expiryDate)}` : ""}
                            {d.status === "verified" ? " · ✓ verified" : ""}
                          </div>
                        </div>
                        {d.expiryDate && <span style={{ fontSize: 10.5, fontWeight: 700, color: efg, background: ebg, padding: "2px 7px", borderRadius: 6, flexShrink: 0 }}>{exp === "expiring_soon" ? "SOON" : exp.toUpperCase()}</span>}
                        {(d.fileUrl || d.fileData) && (
                          <button onClick={() => openDoc(d)} aria-label="View" style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, padding: 4, display: "flex" }}><Icon name="Eye" size={16} /></button>
                        )}
                        {d.status !== "verified" && (
                          <button onClick={async () => { await documentService.setStatus(d.id, "verified"); setTick((n) => n + 1); }} aria-label="Verify" style={{ background: "none", border: "none", cursor: "pointer", color: T.primary, padding: 4, display: "flex" }}><Icon name="Check" size={16} /></button>
                        )}
                        <button onClick={async () => { await documentService.remove(d.id); setTick((n) => n + 1); }} aria-label="Delete document" style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4, display: "flex" }}><Icon name="Trash2" size={15} /></button>
                      </div>
                    );
                  })}
                </Card>}
            <div style={{ fontSize: 11, color: T.inkFaint, textAlign: "center", lineHeight: 1.5 }}>Files upload to secure cloud storage when online, else saved on this device and synced later.</div>
          </div>
        )}

        {tab === "Skills" && (
          <RecSection empty="No skills recorded." onAdd={() => openRec("skill")} items={recs.skill}
            row={(r) => ({ title: r.name, sub: `${recordsService.skillLevelLabel(r.level)}${r.experience ? ` · ${r.experience}y exp` : ""}${r.expiryDate ? ` · cert exp ${fmtDate(r.expiryDate)}` : ""}`, onDel: () => delRec("skill", r.id) })} />
        )}
        {tab === "Training" && (
          <RecSection empty="No training recorded." onAdd={() => openRec("training")} items={recs.training}
            row={(r) => ({ title: r.name, sub: `${r.trainer ? `${r.trainer} · ` : ""}${r.date ? fmtDate(r.date) : ""}${r.duration ? ` · ${r.duration}` : ""}`, badge: recordsService.trainingStatusLabel(r.status), onDel: () => delRec("training", r.id) })} />
        )}
        {tab === "Performance" && (
          <RecSection empty="No reviews yet — supervisors add reviews here." onAdd={() => openRec("performance")} items={recs.performance}
            row={(r) => ({ title: `${r.rating || "—"} / 5${r.reviewer ? ` · ${r.reviewer}` : ""}`, sub: `${r.reviewDate ? fmtDate(r.reviewDate) : ""}${r.remarks ? ` · ${r.remarks}` : ""}`, onDel: () => delRec("performance", r.id) })} />
        )}
        {tab === "Assets" && (
          <RecSection empty="No assets assigned." addLabel="Assign" onAdd={() => openRec("asset")} items={recs.asset}
            row={(r) => ({ title: r.name, sub: `${assetService.categoryLabel(r.category)}${r.condition ? ` · ${r.condition}` : ""}${r.assignedDate ? ` · from ${fmtDate(r.assignedDate)}` : ""}`, onDel: () => delRec("asset", r.id) })} />
        )}
      </div>

      {/* edit sheet */}
      <BottomSheet open={!!editSection} onClose={() => setEditSection(null)} title={`Edit ${editSection === "personal" ? "personal" : "employment"} details`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {editFields.filter((f) => !f.readOnly).map((f) => {
            const val = form[f.key] ?? "";
            const set = (v) => setForm((s) => ({ ...s, [f.key]: v }));
            if (f.type === "select") return <Dropdown key={f.key} label={f.label} value={val} onChange={set} options={f.options.map((o) => ({ value: o.id, label: o.label }))} />;
            if (f.type === "designation") return (
              <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Dropdown label={f.label} value={val} onChange={set} options={designationOpts} />
                {form.designation === "other" && <Input label="Custom designation" placeholder="e.g. Tractor Operator" value={form.customDesignation || ""} onChange={(v) => setForm((s) => ({ ...s, customDesignation: v }))} />}
              </div>
            );
            if (f.type === "farm") return <Dropdown key={f.key} label={f.label} value={val} onChange={set} options={[{ value: "", label: "— None —" }, ...farms.map((fm) => ({ value: fm.id, label: fm.name }))]} />;
            return <Input key={f.key} label={f.label} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={val} onChange={set} placeholder={f.type === "date" ? "" : "Optional"} />;
          })}
          <Button full onClick={save}>Save</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Apply leave">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label="Leave type" value={leaveForm.type} onChange={(v) => setLeaveForm((f) => ({ ...f, type: v }))}
            options={LEAVE_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Input label="From" type="date" value={leaveForm.fromDate} onChange={(v) => setLeaveForm((f) => ({ ...f, fromDate: v }))} /></div>
            <div style={{ flex: 1 }}><Input label="To" type="date" value={leaveForm.toDate} onChange={(v) => setLeaveForm((f) => ({ ...f, toDate: v }))} /></div>
          </div>
          {leaveForm.fromDate && <div style={{ fontSize: 12.5, color: T.inkSoft }}>{leaveDays(leaveForm.fromDate, leaveForm.toDate)} day(s)</div>}
          <Input label="Reason" placeholder="Optional" value={leaveForm.reason} onChange={(v) => setLeaveForm((f) => ({ ...f, reason: v }))} />
          <Button full onClick={applyLeave} disabled={!leaveForm.fromDate}>Submit request</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={docOpen} onClose={() => setDocOpen(false)} title="Upload document">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label="Document type" value={docForm.type} onChange={(v) => setDocForm((f) => ({ ...f, type: v }))}
            options={DOC_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          <Input label="Name / title" placeholder="e.g. Aadhaar card" value={docForm.name} onChange={(v) => setDocForm((f) => ({ ...f, name: v }))} />
          <Input label="Document number" placeholder="Optional" value={docForm.number} onChange={(v) => setDocForm((f) => ({ ...f, number: v }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Input label="Issue date" type="date" value={docForm.issueDate} onChange={(v) => setDocForm((f) => ({ ...f, issueDate: v }))} /></div>
            <div style={{ flex: 1 }}><Input label="Expiry date" type="date" value={docForm.expiryDate} onChange={(v) => setDocForm((f) => ({ ...f, expiryDate: v }))} /></div>
          </div>
          <label style={{ display: "block" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, marginBottom: 7 }}>File</div>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              style={{ width: "100%", fontSize: 13, color: T.ink }} />
          </label>
          <Button full onClick={uploadDoc} disabled={docBusy || (!docForm.name && !docFile)}>{docBusy ? "Uploading…" : "Save document"}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!recAdd} onClose={() => setRecAdd(null)} title={recAdd ? REC_TITLE[recAdd.kind] : ""}>
        {recAdd && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {REC_FIELDS[recAdd.kind].map((f) => {
              const val = recAdd.form[f.key] ?? "";
              const set = (v) => setRecAdd((s) => ({ ...s, form: { ...s.form, [f.key]: v } }));
              return f.type === "select"
                ? <Dropdown key={f.key} label={f.label} value={val} onChange={set} options={f.options.map((o) => ({ value: o.id, label: o.label }))} />
                : <Input key={f.key} label={f.label} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={val} onChange={set} placeholder={f.type === "date" ? "" : "Optional"} />;
            })}
            <Button full onClick={saveRec} disabled={!recAdd.form.name && recAdd.kind !== "performance"}>Save</Button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}

function RecSection({ items, row, onAdd, onDel, empty, addLabel = "Add" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onAdd} style={{ background: T.primarySoft, border: "none", borderRadius: 10, padding: "7px 12px", cursor: "pointer", color: T.primary, fontSize: 12.5, fontWeight: 700, fontFamily: T.body, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Icon name="Plus" size={14} /> {addLabel}
        </button>
      </div>
      {items.length === 0
        ? <div style={{ textAlign: "center", padding: "24px 0", color: T.inkFaint, fontSize: 13 }}>{empty}</div>
        : <Card pad={6}>
            {items.map((r, i) => {
              const d = row(r);
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 8px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{d.title}</div>
                    {d.sub && <div style={{ fontSize: 11.5, color: T.inkSoft }}>{d.sub}</div>}
                  </div>
                  {d.badge && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.blue, background: T.blueSoft, padding: "2px 7px", borderRadius: 6, flexShrink: 0 }}>{String(d.badge).toUpperCase()}</span>}
                  <button onClick={d.onDel} aria-label="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4, display: "flex" }}><Icon name="Trash2" size={15} /></button>
                </div>
              );
            })}
          </Card>}
    </div>
  );
}

function InfoRow({ label, value, first }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "10px 2px", borderTop: first ? "none" : `1px solid ${T.lineSoft}` }}>
      <span style={{ fontSize: 12.5, color: T.inkSoft, width: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1, fontSize: 13.5, color: T.ink, fontWeight: 500, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, fg }) {
  return (
    <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.rLg, padding: "12px 14px" }}>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700, color: fg, marginTop: 2 }}>{value}</div>
    </div>
  );
}
