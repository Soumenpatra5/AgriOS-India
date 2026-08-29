import { useState, useEffect, useMemo } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Chip, Button, BottomSheet, Input, Dropdown } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import {
  employeeService, EMPLOYEE_TYPES, DEPARTMENTS, STATUSES, GENDERS, ATTENDANCE_STATUSES,
} from "../../services/employees/employeeService.js";
import { paymentService } from "../../services/employees/paymentService.js";
import { leaveService, LEAVE_TYPES, leaveDays } from "../../services/employees/leaveService.js";
import { documentService, DOC_TYPES } from "../../services/employees/documentService.js";
import { recordsService, SKILL_LEVELS, TRAINING_STATUSES } from "../../services/employees/recordsService.js";
import { assetService, ASSET_CATEGORIES } from "../../services/assets/assetService.js";
import { auditService } from "../../services/employees/auditService.js";
import { taskService } from "../../services/tasks/taskService.js";
import { farmService } from "../../services/farm/farmService.js";
import { rupee } from "../../utils/format.js";

const TONE = { primary: [T.primary, T.primarySoft], orange: [T.orange, T.orangeSoft], red: [T.red, T.redSoft], faint: [T.inkSoft, T.surface2] };
const initials = (n) => (n || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
/* Dates follow the app locale, matching longDate() elsewhere. Callers that
   run at module scope (the field configs) pass no locale and get en-IN. */
const fmtDate = (d, locale = "en-IN") => (d ? new Date(d + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "—");

/* Field configs drive both the read-only display and the edit form. */
const PERSONAL = [
  { key: "fatherName", label: { en: "Father's Name", hi: "पिता का नाम", bn: "পিতার নাম" } },
  { key: "motherName", label: { en: "Mother's Name", hi: "माता का नाम", bn: "মাতার নাম" } },
  { key: "dob", label: { en: "Date of Birth", hi: "जन्म तिथि", bn: "জন্ম তারিখ" }, type: "date", fmt: fmtDate },
  { key: "gender", label: { en: "Gender", hi: "लिंग", bn: "লিঙ্গ" }, type: "select", options: GENDERS },
  { key: "phone", label: { en: "Mobile Number", hi: "मोबाइल नंबर", bn: "মোবাইল নম্বর" } },
  { key: "altPhone", label: { en: "Alternate Mobile", hi: "वैकल्पिक मोबाइल", bn: "বিকল্প মোবাইল" } },
  { key: "email", label: { en: "Email", hi: "ईमेल", bn: "ইমেল" } },
  { key: "permanentAddress", label: { en: "Permanent Address", hi: "स्थायी पता", bn: "স্থায়ী ঠিকানা" } },
  { key: "currentAddress", label: { en: "Current Address", hi: "वर्तमान पता", bn: "বর্তমান ঠিকানা" } },
  { key: "emergencyName", label: { en: "Emergency Contact", hi: "आपात संपर्क", bn: "জরুরি যোগাযোগ" } },
  { key: "emergencyPhone", label: { en: "Emergency Number", hi: "आपात नंबर", bn: "জরুরি নম্বর" } },
  { key: "emergencyRelation", label: { en: "Emergency Relation", hi: "आपात संबंध", bn: "জরুরি সম্পর্ক" } },
];

const EMPLOYMENT = [
  { key: "code", label: { en: "Employee ID", hi: "कर्मचारी आईडी", bn: "কর্মী আইডি" }, readOnly: true },
  { key: "joiningDate", label: { en: "Joining Date", hi: "नियुक्ति तिथि", bn: "যোগদানের তারিখ" }, type: "date", fmt: fmtDate },
  { key: "department", label: { en: "Department", hi: "विभाग", bn: "বিভাগ" }, type: "select", options: DEPARTMENTS },
  { key: "designation", label: { en: "Designation", hi: "पदनाम", bn: "পদবি" }, type: "designation" },
  { key: "type", label: { en: "Employee Type", hi: "कर्मचारी प्रकार", bn: "কর্মীর ধরন" }, type: "select", options: EMPLOYEE_TYPES },
  { key: "status", label: { en: "Status", hi: "स्थिति", bn: "অবস্থা" }, type: "select", options: STATUSES },
  { key: "reportingManager", label: { en: "Reporting Manager", hi: "रिपोर्टिंग प्रबंधक", bn: "রিপোর্টিং ম্যানেজার" } },
  { key: "farmId", label: { en: "Assigned Farm", hi: "सौंपा गया फार्म", bn: "নির্ধারিত খামার" }, type: "farm" },
  { key: "shift", label: { en: "Work Shift", hi: "कार्य पाली", bn: "কাজের শিফট" } },
  { key: "workingHours", label: { en: "Working Hours", hi: "कार्य घंटे", bn: "কাজের ঘণ্টা" } },
  { key: "weeklyOff", label: { en: "Weekly Off", hi: "साप्ताहिक अवकाश", bn: "সাপ্তাহিক ছুটি" } },
  { key: "probation", label: { en: "On Probation", hi: "परिवीक्षा पर", bn: "প্রবেশনে" }, type: "select", options: [{ id: "yes", label: { en: "Yes", hi: "हाँ", bn: "হ্যাঁ" } }, { id: "no", label: { en: "No", hi: "नहीं", bn: "না" } }] },
  { key: "dailyWage", label: { en: "Daily Wage (₹)", hi: "दैनिक मज़दूरी (₹)", bn: "দৈনিক মজুরি (₹)" }, type: "number", fmt: (v) => (v ? rupee(Number(v)) : "—") },
  { key: "monthlySalary", label: { en: "Monthly Salary (₹)", hi: "मासिक वेतन (₹)", bn: "মাসিক বেতন (₹)" }, type: "number", fmt: (v) => (v ? rupee(Number(v)) : "—") },
  { key: "overtimeRate", label: { en: "Overtime Rate (₹/hr)", hi: "ओवरटाइम दर (₹/घंटा)", bn: "ওভারটাইম হার (₹/ঘণ্টা)" }, type: "number", fmt: (v) => (v ? rupee(Number(v)) : "—") },
  { key: "exitDate", label: { en: "Exit Date", hi: "निकास तिथि", bn: "প্রস্থানের তারিখ" }, type: "date", fmt: fmtDate },
  { key: "exitReason", label: { en: "Exit Reason", hi: "निकास कारण", bn: "প্রস্থানের কারণ" } },
];

/* WF-6 add-record field configs, keyed by kind. */
const REC_FIELDS = {
  skill: [
    { key: "name", label: { en: "Skill", hi: "कौशल", bn: "দক্ষতা" } },
    { key: "level", label: { en: "Level", hi: "स्तर", bn: "স্তর" }, type: "select", options: SKILL_LEVELS, default: "beginner" },
    { key: "experience", label: { en: "Experience (years)", hi: "अनुभव (वर्ष)", bn: "অভিজ্ঞতা (বছর)" }, type: "number" },
    { key: "certificate", label: { en: "Certificate", hi: "प्रमाणपत्र", bn: "সনদ" } },
    { key: "expiryDate", label: { en: "Certificate expiry", hi: "प्रमाणपत्र समय-सीमा", bn: "সনদের মেয়াদ" }, type: "date" },
  ],
  training: [
    { key: "name", label: { en: "Training", hi: "प्रशिक्षण", bn: "প্রশিক্ষণ" } },
    { key: "trainer", label: { en: "Trainer", hi: "प्रशिक्षक", bn: "প্রশিক্ষক" } },
    { key: "date", label: { en: "Date", hi: "तारीख", bn: "তারিখ" }, type: "date" },
    { key: "duration", label: { en: "Duration", hi: "अवधि", bn: "সময়কাল" } },
    { key: "status", label: { en: "Status", hi: "स्थिति", bn: "অবস্থা" }, type: "select", options: TRAINING_STATUSES, default: "completed" },
    { key: "certExpiry", label: { en: "Certificate expiry", hi: "प्रमाणपत्र समय-सीमा", bn: "সনদের মেয়াদ" }, type: "date" },
  ],
  performance: [
    { key: "rating", label: { en: "Rating", hi: "रेटिंग", bn: "রেটিং" }, type: "select", options: [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: `${n} / 5` })), default: "3" },
    { key: "reviewDate", label: { en: "Review date", hi: "समीक्षा तिथि", bn: "পর্যালোচনার তারিখ" }, type: "date" },
    { key: "reviewer", label: { en: "Reviewer", hi: "समीक्षक", bn: "পর্যালোচক" } },
    { key: "remarks", label: { en: "Remarks", hi: "टिप्पणी", bn: "মন্তব্য" } },
  ],
  asset: [
    { key: "name", label: { en: "Asset", hi: "संपत्ति", bn: "সম্পদ" } },
    { key: "category", label: { en: "Category", hi: "श्रेणी", bn: "শ্রেণি" }, type: "select", options: ASSET_CATEGORIES, default: "tool" },
    { key: "condition", label: { en: "Condition", hi: "स्थिति", bn: "অবস্থা" } },
    { key: "assignedDate", label: { en: "Assigned date", hi: "सौंपने की तिथि", bn: "বরাদ্দের তারিখ" }, type: "date" },
  ],
};
const REC_TITLE = {
  skill:       { en: "Add skill",    hi: "कौशल जोड़ें",     bn: "দক্ষতা যোগ করুন" },
  training:    { en: "Add training", hi: "प्रशिक्षण जोड़ें", bn: "প্রশিক্ষণ যোগ করুন" },
  performance: { en: "Add review",   hi: "समीक्षा जोड़ें",   bn: "পর্যালোচনা যোগ করুন" },
  asset:       { en: "Assign asset", hi: "संपत्ति सौंपें",    bn: "সম্পদ বরাদ্দ করুন" },
};

export default function EmployeeDetail({ id }) {
  const { pop, toast, can, tc, locale } = useApp();
  const [emp, setEmp] = useState(null);
  const [farms, setFarms] = useState([]);
  const [todayAtt, setTodayAtt] = useState(null);
  const [att, setAtt] = useState(null);      // month attendance summary
  const [payments, setPayments] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState("Overview");
  /* id drives state, the RBAC filter and every `tab === "…"` branch below;
     label is display only. */
  const DETAIL_TABS = [
    { id: "Overview",    label: { en: "Overview",    hi: "अवलोकन",      bn: "সংক্ষিপ্ত" } },
    { id: "Personal",    label: { en: "Personal",    hi: "व्यक्तिगत",    bn: "ব্যক্তিগত" } },
    { id: "Employment",  label: { en: "Employment",  hi: "रोज़गार",      bn: "কর্মসংস্থান" } },
    { id: "Attendance",  label: { en: "Attendance",  hi: "उपस्थिति",     bn: "উপস্থিতি" } },
    { id: "Payments",    label: { en: "Payments",    hi: "भुगतान",      bn: "পেমেন্ট" } },
    { id: "Leave",       label: { en: "Leave",       hi: "अवकाश",       bn: "ছুটি" } },
    { id: "Tasks",       label: { en: "Tasks",       hi: "कार्य",        bn: "কাজ" } },
    { id: "Documents",   label: { en: "Documents",   hi: "दस्तावेज़",     bn: "নথি" } },
    { id: "Skills",      label: { en: "Skills",      hi: "कौशल",        bn: "দক্ষতা" } },
    { id: "Training",    label: { en: "Training",    hi: "प्रशिक्षण",     bn: "প্রশিক্ষণ" } },
    { id: "Performance", label: { en: "Performance", hi: "प्रदर्शन",      bn: "কর্মক্ষমতা" } },
    { id: "Assets",      label: { en: "Assets",      hi: "संपत्ति",       bn: "সম্পদ" } },
    { id: "Audit",       label: { en: "Audit",       hi: "लेखा-परीक्षा",  bn: "নিরীক্ষা" } },
  ];
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
  const [auditRows, setAuditRows] = useState([]);
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
    auditService.forEmployee(id).then(setAuditRows);
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
    try {
      await documentService.add({ employeeId: id, ...docForm }, docFile);
      setDocOpen(false);
      setDocForm({ type: "id_proof", name: "", number: "", issueDate: "", expiryDate: "" }); setDocFile(null);
      setTick((n) => n + 1);
    } catch (err) {
      /* Keep the sheet open with the form intact so the entry is not lost, and
         say what went wrong — without this the button sat on "Uploading…"
         forever with no explanation. */
      toast(tc({ en: "Could not save the document. Please try again.",
                 hi: "दस्तावेज़ सहेजा नहीं जा सका। कृपया फिर कोशिश करें।",
                 bn: "নথি সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।" }), "error");
      console.error("[documents] upload failed", err);
    } finally {
      setDocBusy(false);
    }
  };
  const openDoc = async (d) => {
    if (d.fileUrl) { window.open(d.fileUrl, "_blank", "noopener"); return; }
    if (!d.fileData) return;
    // Browsers block top-frame navigation to data: URLs, so turn the locally
    // stored base64 into a blob URL and open that instead.
    try {
      const blob = await (await fetch(d.fileData)).blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { /* unreadable file */ }
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

  if (!emp) return <><AppBar title={tc({ en: "Employee", hi: "कर्मचारी", bn: "কর্মী" })} onBack={pop} /><div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>{tc({ en: "Loading…", hi: "लोड हो रहा है…", bn: "লোড হচ্ছে…" })}</div></>;

  const jobTitle = employeeService.jobTitle(emp);
  /* The service label helpers return the English canonical; show the reader's
     script, falling back to the helper for custom designations a farm added. */
  const pick = (list, id, fb) => { const x = list.find((y) => y.id === id); return x?.i18n ? tc(x.i18n) : fb; };
  const deptText   = (id) => pick(DEPARTMENTS, id, employeeService.deptLabel(id));
  const statusText = (id) => pick(STATUSES, id, employeeService.statusLabel(id));
  const desigText  = (id) => pick(employeeService.designations(), id, employeeService.designationLabel(id));
  const jobTitleText = desigText(emp.designation) || jobTitle;
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
    auditService.log(`employee.${editSection}_updated`, { employeeId: id, employeeName: emp?.name });
    setEditSection(null); setTick((n) => n + 1);
    toast("Saved", "success");
  };

  const displayVal = (f) => {
    const v = f.key === "farmId" ? farmName : emp[f.key];
    if (v == null || v === "") return "—";
    /* fmtDate needs the app locale; the rupee formatters take one argument. */
    if (f.fmt) return f.fmt === fmtDate ? fmtDate(v, locale) : f.fmt(v);
    if (f.type === "select") return (f.options.find((o) => o.id === v)?.label) || v;
    if (f.key === "designation") return desigText(v);
    return String(v);
  };

  const editFields = editSection === "personal" ? PERSONAL : EMPLOYMENT;

  return (
    <>
      <AppBar title={tc({ en: "Employee", hi: "कर्मचारी", bn: "কর্মী" })} onBack={pop} action={
        (tab === "Personal" || tab === "Employment") && (
          <button onClick={() => openEdit(tab.toLowerCase())} aria-label={tc({ en: "Edit", hi: "संपादित करें", bn: "সম্পাদনা" })}
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
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>{jobTitleText}{emp.department ? ` · ${deptText(emp.department)}` : ""}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: stFg, background: stBg, padding: "2px 8px", borderRadius: 6 }}>{statusText(emp.status)}</span>
            <span style={{ fontSize: 11.5, color: T.inkFaint }}>{emp.code}</span>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 8, padding: "16px 16px 4px", overflowX: "auto" }}>
        {DETAIL_TABS
          .filter((t) => (t.id !== "Payments" || can("salary.view")) && (t.id !== "Documents" || can("documents.view")))
          .map((t) => <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{tc(t.label)}</Chip>)}
      </div>

      <div style={{ padding: "8px 16px 32px" }}>
        {tab === "Overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <MiniStat label={tc({ en: "Today", hi: "आज", bn: "আজ" })} value={todayAtt ? (() => { const a = ATTENDANCE_STATUSES.find((x) => x.id === todayAtt); return a?.i18n ? tc(a.i18n) : todayAtt[0].toUpperCase() + todayAtt.slice(1); })() : tc({ en: "Not marked", hi: "दर्ज नहीं", bn: "লেখা হয়নি" })} fg={todayAtt === "present" ? T.primary : todayAtt === "absent" ? T.red : T.inkSoft} />
              {can("salary.view") && <MiniStat label={emp.type === "daily_wage" || emp.dailyWage ? tc({ en: "Daily wage", hi: "दैनिक मज़दूरी", bn: "দৈনিক মজুরি" }) : tc({ en: "Salary", hi: "वेतन", bn: "বেতন" })} value={emp.dailyWage ? rupee(Number(emp.dailyWage)) : emp.monthlySalary ? rupee(Number(emp.monthlySalary)) : "—"} fg={T.ink} />}
            </div>
            <Card style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <InfoRow label={tc({ en: "Type", hi: "प्रकार", bn: "ধরন" })} value={(() => { const t = EMPLOYEE_TYPES.find((x) => x.id === emp.type); return t?.i18n ? tc(t.i18n) : employeeService.typeLabel(emp.type); })()} first />
              <InfoRow label={tc({ en: "Department", hi: "विभाग", bn: "বিভাগ" })} value={emp.department ? deptText(emp.department) : "—"} />
              <InfoRow label={tc({ en: "Assigned farm", hi: "सौंपा गया फार्म", bn: "নির্ধারিত খামার" })} value={farmName || "—"} />
              <InfoRow label={tc({ en: "Joined", hi: "नियुक्ति", bn: "যোগদান" })} value={fmtDate(emp.joiningDate, locale)} />
              <InfoRow label={tc({ en: "Mobile", hi: "मोबाइल", bn: "মোবাইল" })} value={emp.phone || "—"} />
            </Card>
            <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.5 }}>
              {tc({ en: "Attendance, wages, tasks, documents & more arrive in the next workforce phases.", hi: "उपस्थिति, मज़दूरी, कार्य, दस्तावेज़ और अधिक अगले चरणों में आएँगे।", bn: "উপস্থিতি, মজুরি, কাজ, নথি ও আরও পরের ধাপে আসবে।" })}
            </div>
          </div>
        )}

        {(tab === "Personal" || tab === "Employment") && (
          <Card style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {(tab === "Personal" ? PERSONAL : EMPLOYMENT).map((f, i) => (
              <InfoRow key={f.key} label={tc(f.label)} value={displayVal(f)} first={i === 0} />
            ))}
          </Card>
        )}

        {tab === "Attendance" && att && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>{tc({ en: "This month", hi: "इस माह", bn: "এ মাসে" })}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <MiniStat label={tc({ en: "Present", hi: "उपस्थित", bn: "উপস্থিত" })} value={att.counts.present + att.counts.late + att.counts.overtime} fg={T.primary} />
              <MiniStat label={tc({ en: "Half day", hi: "आधा दिन", bn: "অর্ধ দিন" })} value={att.counts.halfday} fg={T.orange} />
              <MiniStat label={tc({ en: "Absent", hi: "अनुपस्थित", bn: "অনুপস্থিত" })} value={att.counts.absent} fg={T.red} />
              <MiniStat label={tc({ en: "Leave", hi: "छुट्टी", bn: "ছুটি" })} value={att.counts.leave} fg={T.blue} />
              <MiniStat label={tc({ en: "Overtime", hi: "ओवरटाइम", bn: "ওভারটাইম" })} value={`${att.overtimeHours}h`} fg={T.ink} />
              <MiniStat label={tc({ en: "Attendance", hi: "उपस्थिति", bn: "উপস্থিতি" })} value={`${att.percent}%`} fg={att.percent >= 75 ? T.primary : T.orange} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginTop: 4 }}>{tc({ en: "History", hi: "इतिहास", bn: "ইতিহাস" })}</div>
            {att.rows.length === 0
              ? <div style={{ textAlign: "center", padding: "24px 0", color: T.inkFaint, fontSize: 13 }}>{tc({ en: "No attendance marked this month.", hi: "इस माह कोई उपस्थिति दर्ज नहीं।", bn: "এ মাসে কোনও উপস্থিতি লেখা হয়নি।" })}</div>
              : <Card pad={6}>
                  {att.rows.map((r, i) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                      <span style={{ fontSize: 12.5, color: T.inkSoft, width: 76, flexShrink: 0 }}>{fmtDate(r.date, locale)}</span>
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

        {tab === "Payments" && can("salary.view") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Card style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <InfoRow label={tc({ en: "Daily wage", hi: "दैनिक मज़दूरी", bn: "দৈনিক মজুরি" })} value={emp.dailyWage ? rupee(Number(emp.dailyWage)) : "—"} first />
              <InfoRow label={tc({ en: "Monthly salary", hi: "मासिक वेतन", bn: "মাসিক বেতন" })} value={emp.monthlySalary ? rupee(Number(emp.monthlySalary)) : "—"} />
              <InfoRow label={tc({ en: "Overtime rate", hi: "ओवरटाइम दर", bn: "ওভারটাইম হার" })} value={emp.overtimeRate ? `${rupee(Number(emp.overtimeRate))}/hr` : "—"} />
              <InfoRow label={tc({ en: "Total paid", hi: "कुल भुगतान", bn: "মোট পরিশোধ" })} value={rupee(payments.filter((p) => p.status === "paid").reduce((s, p) => s + (Number(p.net) || 0), 0))} />
            </Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>{tc({ en: "Payment history", hi: "भुगतान इतिहास", bn: "পেমেন্টের ইতিহাস" })}</div>
            {payments.length === 0
              ? <div style={{ textAlign: "center", padding: "24px 0", color: T.inkFaint, fontSize: 13 }}>{tc({ en: "No payments recorded yet — use the Wages tab to pay.", hi: "अभी कोई भुगतान दर्ज नहीं — भुगतान के लिए मज़दूरी टैब देखें।", bn: "এখনও কোনও পেমেন্ট লেখা হয়নি — পরিশোধ করতে মজুরি ট্যাব দেখুন।" })}</div>
              : <Card pad={6}>
                  {payments.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 8px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{rupee(Number(p.net))}</div>
                        <div style={{ fontSize: 11.5, color: T.inkSoft }}>
                          {fmtDate(p.date, locale)} · {(p.method || "").toUpperCase()}{p.period ? ` · ${p.period}` : ""}
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
                  <div style={{ fontSize: 12, color: T.inkSoft }}>{tc(b.label)}</div>
                  <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 700, color: b.remaining > 0 ? T.primary : T.orange, marginTop: 2 }}>{b.remaining}<span style={{ fontSize: 12, color: T.inkFaint, fontWeight: 500 }}> / {b.allowance} left</span></div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginTop: 4 }}>{tc({ en: "Requests", hi: "अनुरोध", bn: "অনুরোধ" })}</div>
            {leaves.length === 0
              ? <div style={{ textAlign: "center", padding: "20px 0", color: T.inkFaint, fontSize: 13 }}>{tc({ en: "No leave requests.", hi: "कोई अवकाश अनुरोध नहीं।", bn: "কোনও ছুটির অনুরোধ নেই।" })}</div>
              : <Card pad={6}>
                  {leaves.map((l, i) => (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 8px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{(() => { const lt = LEAVE_TYPES.find((x) => x.id === l.type); return lt?.i18n ? tc(lt.i18n) : leaveService.typeLabel(l.type); })()} · {l.days}d</div>
                        <div style={{ fontSize: 11.5, color: T.inkSoft }}>{fmtDate(l.fromDate, locale)} – {fmtDate(l.toDate, locale)}{l.reason ? ` · ${l.reason}` : ""}</div>
                      </div>
                      {l.status === "pending"
                        ? <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => decideLeave(l.id, "approved")} aria-label={tc({ en: "Approve", hi: "स्वीकृत करें", bn: "অনুমোদন" })} style={{ background: T.primarySoft, border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: T.primary, display: "flex" }}><Icon name="Check" size={15} /></button>
                            <button onClick={() => decideLeave(l.id, "rejected")} aria-label={tc({ en: "Reject", hi: "अस्वीकार करें", bn: "প্রত্যাখ্যান" })} style={{ background: T.redSoft, border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: T.red, display: "flex" }}><Icon name="X" size={15} /></button>
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
              ? <div style={{ textAlign: "center", padding: "24px 0", color: T.inkFaint, fontSize: 13 }}>{tc({ en: "No tasks assigned. Assign tasks from the Task Manager.", hi: "कोई कार्य नहीं सौंपा गया। कार्य प्रबंधक से कार्य सौंपें।", bn: "কোনও কাজ বরাদ্দ হয়নি। কাজ ব্যবস্থাপক থেকে কাজ বরাদ্দ করুন।" })}</div>
              : <Card pad={6}>
                  {tasks.map((t, i) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 8px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: t.status === "done" ? T.inkFaint : T.ink, textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</div>
                        <div style={{ fontSize: 11.5, color: T.inkSoft }}>{t.dueDate ? `Due ${fmtDate(t.dueDate, locale)}` : "No due date"}{t.priority ? ` · ${t.priority}` : ""}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: t.status === "done" ? T.primary : T.orange, background: t.status === "done" ? T.primarySoft : T.orangeSoft, padding: "2px 8px", borderRadius: 6 }}>{(t.status || "open").toUpperCase()}</span>
                    </div>
                  ))}
                </Card>}
          </div>
        )}

        {tab === "Documents" && can("documents.view") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>{tc({
                en: `${documents.length} document${documents.length !== 1 ? "s" : ""}`,
                hi: `${documents.length} दस्तावेज़`,
                bn: `${documents.length}টি নথি`,
              })}</div>
              <button onClick={() => setDocOpen(true)} style={{ background: T.primarySoft, border: "none", borderRadius: 10, padding: "7px 12px", cursor: "pointer", color: T.primary, fontSize: 12.5, fontWeight: 700, fontFamily: T.body, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon name="Upload" size={14} /> {tc({ en: "Upload", hi: "अपलोड", bn: "আপলোড" })}
              </button>
            </div>
            {documents.length === 0
              ? <div style={{ textAlign: "center", padding: "24px 0", color: T.inkFaint, fontSize: 13 }}>{tc({ en: "No documents yet. Upload IDs, certificates or agreements.", hi: "अभी कोई दस्तावेज़ नहीं। पहचान, प्रमाणपत्र या अनुबंध अपलोड करें।", bn: "এখনও কোনও নথি নেই। পরিচয়, সনদ বা চুক্তি আপলোড করুন।" })}</div>
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
                            {(() => { const dt = DOC_TYPES.find((x) => x.id === d.type); return dt?.i18n ? tc(dt.i18n) : documentService.typeLabel(d.type); })()}{d.number ? ` · ${d.number}` : ""}
                            {d.expiryDate ? ` · exp ${fmtDate(d.expiryDate, locale)}` : ""}
                            {d.status === "verified" ? " · ✓ verified" : ""}
                          </div>
                        </div>
                        {d.expiryDate && <span style={{ fontSize: 10.5, fontWeight: 700, color: efg, background: ebg, padding: "2px 7px", borderRadius: 6, flexShrink: 0 }}>{exp === "expiring_soon" ? "SOON" : exp.toUpperCase()}</span>}
                        {(d.fileUrl || d.fileData) && (
                          <button onClick={() => openDoc(d)} aria-label={tc({ en: "View", hi: "देखें", bn: "দেখুন" })} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, padding: 4, display: "flex" }}><Icon name="Eye" size={16} /></button>
                        )}
                        {d.status !== "verified" && (
                          <button onClick={async () => { await documentService.setStatus(d.id, "verified"); auditService.log("document.verified", { employeeId: id, employeeName: emp?.name, detail: d.name }); setTick((n) => n + 1); }} aria-label={tc({ en: "Verify", hi: "सत्यापित करें", bn: "যাচাই করুন" })} style={{ background: "none", border: "none", cursor: "pointer", color: T.primary, padding: 4, display: "flex" }}><Icon name="Check" size={16} /></button>
                        )}
                        <button onClick={async () => { await documentService.remove(d.id); auditService.log("document.removed", { employeeId: id, employeeName: emp?.name, detail: d.name }); setTick((n) => n + 1); }} aria-label={tc({ en: "Delete document", hi: "दस्तावेज़ हटाएँ", bn: "নথি মুছুন" })} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4, display: "flex" }}><Icon name="Trash2" size={15} /></button>
                      </div>
                    );
                  })}
                </Card>}
            <div style={{ fontSize: 11, color: T.inkFaint, textAlign: "center", lineHeight: 1.5 }}>{tc({ en: "Files upload to secure cloud storage when online, else saved on this device and synced later.", hi: "ऑनलाइन होने पर फ़ाइलें सुरक्षित क्लाउड में जाती हैं, अन्यथा इसी डिवाइस पर सहेजकर बाद में सिंक होती हैं।", bn: "অনলাইনে থাকলে ফাইল নিরাপদ ক্লাউডে যায়, নাহলে এই ডিভাইসে সংরক্ষিত হয়ে পরে সিঙ্ক হয়।" })}</div>
          </div>
        )}

        {tab === "Skills" && (
          <RecSection empty="No skills recorded." onAdd={() => openRec("skill")} items={recs.skill}
            row={(r) => ({ title: r.name, sub: `${recordsService.skillLevelLabel(r.level)}${r.experience ? ` · ${r.experience}y exp` : ""}${r.expiryDate ? ` · cert exp ${fmtDate(r.expiryDate, locale)}` : ""}`, onDel: () => delRec("skill", r.id) })} />
        )}
        {tab === "Training" && (
          <RecSection empty="No training recorded." onAdd={() => openRec("training")} items={recs.training}
            row={(r) => ({ title: r.name, sub: `${r.trainer ? `${r.trainer} · ` : ""}${r.date ? fmtDate(r.date, locale) : ""}${r.duration ? ` · ${r.duration}` : ""}`, badge: recordsService.trainingStatusLabel(r.status), onDel: () => delRec("training", r.id) })} />
        )}
        {tab === "Performance" && (
          <RecSection empty="No reviews yet — supervisors add reviews here." onAdd={() => openRec("performance")} items={recs.performance}
            row={(r) => ({ title: `${r.rating || "—"} / 5${r.reviewer ? ` · ${r.reviewer}` : ""}`, sub: `${r.reviewDate ? fmtDate(r.reviewDate, locale) : ""}${r.remarks ? ` · ${r.remarks}` : ""}`, onDel: () => delRec("performance", r.id) })} />
        )}
        {tab === "Assets" && (
          <RecSection empty="No assets assigned." addLabel="Assign" onAdd={() => openRec("asset")} items={recs.asset}
            row={(r) => ({ title: r.name, sub: `${assetService.categoryLabel(r.category)}${r.condition ? ` · ${r.condition}` : ""}${r.assignedDate ? ` · from ${fmtDate(r.assignedDate, locale)}` : ""}`, onDel: () => delRec("asset", r.id) })} />
        )}

        {tab === "Audit" && (
          auditRows.length === 0
            ? <div style={{ textAlign: "center", padding: "24px 0", color: T.inkFaint, fontSize: 13 }}>{tc({ en: "No history yet.", hi: "अभी कोई इतिहास नहीं।", bn: "এখনও কোনও ইতিহাস নেই।" })}</div>
            : <Card pad={6}>
                {auditRows.map((a, i) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "10px 8px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                    <span style={{ flex: 1, fontSize: 13, color: T.ink }}>{a.action.replace(/\./g, " ")}{a.detail ? ` · ${a.detail}` : ""}</span>
                    <span style={{ fontSize: 11, color: T.inkFaint, flexShrink: 0 }}>{a.at ? new Date(a.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                  </div>
                ))}
              </Card>
        )}
      </div>

      {/* edit sheet */}
      <BottomSheet open={!!editSection} onClose={() => setEditSection(null)} title={`Edit ${editSection === "personal" ? "personal" : "employment"} details`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {editFields.filter((f) => !f.readOnly).map((f) => {
            const val = form[f.key] ?? "";
            const set = (v) => setForm((s) => ({ ...s, [f.key]: v }));
            if (f.type === "select") return <Dropdown key={f.key} label={tc(f.label)} value={val} onChange={set} options={f.options.map((o) => ({ value: o.id, label: o.i18n ? tc(o.i18n) : (typeof o.label === "string" ? o.label : tc(o.label)) }))} />;
            if (f.type === "designation") return (
              <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Dropdown label={tc(f.label)} value={val} onChange={set} options={designationOpts} />
                {form.designation === "other" && <Input label={tc({ en: "Custom designation", hi: "कस्टम पदनाम", bn: "কাস্টম পদবি" })} placeholder={tc({ en: "e.g. Tractor Operator", hi: "उदा. ट्रैक्टर चालक", bn: "যেমন ট্রাক্টর চালক" })} value={form.customDesignation || ""} onChange={(v) => setForm((s) => ({ ...s, customDesignation: v }))} />}
              </div>
            );
            if (f.type === "farm") return <Dropdown key={f.key} label={tc(f.label)} value={val} onChange={set} options={[{ value: "", label: tc({ en: "— None —", hi: "— कोई नहीं —", bn: "— কিছু নয় —" }) }, ...farms.map((fm) => ({ value: fm.id, label: fm.name }))]} />;
            return <Input key={f.key} label={tc(f.label)} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={val} onChange={set} placeholder={f.type === "date" ? "" : tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} />;
          })}
          <Button full onClick={save}>{tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={leaveOpen} onClose={() => setLeaveOpen(false)} title={tc({ en: "Apply leave", hi: "अवकाश आवेदन", bn: "ছুটির আবেদন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label={tc({ en: "Leave type", hi: "अवकाश प्रकार", bn: "ছুটির ধরন" })} value={leaveForm.type} onChange={(v) => setLeaveForm((f) => ({ ...f, type: v }))}
            options={LEAVE_TYPES.map((t) => ({ value: t.id, label: t.i18n ? tc(t.i18n) : t.label }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Input label={tc({ en: "From", hi: "से", bn: "থেকে" })} type="date" value={leaveForm.fromDate} onChange={(v) => setLeaveForm((f) => ({ ...f, fromDate: v }))} /></div>
            <div style={{ flex: 1 }}><Input label={tc({ en: "To", hi: "तक", bn: "পর্যন্ত" })} type="date" value={leaveForm.toDate} onChange={(v) => setLeaveForm((f) => ({ ...f, toDate: v }))} /></div>
          </div>
          {leaveForm.fromDate && <div style={{ fontSize: 12.5, color: T.inkSoft }}>{leaveDays(leaveForm.fromDate, leaveForm.toDate)} {tc({ en: "day(s)", hi: "दिन", bn: "দিন" })}</div>}
          <Input label={tc({ en: "Reason", hi: "कारण", bn: "কারণ" })} placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} value={leaveForm.reason} onChange={(v) => setLeaveForm((f) => ({ ...f, reason: v }))} />
          <Button full onClick={applyLeave} disabled={!leaveForm.fromDate}>{tc({ en: "Submit request", hi: "अनुरोध भेजें", bn: "অনুরোধ পাঠান" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={docOpen} onClose={() => setDocOpen(false)} title={tc({ en: "Upload document", hi: "दस्तावेज़ अपलोड करें", bn: "নথি আপলোড করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Dropdown label={tc({ en: "Document type", hi: "दस्तावेज़ प्रकार", bn: "নথির ধরন" })} value={docForm.type} onChange={(v) => setDocForm((f) => ({ ...f, type: v }))}
            options={DOC_TYPES.map((t) => ({ value: t.id, label: t.i18n ? tc(t.i18n) : t.label }))} />
          <Input label={tc({ en: "Name / title", hi: "नाम / शीर्षक", bn: "নাম / শিরোনাম" })} placeholder={tc({ en: "e.g. Aadhaar card", hi: "उदा. आधार कार्ड", bn: "যেমন আধার কার্ড" })} value={docForm.name} onChange={(v) => setDocForm((f) => ({ ...f, name: v }))} />
          <Input label={tc({ en: "Document number", hi: "दस्तावेज़ संख्या", bn: "নথির নম্বর" })} placeholder={tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} value={docForm.number} onChange={(v) => setDocForm((f) => ({ ...f, number: v }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Input label={tc({ en: "Issue date", hi: "जारी तिथि", bn: "প্রদানের তারিখ" })} type="date" value={docForm.issueDate} onChange={(v) => setDocForm((f) => ({ ...f, issueDate: v }))} /></div>
            <div style={{ flex: 1 }}><Input label={tc({ en: "Expiry date", hi: "समय-सीमा तिथि", bn: "মেয়াদ শেষের তারিখ" })} type="date" value={docForm.expiryDate} onChange={(v) => setDocForm((f) => ({ ...f, expiryDate: v }))} /></div>
          </div>
          <label style={{ display: "block" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, marginBottom: 7 }}>{tc({ en: "File", hi: "फ़ाइल", bn: "ফাইল" })}</div>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              style={{ width: "100%", fontSize: 13, color: T.ink }} />
          </label>
          <Button full onClick={uploadDoc} disabled={docBusy || (!docForm.name && !docFile)}>{docBusy
              ? tc({ en: "Uploading…", hi: "अपलोड हो रहा है…", bn: "আপলোড হচ্ছে…" })
              : tc({ en: "Save document", hi: "दस्तावेज़ सहेजें", bn: "নথি সংরক্ষণ করুন" })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!recAdd} onClose={() => setRecAdd(null)} title={recAdd ? tc(REC_TITLE[recAdd.kind]) : ""}>
        {recAdd && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {REC_FIELDS[recAdd.kind].map((f) => {
              const val = recAdd.form[f.key] ?? "";
              const set = (v) => setRecAdd((s) => ({ ...s, form: { ...s.form, [f.key]: v } }));
              return f.type === "select"
                ? <Dropdown key={f.key} label={tc(f.label)} value={val} onChange={set} options={f.options.map((o) => ({ value: o.id, label: o.i18n ? tc(o.i18n) : (typeof o.label === "string" ? o.label : tc(o.label)) }))} />
                : <Input key={f.key} label={tc(f.label)} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={val} onChange={set} placeholder={f.type === "date" ? "" : tc({ en: "Optional", hi: "वैकल्पिक", bn: "ঐচ্ছিক" })} />;
            })}
            <Button full onClick={saveRec} disabled={!recAdd.form.name && recAdd.kind !== "performance"}>{tc({ en: "Save", hi: "सहेजें", bn: "সংরক্ষণ" })}</Button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}

function RecSection({ items, row, onAdd, onDel, empty, addLabel = "Add" }) {
  /* Own useApp: it is a component, and threading tc down for one aria-label
     would mean touching every call site. */
  const { tc } = useApp();
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
                  <button onClick={d.onDel} aria-label={tc({ en: "Remove", hi: "हटाएँ", bn: "সরান" })} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4, display: "flex" }}><Icon name="Trash2" size={15} /></button>
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
