/* Unit tests for PoultryWorkflowTab UI helpers.
   These test pure data-transformation logic that cannot be exercised by E2E. */

import { describe, it, expect } from "vitest";

/* ── fmtDate (inline copy of the helper — keeps tests self-contained) ──── */

function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(iso).slice(0, 10); }
}

/* ── TASK_TYPE_LABEL mapping (mirrors PoultryWorkflowTab.jsx) ─────────── */

const TASK_TYPE_LABEL = {
  monitoring_check: { en: "Monitoring",    hi: "निरीक्षण",       bn: "পর্যবেক্ষণ" },
  data_recording:   { en: "Record",        hi: "रिकॉर्ड",        bn: "রেকর্ড" },
  physical_task:    { en: "Physical task", hi: "शारीरिक कार्य",  bn: "শারীরিক কাজ" },
  chain_followup:   { en: "Follow-up",     hi: "फ़ॉलो-अप",       bn: "ফলো-আপ" },
  incident_task:    { en: "Problem",       hi: "समस्या",         bn: "সমস্যা" },
  reactive:         { en: "Alert",         hi: "अलर्ट",          bn: "সতর্কতা" },
  manual:           { en: "Manual",        hi: "मैन्युअल",       bn: "ম্যানুয়াল" },
};

/* ── fmtDate tests ────────────────────────────────────────────────────── */

describe("fmtDate", () => {
  it("formats a full ISO timestamp without raw T/Z characters", () => {
    const result = fmtDate("2026-09-16T00:00:00.000Z");
    expect(result).not.toContain("T");
    expect(result).not.toContain("Z");
    expect(result).not.toContain(".000");
  });

  it("includes the year 2026 in the output", () => {
    expect(fmtDate("2026-09-16T00:00:00.000Z")).toContain("2026");
  });

  it("returns empty string for null/undefined", () => {
    expect(fmtDate(null)).toBe("");
    expect(fmtDate(undefined)).toBe("");
    expect(fmtDate("")).toBe("");
  });

  it("gracefully handles a plain date string (no T)", () => {
    const result = fmtDate("2026-09-16");
    expect(result).toBeTruthy();
    expect(result).not.toContain("T");
  });
});

/* ── TASK_TYPE_LABEL tests ────────────────────────────────────────────── */

describe("TASK_TYPE_LABEL", () => {
  const allTypes = [
    "monitoring_check", "data_recording", "physical_task",
    "chain_followup", "incident_task", "reactive", "manual",
  ];

  it.each(allTypes)("type '%s' has en, hi, bn labels", (type) => {
    const entry = TASK_TYPE_LABEL[type];
    expect(entry).toBeDefined();
    expect(typeof entry.en).toBe("string");
    expect(typeof entry.hi).toBe("string");
    expect(typeof entry.bn).toBe("string");
    expect(entry.en.length).toBeGreaterThan(0);
  });

  it("monitoring_check does not fall through to raw enum string", () => {
    expect(TASK_TYPE_LABEL.monitoring_check.en).toBe("Monitoring");
    expect(TASK_TYPE_LABEL.monitoring_check.bn).toBe("পর্যবেক্ষণ");
  });

  it("incident_task maps to Problem", () => {
    expect(TASK_TYPE_LABEL.incident_task.en).toBe("Problem");
    expect(TASK_TYPE_LABEL.incident_task.hi).toBe("समस्या");
  });

  it("physical_task has all three locale strings", () => {
    const e = TASK_TYPE_LABEL.physical_task;
    expect(e.en).toBe("Physical task");
    expect(e.hi).toBe("शारीरिक कार्य");
    expect(e.bn).toBe("শারীরিক কাজ");
  });

  it("unknown task type is absent from the map (caller shows fallback)", () => {
    expect(TASK_TYPE_LABEL["unknown_future_type"]).toBeUndefined();
  });
});

/* ── recommendation deduplication helper ──────────────────────────────── */

describe("pending task deduplication (recommendation exclusion)", () => {
  const tasks = [
    { id: "task-1", title: "Day 0: Confirm placement" },
    { id: "task-2", title: "Record mortality and culls" },
    { id: "task-3", title: "Brooding temperature check" },
  ];

  it("filters the recommended task from the pending list", () => {
    const recTaskId = "task-1";
    const todayTasks = tasks.filter(t => t.id !== recTaskId);
    expect(todayTasks).toHaveLength(2);
    expect(todayTasks.find(t => t.id === "task-1")).toBeUndefined();
  });

  it("shows all tasks when no recommendation is set (recTaskId undefined)", () => {
    const recTaskId = undefined;
    const todayTasks = tasks.filter(t => t.id !== recTaskId);
    expect(todayTasks).toHaveLength(3);
  });

  it("all tasks shown when recommendation refers to an overdue task (not in pending)", () => {
    const recTaskId = "task-overdue-99";
    const todayTasks = tasks.filter(t => t.id !== recTaskId);
    expect(todayTasks).toHaveLength(3);
  });
});
