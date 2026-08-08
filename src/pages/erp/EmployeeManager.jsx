import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Button, Chip, Card } from "../../components/index.js";
import Icon from "../../components/Icon.jsx";
import { BottomSheet, Input, Dropdown, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { employeeService, EMPLOYEE_TYPES, DEPARTMENTS, ATTENDANCE_STATUSES, PAYMENT_METHODS, STATUSES } from "../../services/employees/employeeService.js";
import { paymentService } from "../../services/employees/paymentService.js";
import { documentService } from "../../services/employees/documentService.js";
import { auditService } from "../../services/employees/auditService.js";
import { employeeReports } from "../../services/employees/employeeReports.js";
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
  const [paid, setPaid] = useState({ paid: 0, pending: 0 });
  const [payRow, setPayRow] = useState(null);        // wage row being paid
  const [payForm, setPayForm] = useState({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [docsExpiring, setDocsExpiring] = useState(0);

  const designationOpts = employeeService.designations().map((d) => ({ value: d.id, label: d.label }));

  useEffect(() => {
    employeeService.getAll().then(setEmployees);
    employeeService.todayStatus().then(setTodayMap);
    employeeService.monthWages(undefined, ymNow()).then(setWages);
    employeeService.attendanceSummary().then(setSummary);
    paymentService.monthTotals(ymNow()).then(setPaid);
    documentService.expirySummary().then((s) => setDocsExpiring(s.expired.length + s.expiringSoon.length));
  }, [tick]);

  const filtered = employees.filter((e) => {
    if (statusFilter !== "all" && (e.status || "active") !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [e.name, e.code, e.phone, employeeService.jobTitle(e), employeeService.deptLabel(e.department)]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  const openPay = (w) => {
    setPayForm({ bonus: "", allowance: "", advance: "", deduction: "", method: "cash", reference: "", notes: "", gross: w.gross });
    setPayRow(w);
  };
  const payNet = employeeService.computeNet({ gross: payRow?.gross || 0, ...payForm });
  const savePay = async () => {
    await paymentService.add({
      employeeId: payRow.employee.id, employeeName: payRow.employee.name,
      period: ymNow(), gross: payRow.gross, ...payForm, net: payNet, status: "paid",
    });
    auditService.log("payment.recorded", { employeeId: payRow.employee.id, employeeName: payRow.employee.name, detail: rupee(payNet) });
    setPayRow(null); refresh(); toast("Payment recorded", "success");
  };

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
    const rec = await employeeService.add(form);
    auditService.log("employee.created", { employeeId: rec.id, employeeName: rec.name });
    setOpen(false); setForm(NEW_FORM);
    refresh(); toast("Employee added", "success");
  };

  const mark = async (id, status) => {
    await employeeService.mark(id, status);
    refresh(); toast(`Marked ${status}`, "success");
  };

  const handleDelete = async () => {
    const emp = employees.find((e) => e.id === delId);
    await employeeService.remove(delId);
    auditService.log("employee.removed", { employeeId: delId, employeeName: emp?.name });
    setDelId(null); refresh(); toast("Removed", "info");
  };

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
        <StatTile a="red" label="Docs Expiring" value={docsExpiring} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px" }}>
        {TABS.map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {employees.length === 0 && <EmptyHint icon="Users" text="Add farm workers to track attendance and wages" />}

        {tab === "Team" && employees.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Icon name="Search" size={15} style={{ position: "absolute", left: 10, top: 11, color: T.inkFaint, pointerEvents: "none" }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, code, phone, role…"
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px 9px 32px", borderRadius: T.rMd, border: `1px solid ${T.line}`, background: T.surface2, color: T.ink, fontSize: 13, fontFamily: T.body, outline: "none" }} />
              </div>
              <button onClick={() => { const ok = employeeReports.exportRoster(employees); toast(ok ? "Roster exported" : "Nothing to export", ok ? "success" : "info"); }}
                aria-label="Export CSV" style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 9, cursor: "pointer", color: T.ink, display: "flex" }}>
                <Icon name="Download" size={17} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
              <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</Chip>
              {STATUSES.map((st) => <Chip key={st.id} active={statusFilter === st.id} onClick={() => setStatusFilter(st.id)}>{st.label}</Chip>)}
            </div>
          </div>
        )}

        {tab === "Team" && filtered.length === 0 && employees.length > 0 && (
          <div style={{ textAlign: "center", padding: "24px 0", color: T.inkFaint, fontSize: 13 }}>No employees match.</div>
        )}

        {tab === "Team" && filtered.map((e) => (
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

        {tab === "Wages" && employees.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 4 }}>
            <AttPill label="Gross this month" value={rupee(wages.reduce((s, w) => s + w.gross, 0))} fg={T.ink} bg={T.surface2} />
            <AttPill label="Paid" value={rupee(paid.paid)} fg={T.primary} bg={T.primarySoft} />
          </div>
        )}
        {tab === "Wages" && (
          wages.length === 0
            ? (employees.length > 0 && <EmptyHint icon="Banknote" text="Mark attendance to build this month's wage sheet" />)
            : wages.map((w) => (
              <Card key={w.employee.id} pad={13}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.employee.name}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      {w.basis === "monthly"
                        ? `Monthly salary${w.employee.monthlySalary ? ` ${rupee(Number(w.employee.monthlySalary))}` : " · not set"}`
                        : `${w.daysWorked} day${w.daysWorked !== 1 ? "s" : ""}${w.employee.dailyWage ? ` × ${rupee(Number(w.employee.dailyWage))}` : " · set wage"}`}
                      {w.overtime ? ` · +${rupee(w.overtime)} OT` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.primary, fontFamily: T.display }}>{rupee(w.gross)}</div>
                    <button onClick={() => openPay(w)}
                      style={{ background: T.primarySoft, border: "none", borderRadius: 10, padding: "7px 11px", cursor: "pointer",
                        color: T.primary, fontSize: 12.5, fontWeight: 700, fontFamily: T.body }}>Pay</button>
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

      <BottomSheet open={!!payRow} onClose={() => setPayRow(null)} title={payRow ? `Pay · ${payRow.employee.name}` : ""}>
        {payRow && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: T.rMd, background: T.surface2 }}>
              <span style={{ fontSize: 13, color: T.inkSoft }}>Gross ({payRow.basis})</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{rupee(payRow.gross)}</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Input label="Bonus (₹)" type="number" placeholder="0" value={payForm.bonus} onChange={(v) => setPayForm((f) => ({ ...f, bonus: v }))} /></div>
              <div style={{ flex: 1 }}><Input label="Allowance (₹)" type="number" placeholder="0" value={payForm.allowance} onChange={(v) => setPayForm((f) => ({ ...f, allowance: v }))} /></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Input label="Advance (₹)" type="number" placeholder="0" value={payForm.advance} onChange={(v) => setPayForm((f) => ({ ...f, advance: v }))} /></div>
              <div style={{ flex: 1 }}><Input label="Deduction (₹)" type="number" placeholder="0" value={payForm.deduction} onChange={(v) => setPayForm((f) => ({ ...f, deduction: v }))} /></div>
            </div>
            <Dropdown label="Payment method" value={payForm.method} onChange={(v) => setPayForm((f) => ({ ...f, method: v }))}
              options={PAYMENT_METHODS.map((m) => ({ value: m.id, label: m.label }))} />
            <Input label="Reference / notes" placeholder="Optional" value={payForm.reference} onChange={(v) => setPayForm((f) => ({ ...f, reference: v }))} />
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 12px", borderRadius: T.rMd, background: T.primarySoft }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.primary }}>Net payable</span>
              <span style={{ fontFamily: T.display, fontSize: 18, fontWeight: 800, color: T.primary }}>{rupee(payNet)}</span>
            </div>
            <Button full onClick={savePay}>Record payment</Button>
          </div>
        )}
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
