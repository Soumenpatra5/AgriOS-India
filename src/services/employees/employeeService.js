/* Employees — the central workforce record: profile, employment, farm
   assignment, daily attendance and wage computation. Built on the shared ERP
   repo (Repository Pattern) so it inherits offline sync automatically.

   The `employees` store is schemaless (IndexedDB), so the rich profile fields
   added here need no migration — older records simply omit them and the UI
   falls back gracefully. `role` (legacy) is kept and mapped to `designation`. */

import { repo } from "../erp/erpDb.js";
import { storage } from "../../utils/storage.js";

/* ── Taxonomies (spec §2, §4, §5, §22) ─────────────────────────────────────── */

/* label stays English — it is the stored value on the employee record and
   goes into CSV exports. i18n is what the UI shows. */
export const EMPLOYEE_TYPES = [
  { id: "permanent",  label: "Permanent" , i18n: { en: "Permanent", hi: "स्थायी", bn: "স্থায়ী" } },
  { id: "temporary",  label: "Temporary" , i18n: { en: "Temporary", hi: "अस्थायी", bn: "অস্থায়ী" } },
  { id: "daily_wage", label: "Daily Wage" , i18n: { en: "Daily Wage", hi: "दैनिक मज़दूरी", bn: "দৈনিক মজুরি" } },
  { id: "contract",   label: "Contract" , i18n: { en: "Contract", hi: "ठेका", bn: "চুক্তি" } },
  { id: "seasonal",   label: "Seasonal" , i18n: { en: "Seasonal", hi: "मौसमी", bn: "মৌসুমি" } },
  { id: "part_time",  label: "Part-Time" , i18n: { en: "Part-Time", hi: "अंशकालिक", bn: "খণ্ডকালীন" } },
  { id: "intern",     label: "Intern / Trainee" , i18n: { en: "Intern / Trainee", hi: "प्रशिक्षु", bn: "শিক্ষানবিশ" } },
  { id: "consultant", label: "Consultant" , i18n: { en: "Consultant", hi: "सलाहकार", bn: "পরামর্শদাতা" } },
];

export const DEPARTMENTS = [
  { id: "poultry",     label: "Poultry Unit" , i18n: { en: "Poultry Unit", hi: "मुर्गी इकाई", bn: "হাঁস-মুরগি ইউনিট" } },
  { id: "dairy",       label: "Dairy Unit" , i18n: { en: "Dairy Unit", hi: "डेयरी इकाई", bn: "ডেয়ারি ইউনিট" } },
  { id: "goat",        label: "Goat Unit" , i18n: { en: "Goat Unit", hi: "बकरी इकाई", bn: "ছাগল ইউনিট" } },
  { id: "pig",         label: "Pig Unit" , i18n: { en: "Pig Unit", hi: "सूअर इकाई", bn: "শূকর ইউনিট" } },
  { id: "fishery",     label: "Fishery Unit" , i18n: { en: "Fishery Unit", hi: "मत्स्य इकाई", bn: "মৎস্য ইউনিট" } },
  { id: "crop",        label: "Crop Unit" , i18n: { en: "Crop Unit", hi: "फ़सल इकाई", bn: "ফসল ইউনিট" } },
  { id: "bee",         label: "Bee Unit" , i18n: { en: "Bee Unit", hi: "मधुमक्खी इकाई", bn: "মৌমাছি ইউনিট" } },
  { id: "maintenance", label: "Maintenance" , i18n: { en: "Maintenance", hi: "रखरखाव", bn: "রক্ষণাবেক্ষণ" } },
  { id: "security",    label: "Security" , i18n: { en: "Security", hi: "सुरक्षा", bn: "নিরাপত্তা" } },
  { id: "transport",   label: "Transport" , i18n: { en: "Transport", hi: "परिवहन", bn: "পরিবহন" } },
  { id: "warehouse",   label: "Warehouse" , i18n: { en: "Warehouse", hi: "गोदाम", bn: "গুদাম" } },
  { id: "office",      label: "Office" , i18n: { en: "Office", hi: "कार्यालय", bn: "অফিস" } },
  { id: "sales",       label: "Sales" , i18n: { en: "Sales", hi: "बिक्री", bn: "বিক্রয়" } },
];

/* Built-in designations. Custom ones are appended from localStorage so a farm
   admin can add their own (single-user context — see plan §2 on RBAC). */
export const DESIGNATIONS = [
  { id: "farm_manager",     label: "Farm Manager" , i18n: { en: "Farm Manager", hi: "फार्म प्रबंधक", bn: "খামার ম্যানেজার" } },
  { id: "supervisor",       label: "Farm Supervisor" , i18n: { en: "Farm Supervisor", hi: "फार्म पर्यवेक्षक", bn: "খামার সুপারভাইজার" } },
  { id: "poultry_worker",   label: "Poultry Worker" , i18n: { en: "Poultry Worker", hi: "मुर्गी कर्मचारी", bn: "হাঁস-মুরগি কর্মী" } },
  { id: "dairy_worker",     label: "Dairy Worker" , i18n: { en: "Dairy Worker", hi: "डेयरी कर्मचारी", bn: "ডেয়ারি কর্মী" } },
  { id: "goat_worker",      label: "Goat Farm Worker" , i18n: { en: "Goat Farm Worker", hi: "बकरी फार्म कर्मचारी", bn: "ছাগল খামার কর্মী" } },
  { id: "pig_worker",       label: "Pig Farm Worker" , i18n: { en: "Pig Farm Worker", hi: "सूअर फार्म कर्मचारी", bn: "শূকর খামার কর্মী" } },
  { id: "fish_worker",      label: "Fish Farm Worker" , i18n: { en: "Fish Farm Worker", hi: "मछली फार्म कर्मचारी", bn: "মাছ খামার কর্মী" } },
  { id: "crop_worker",      label: "Crop Worker" , i18n: { en: "Crop Worker", hi: "फ़सल कर्मचारी", bn: "ফসল কর্মী" } },
  { id: "field_worker",     label: "Field Worker" , i18n: { en: "Field Worker", hi: "खेत कर्मचारी", bn: "মাঠ কর্মী" } },
  { id: "vet_assistant",    label: "Veterinary Assistant" , i18n: { en: "Veterinary Assistant", hi: "पशु चिकित्सा सहायक", bn: "পশুচিকিৎসা সহকারী" } },
  { id: "feed_store",       label: "Feed Store Worker" , i18n: { en: "Feed Store Worker", hi: "चारा भंडार कर्मचारी", bn: "খাদ্য ভাণ্ডার কর্মী" } },
  { id: "warehouse_worker", label: "Warehouse Worker" , i18n: { en: "Warehouse Worker", hi: "गोदाम कर्मचारी", bn: "গুদাম কর্মী" } },
  { id: "driver",           label: "Driver" , i18n: { en: "Driver", hi: "चालक", bn: "চালক" } },
  { id: "security_guard",   label: "Security Guard" , i18n: { en: "Security Guard", hi: "सुरक्षा गार्ड", bn: "নিরাপত্তা রক্ষী" } },
  { id: "electrician",      label: "Electrician" , i18n: { en: "Electrician", hi: "इलेक्ट्रीशियन", bn: "ইলেকট্রিশিয়ান" } },
  { id: "mechanic",         label: "Mechanic" , i18n: { en: "Mechanic", hi: "मैकेनिक", bn: "মেকানিক" } },
  { id: "accountant",       label: "Accountant" , i18n: { en: "Accountant", hi: "लेखाकार", bn: "হিসাবরক্ষক" } },
  { id: "sales_exec",       label: "Sales Executive" , i18n: { en: "Sales Executive", hi: "बिक्री अधिकारी", bn: "বিক্রয় কর্মকর্তা" } },
  { id: "office_staff",     label: "Office Staff" , i18n: { en: "Office Staff", hi: "कार्यालय कर्मचारी", bn: "অফিস কর্মী" } },
  { id: "other",            label: "Other" , i18n: { en: "Other", hi: "अन्य", bn: "অন্যান্য" } },
];

export const STATUSES = [
  { id: "active",         label: "Active",         tone: "primary" },
  { id: "on_leave",       label: "On Leave",       tone: "orange"  },
  { id: "suspended",      label: "Suspended",      tone: "red"     },
  { id: "inactive",       label: "Inactive",       tone: "faint"   },
  { id: "resigned",       label: "Resigned",       tone: "faint"   },
  { id: "terminated",     label: "Terminated",     tone: "red"     },
  { id: "contract_ended", label: "Contract Ended", tone: "faint"   },
  { id: "retired",        label: "Retired",        tone: "faint"   },
];

export const GENDERS = [
  { id: "male", label: "Male" }, { id: "female", label: "Female" }, { id: "other", label: "Other" },
];

/* Attendance statuses (spec §6). `worked` = day-fraction paid; `nonWorking`
   excludes the day from the attendance-% denominator. Legacy rows used only
   present/halfday/absent — all still valid here. */
export const ATTENDANCE_STATUSES = [
  { id: "present",    label: "Present",    short: "P",  tone: "primary", worked: 1 },
  { id: "halfday",    label: "Half Day",   short: "½",  tone: "orange",  worked: 0.5 },
  { id: "late",       label: "Late",       short: "L",  tone: "orange",  worked: 1 },
  { id: "overtime",   label: "Overtime",   short: "OT", tone: "primary", worked: 1 },
  { id: "absent",     label: "Absent",     short: "A",  tone: "red",     worked: 0 },
  { id: "leave",      label: "Leave",      short: "LV", tone: "blue",    worked: 0 },
  { id: "weekly_off", label: "Weekly Off", short: "WO", tone: "faint",   worked: 0, nonWorking: true },
  { id: "holiday",    label: "Holiday",    short: "H",  tone: "faint",   worked: 0, nonWorking: true },
];
const attMeta = (id) => ATTENDANCE_STATUSES.find((a) => a.id === id);

/* Legacy roles kept so pre-WF-1 records and callers keep working. */
export const ROLES = [
  { id: "manager",    label: "Farm Manager" },
  { id: "supervisor", label: "Supervisor" },
  { id: "worker",     label: "Worker" },
  { id: "consultant", label: "Consultant" },
];

/* ── Custom designations (localStorage, single-user) ───────────────────────── */
const CUSTOM_KEY = "hr:customDesignations";
const getCustomDesignations = () => storage.get(CUSTOM_KEY, []);

/* ── Repos ─────────────────────────────────────────────────────────────────── */
const employees  = repo("employees");
const attendance = repo("attendance");

const todayStr = () => new Date().toISOString().slice(0, 10);
const labelOf = (list, id) => list.find((x) => x.id === id)?.label ?? "";

export const employeeService = {
  /* ── CRUD ── */
  async add(data) {
    const list = await employees.getAll();
    const record = {
      status: "active",
      type: data.type || "permanent",
      joiningDate: data.joiningDate || todayStr(),
      code: data.code || this.nextEmployeeCode(list),
      ...data,
    };
    return employees.add(record);
  },
  getAll:  (farmId) => (farmId ? employees.getBy("farmId", farmId) : employees.getAll()),
  getById: (id) => employees.getById(id),
  update:  (id, patch) => employees.update(id, patch),
  remove:  (id) => employees.remove(id),

  /* Next sequential employee code: EMP-0001, EMP-0002 … (stable, gap-tolerant). */
  nextEmployeeCode(list = []) {
    const max = list.reduce((m, e) => {
      const n = parseInt(String(e.code || "").replace(/\D/g, ""), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    return `EMP-${String(max + 1).padStart(4, "0")}`;
  },

  /* ── Taxonomy access ── */
  designations() {
    const custom = getCustomDesignations();
    // keep "Other" last
    const base = DESIGNATIONS.filter((d) => d.id !== "other");
    const other = DESIGNATIONS.find((d) => d.id === "other");
    return [...base, ...custom, other];
  },
  addCustomDesignation(label) {
    const clean = String(label || "").trim();
    if (!clean) return null;
    const id = "custom_" + clean.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const custom = getCustomDesignations();
    if (!custom.some((d) => d.id === id) && !DESIGNATIONS.some((d) => d.id === id)) {
      storage.set(CUSTOM_KEY, [...custom, { id, label: clean }]);
    }
    return id;
  },

  /* ── Label helpers ── */
  typeLabel:        (id) => labelOf(EMPLOYEE_TYPES, id) || id || "",
  deptLabel:        (id) => labelOf(DEPARTMENTS, id) || id || "",
  statusLabel:      (id) => labelOf(STATUSES, id) || id || "",
  statusTone:       (id) => STATUSES.find((s) => s.id === id)?.tone || "faint",
  genderLabel:      (id) => labelOf(GENDERS, id) || id || "",
  roleLabel:        (id) => labelOf(ROLES, id) || id,
  designationLabel(id) {
    return labelOf(this.designations(), id) || this.roleLabel(id) || "";
  },
  /* Best display title: new designation → legacy role → "Worker". */
  jobTitle(e) {
    return (e.designation && this.designationLabel(e.designation))
      || (e.role && this.roleLabel(e.role))
      || "Worker";
  },

  /* ── Attendance ──
     `data` may be a status string (legacy) or an object with extra fields
     (checkIn, checkOut, overtimeHours, remarks). One row per employee/day. */
  attStatusLabel: (id) => attMeta(id)?.label ?? id ?? "",
  attStatusShort: (id) => attMeta(id)?.short ?? "",
  attStatusTone:  (id) => attMeta(id)?.tone ?? "faint",
  workedValue:    (id) => attMeta(id)?.worked ?? 0,

  async mark(employeeId, data, date = todayStr()) {
    const fields = typeof data === "string" ? { status: data } : { ...data };
    const rows = await attendance.getBy("employeeId", employeeId);
    const existing = rows.find((r) => r.date === date);
    if (existing) return attendance.update(existing.id, fields);
    return attendance.add({ employeeId, date, ...fields });
  },

  getAttendance: (employeeId) => attendance.getBy("employeeId", employeeId)
    .then((list) => list.sort((a, b) => b.date.localeCompare(a.date))),

  async todayStatus(farmId) {
    const list = await this.getAll(farmId);
    const map = {};
    await Promise.all(list.map(async (e) => {
      const rows = await attendance.getBy("employeeId", e.id);
      map[e.id] = rows.find((r) => r.date === todayStr())?.status || null;
    }));
    return map;
  },

  /* Today's roll-up for the attendance dashboard (spec §7). */
  async attendanceSummary(farmId, date = todayStr()) {
    const list = await this.getAll(farmId);
    const c = { total: list.length, present: 0, absent: 0, halfday: 0, late: 0, overtime: 0, leave: 0, weekly_off: 0, holiday: 0, notMarked: 0 };
    await Promise.all(list.map(async (e) => {
      const rows = await attendance.getBy("employeeId", e.id);
      const st = rows.find((r) => r.date === date)?.status;
      if (!st) c.notMarked++;
      else if (c[st] != null) c[st]++;
    }));
    return c;
  },

  /* One employee's month: status counts, overtime hours, worked days, %. */
  async monthAttendance(employeeId, yearMonth) {
    const rows = (await attendance.getBy("employeeId", employeeId))
      .filter((r) => r.date.startsWith(yearMonth))
      .sort((a, b) => b.date.localeCompare(a.date));
    const counts = { present: 0, halfday: 0, late: 0, overtime: 0, absent: 0, leave: 0, weekly_off: 0, holiday: 0 };
    let overtimeHours = 0;
    rows.forEach((r) => { if (counts[r.status] != null) counts[r.status]++; overtimeHours += Number(r.overtimeHours) || 0; });
    const worked = rows.reduce((s, r) => s + this.workedValue(r.status), 0);
    const workingDays = rows.filter((r) => !attMeta(r.status)?.nonWorking).length;
    const percent = workingDays ? Math.round((worked / workingDays) * 100) : 0;
    return { rows, counts, overtimeHours, worked, workingDays, percent };
  },

  /* Month wage summary. present/late/overtime = 1 day, half day = 0.5. */
  async monthWages(farmId, yearMonth /* "2026-07" */) {
    const list = await this.getAll(farmId);
    const out = [];
    for (const e of list) {
      const rows = (await attendance.getBy("employeeId", e.id)).filter((r) => r.date.startsWith(yearMonth));
      const days = rows.reduce((s, r) => s + this.workedValue(r.status), 0);
      const overtimeHours = rows.reduce((s, r) => s + (Number(r.overtimeHours) || 0), 0);
      out.push({ employee: e, daysWorked: days, overtimeHours, ...this.computeGross(e, days, overtimeHours) });
    }
    return out;
  },

  /* Gross pay for a month (spec §10). Daily-wage employees are paid per worked
     day; monthly-salary employees get their salary. Overtime adds on both. */
  computeGross(e, daysWorked, overtimeHours = 0) {
    const daily = Number(e.dailyWage) || 0;
    const salary = Number(e.monthlySalary) || 0;
    const otRate = Number(e.overtimeRate) || 0;
    const overtime = overtimeHours * otRate;
    const monthly = e.type !== "daily_wage" && salary > 0;
    const base = monthly ? salary : daysWorked * daily;
    return { basis: monthly ? "monthly" : "daily", base, overtime, gross: base + overtime };
  },

  /* Net payable after per-payment adjustments. */
  computeNet({ gross = 0, bonus = 0, allowance = 0, advance = 0, deduction = 0 }) {
    return (Number(gross) || 0) + (Number(bonus) || 0) + (Number(allowance) || 0)
      - (Number(advance) || 0) - (Number(deduction) || 0);
  },
};

export const PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "bank", label: "Bank Transfer" },
  { id: "upi",  label: "UPI" },
  { id: "other", label: "Other" },
];
