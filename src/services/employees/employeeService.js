/* Employees — profiles, roles, daily attendance, wage records (payroll-ready). */

import { repo } from "../erp/erpDb.js";

export const ROLES = [
  { id: "manager",    label: "Farm Manager" },
  { id: "supervisor", label: "Supervisor"   },
  { id: "worker",     label: "Worker"       },
  { id: "consultant", label: "Consultant"   },
];

const employees  = repo("employees");
const attendance = repo("attendance");

const todayStr = () => new Date().toISOString().slice(0, 10);

export const employeeService = {
  add:     (data) => employees.add(data),
  getAll:  (farmId) => (farmId ? employees.getBy("farmId", farmId) : employees.getAll()),
  getById: (id) => employees.getById(id),
  update:  (id, patch) => employees.update(id, patch),
  remove:  (id) => employees.remove(id),

  /* One attendance row per employee per day; re-marking replaces status. */
  async mark(employeeId, status, date = todayStr()) {
    const rows = await attendance.getBy("employeeId", employeeId);
    const existing = rows.find((r) => r.date === date);
    if (existing) return attendance.update(existing.id, { status });
    return attendance.add({ employeeId, date, status }); // present | absent | halfday
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

  /* Month wage summary from daily wage * days present (half days count 0.5). */
  async monthWages(farmId, yearMonth /* "2026-07" */) {
    const list = await this.getAll(farmId);
    const out = [];
    for (const e of list) {
      const rows = (await attendance.getBy("employeeId", e.id)).filter((r) => r.date.startsWith(yearMonth));
      const days = rows.reduce((s, r) => s + (r.status === "present" ? 1 : r.status === "halfday" ? 0.5 : 0), 0);
      out.push({ employee: e, daysWorked: days, wage: days * (Number(e.dailyWage) || 0) });
    }
    return out;
  },

  roleLabel: (id) => ROLES.find((r) => r.id === id)?.label ?? id,
};
