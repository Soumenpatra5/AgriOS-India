/* Employees — the central workforce record: profile, employment, farm
   assignment, daily attendance and wage computation. Built on the shared ERP
   repo (Repository Pattern) so it inherits offline sync automatically.

   The `employees` store is schemaless (IndexedDB), so the rich profile fields
   added here need no migration — older records simply omit them and the UI
   falls back gracefully. `role` (legacy) is kept and mapped to `designation`. */

import { repo } from "../erp/erpDb.js";
import { storage } from "../../utils/storage.js";

/* ── Taxonomies (spec §2, §4, §5, §22) ─────────────────────────────────────── */

export const EMPLOYEE_TYPES = [
  { id: "permanent",  label: "Permanent" },
  { id: "temporary",  label: "Temporary" },
  { id: "daily_wage", label: "Daily Wage" },
  { id: "contract",   label: "Contract" },
  { id: "seasonal",   label: "Seasonal" },
  { id: "part_time",  label: "Part-Time" },
  { id: "intern",     label: "Intern / Trainee" },
  { id: "consultant", label: "Consultant" },
];

export const DEPARTMENTS = [
  { id: "poultry",     label: "Poultry Unit" },
  { id: "dairy",       label: "Dairy Unit" },
  { id: "goat",        label: "Goat Unit" },
  { id: "pig",         label: "Pig Unit" },
  { id: "fishery",     label: "Fishery Unit" },
  { id: "crop",        label: "Crop Unit" },
  { id: "bee",         label: "Bee Unit" },
  { id: "maintenance", label: "Maintenance" },
  { id: "security",    label: "Security" },
  { id: "transport",   label: "Transport" },
  { id: "warehouse",   label: "Warehouse" },
  { id: "office",      label: "Office" },
  { id: "sales",       label: "Sales" },
];

/* Built-in designations. Custom ones are appended from localStorage so a farm
   admin can add their own (single-user context — see plan §2 on RBAC). */
export const DESIGNATIONS = [
  { id: "farm_manager",     label: "Farm Manager" },
  { id: "supervisor",       label: "Farm Supervisor" },
  { id: "poultry_worker",   label: "Poultry Worker" },
  { id: "dairy_worker",     label: "Dairy Worker" },
  { id: "goat_worker",      label: "Goat Farm Worker" },
  { id: "pig_worker",       label: "Pig Farm Worker" },
  { id: "fish_worker",      label: "Fish Farm Worker" },
  { id: "crop_worker",      label: "Crop Worker" },
  { id: "field_worker",     label: "Field Worker" },
  { id: "vet_assistant",    label: "Veterinary Assistant" },
  { id: "feed_store",       label: "Feed Store Worker" },
  { id: "warehouse_worker", label: "Warehouse Worker" },
  { id: "driver",           label: "Driver" },
  { id: "security_guard",   label: "Security Guard" },
  { id: "electrician",      label: "Electrician" },
  { id: "mechanic",         label: "Mechanic" },
  { id: "accountant",       label: "Accountant" },
  { id: "sales_exec",       label: "Sales Executive" },
  { id: "office_staff",     label: "Office Staff" },
  { id: "other",            label: "Other" },
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
      out.push({ employee: e, daysWorked: days, wage: days * (Number(e.dailyWage) || 0) });
    }
    return out;
  },
};
