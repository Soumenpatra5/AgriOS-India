/* Workforce reports → CSV (spec §28/§29). Pure row-builders (testable) plus
   thin download wrappers over the shared exportCsv util. No sensitive document
   contents are ever exported — roster/wage figures only. */

import { downloadCsv } from "../../utils/exportCsv.js";
import { employeeService } from "./employeeService.js";

const today = () => new Date().toISOString().slice(0, 10);

export const employeeReports = {
  rosterRows(employees) {
    return employees.map((e) => ({
      Code: e.code || "",
      Name: e.name || "",
      Designation: employeeService.jobTitle(e),
      Department: e.department ? employeeService.deptLabel(e.department) : "",
      Type: employeeService.typeLabel(e.type),
      Status: employeeService.statusLabel(e.status),
      Phone: e.phone || "",
      "Daily Wage": e.dailyWage || "",
      "Monthly Salary": e.monthlySalary || "",
      Joined: e.joiningDate || "",
    }));
  },

  wageRows(wages) {
    return wages.map((w) => ({
      Code: w.employee.code || "",
      Name: w.employee.name || "",
      "Days Worked": w.daysWorked,
      "Overtime Hrs": w.overtimeHours || 0,
      Gross: w.gross,
    }));
  },

  exportRoster: (employees) => downloadCsv(employeeReports.rosterRows(employees), `employees-${today()}.csv`),
  exportWages: (wages, yearMonth) => downloadCsv(employeeReports.wageRows(wages), `wages-${yearMonth}.csv`),
};
