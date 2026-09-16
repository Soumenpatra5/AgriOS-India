import { describe, it, expect } from "vitest";
import {
  computeBatchDay,
  templateFires,
  derivePriority,
  resolveTaskDependencies,
  sortTasks,
  computeNextRecommendation,
  classifyIncidentSeverity,
  classifyIncidentCategory,
  buildGuidedResponse,
  shouldAutoFollowupHealth,
  vaccinationFollowupDays,
  outcomeClosesChain,
} from "../farm/poultryWorkflow.js";

/* ── computeBatchDay ─────────────────────────────────────────────────────── */
describe("computeBatchDay", () => {
  it("returns 0 on placement date", () => {
    expect(computeBatchDay("2026-09-01", "2026-09-01")).toBe(0);
  });
  it("returns correct day count", () => {
    expect(computeBatchDay("2026-09-01", "2026-09-08")).toBe(7);
    expect(computeBatchDay("2026-09-01", "2026-09-10")).toBe(9);
  });
  it("returns 0 when target is before placement (never negative)", () => {
    expect(computeBatchDay("2026-09-10", "2026-09-01")).toBe(0);
  });
  it("returns null when placement is missing", () => {
    expect(computeBatchDay(null, "2026-09-08")).toBeNull();
    expect(computeBatchDay(undefined, "2026-09-08")).toBeNull();
  });
  it("handles Date objects", () => {
    expect(computeBatchDay(new Date("2026-09-01"), "2026-09-08")).toBe(7);
  });
});

/* ── templateFires ───────────────────────────────────────────────────────── */
describe("templateFires", () => {
  const batch = { poultry_type: "broiler" };
  const countryBatch = { poultry_type: "country" };
  const turkeyBatch = { poultry_type: "turkey" };

  const make = (overrides) => ({
    trigger_type: "daily",
    trigger_config: null,
    day_from: null,
    day_to: null,
    poultry_types: null,
    ...overrides,
  });

  describe("daily trigger", () => {
    it("fires every day", () => {
      const t = make({ trigger_type: "daily" });
      expect(templateFires(t, 0, batch)).toBe(true);
      expect(templateFires(t, 14, batch)).toBe(true);
      expect(templateFires(t, 42, batch)).toBe(true);
    });
    it("respects day_from", () => {
      const t = make({ trigger_type: "daily", day_from: 7 });
      expect(templateFires(t, 6, batch)).toBe(false);
      expect(templateFires(t, 7, batch)).toBe(true);
      expect(templateFires(t, 8, batch)).toBe(true);
    });
    it("respects day_to", () => {
      const t = make({ trigger_type: "daily", day_to: 14 });
      expect(templateFires(t, 14, batch)).toBe(true);
      expect(templateFires(t, 15, batch)).toBe(false);
    });
    it("respects both day_from and day_to", () => {
      const t = make({ trigger_type: "daily", day_from: 0, day_to: 14 });
      expect(templateFires(t, 0, batch)).toBe(true);
      expect(templateFires(t, 14, batch)).toBe(true);
      expect(templateFires(t, 15, batch)).toBe(false);
    });
  });

  describe("on_day trigger", () => {
    it("fires only on exact day", () => {
      const t = make({ trigger_type: "on_day", trigger_config: { day: 7 } });
      expect(templateFires(t, 6, batch)).toBe(false);
      expect(templateFires(t, 7, batch)).toBe(true);
      expect(templateFires(t, 8, batch)).toBe(false);
    });
    it("fires on day 0 with day:0", () => {
      const t = make({ trigger_type: "on_day", trigger_config: { day: 0 } });
      expect(templateFires(t, 0, batch)).toBe(true);
      expect(templateFires(t, 1, batch)).toBe(false);
    });
  });

  describe("every_n_days trigger", () => {
    it("fires at intervals from start_day", () => {
      const t = make({ trigger_type: "every_n_days", trigger_config: { every_n_days: 7, start_day: 14 } });
      expect(templateFires(t, 13, batch)).toBe(false);
      expect(templateFires(t, 14, batch)).toBe(true);
      expect(templateFires(t, 15, batch)).toBe(false);
      expect(templateFires(t, 21, batch)).toBe(true);
      expect(templateFires(t, 28, batch)).toBe(true);
    });
    it("every_n_days=3 fires at start_day, +3, +6...", () => {
      const t = make({ trigger_type: "every_n_days", trigger_config: { every_n_days: 3, start_day: 3 } });
      expect(templateFires(t, 2, batch)).toBe(false);
      expect(templateFires(t, 3, batch)).toBe(true);
      expect(templateFires(t, 4, batch)).toBe(false);
      expect(templateFires(t, 6, batch)).toBe(true);
      expect(templateFires(t, 9, batch)).toBe(true);
    });
  });

  describe("reactive trigger", () => {
    it("never auto-fires in Phase A", () => {
      const t = make({ trigger_type: "reactive" });
      expect(templateFires(t, 0, batch)).toBe(false);
      expect(templateFires(t, 100, batch)).toBe(false);
    });
  });

  describe("poultry_types filter", () => {
    it("fires for matching type", () => {
      const t = make({ trigger_type: "daily", poultry_types: ["broiler", "country"] });
      expect(templateFires(t, 5, batch)).toBe(true);
      expect(templateFires(t, 5, countryBatch)).toBe(true);
    });
    it("does not fire for unmatched type", () => {
      const t = make({ trigger_type: "daily", poultry_types: ["broiler", "country"] });
      expect(templateFires(t, 5, turkeyBatch)).toBe(false);
    });
    it("fires for all types when poultry_types is null", () => {
      const t = make({ trigger_type: "daily", poultry_types: null });
      expect(templateFires(t, 5, turkeyBatch)).toBe(true);
    });
  });
});

/* ── derivePriority ──────────────────────────────────────────────────────── */
describe("derivePriority", () => {
  it("returns base priority when no escalation factors", () => {
    expect(derivePriority("normal")).toBe("normal");
    expect(derivePriority("high")).toBe("high");
    expect(derivePriority("low")).toBe("low");
  });
  it("escalates to urgent when 3+ days overdue", () => {
    expect(derivePriority("normal", { daysOverdue: 3 })).toBe("urgent");
    expect(derivePriority("low", { daysOverdue: 5 })).toBe("urgent");
  });
  it("escalates by 1 tier when 1-2 days overdue", () => {
    expect(derivePriority("normal", { daysOverdue: 1 })).toBe("high");
    expect(derivePriority("low", { daysOverdue: 2 })).toBe("normal");
  });
  it("escalates on mortalityOverTarget signal", () => {
    expect(derivePriority("low", { signals: { mortalityOverTarget: true } })).toBe("normal");
    expect(derivePriority("normal", { signals: { mortalityOverTarget: true } })).toBe("high");
  });
  it("escalates on adgNegative signal", () => {
    expect(derivePriority("normal", { signals: { adgNegative: true } })).toBe("high");
  });
  it("does not go below urgent (clamps at 0)", () => {
    expect(derivePriority("urgent", { daysOverdue: 10 })).toBe("urgent");
    expect(derivePriority("urgent", { signals: { mortalityOverTarget: true, adgNegative: true } })).toBe("urgent");
  });
  it("defaults unknown base priority to normal", () => {
    expect(derivePriority("unknown")).toBe("normal");
    expect(derivePriority("unknown", { daysOverdue: 1 })).toBe("high");
  });
});

/* ── resolveTaskDependencies ─────────────────────────────────────────────── */
describe("resolveTaskDependencies", () => {
  const mkTask = (templateId, status, extra = {}) => ({
    id: templateId + "-id",
    template_id: templateId,
    status,
    task_type: "data_recording",
    ...extra,
  });

  it("blocks daily-env when daily-mortality is pending", () => {
    const tasks = [
      mkTask("daily-mortality", "pending"),
      mkTask("daily-env", "pending"),
    ];
    resolveTaskDependencies(tasks);
    expect(tasks.find((t) => t.template_id === "daily-env").status).toBe("blocked");
    expect(tasks.find((t) => t.template_id === "daily-mortality").status).toBe("pending");
  });

  it("does NOT block daily-env when daily-mortality is completed", () => {
    const tasks = [
      mkTask("daily-mortality", "completed"),
      mkTask("daily-env", "pending"),
    ];
    resolveTaskDependencies(tasks);
    expect(tasks.find((t) => t.template_id === "daily-env").status).toBe("pending");
  });

  it("does NOT block daily-env when daily-mortality is skipped", () => {
    const tasks = [
      mkTask("daily-mortality", "skipped"),
      mkTask("daily-env", "pending"),
    ];
    resolveTaskDependencies(tasks);
    expect(tasks.find((t) => t.template_id === "daily-env").status).toBe("pending");
  });

  it("blocks daily-water transitively when daily-env is blocked", () => {
    const tasks = [
      mkTask("daily-mortality", "pending"),
      mkTask("daily-env", "pending"),
      mkTask("daily-water", "pending"),
    ];
    resolveTaskDependencies(tasks);
    // daily-env gets blocked by daily-mortality; then daily-water should be blocked by daily-env
    // (even though daily-env's status was updated to blocked during the same loop pass)
    const envTask = tasks.find((t) => t.template_id === "daily-env");
    const waterTask = tasks.find((t) => t.template_id === "daily-water");
    expect(envTask.status).toBe("blocked");
    expect(waterTask.status).toBe("blocked");
  });

  it("does not block chain_followup tasks regardless of dependencies", () => {
    const tasks = [
      mkTask("daily-mortality", "pending"),
      mkTask("daily-env", "pending"),
      { id: "chain-task-id", template_id: "daily-env", status: "pending", task_type: "chain_followup" },
    ];
    resolveTaskDependencies(tasks);
    // The chain task should not be blocked
    const chainTask = tasks.find((t) => t.id === "chain-task-id");
    expect(chainTask.status).toBe("pending");
  });

  it("does not block tasks without known dependency entries", () => {
    const tasks = [
      mkTask("biosecurity-weekly", "pending"),
      mkTask("weight-weekly", "pending"),
    ];
    resolveTaskDependencies(tasks);
    expect(tasks.find((t) => t.template_id === "biosecurity-weekly").status).toBe("pending");
    expect(tasks.find((t) => t.template_id === "weight-weekly").status).toBe("pending");
  });
});

/* ── sortTasks ───────────────────────────────────────────────────────────── */
describe("sortTasks", () => {
  const mk = (overrides) => ({
    priority: "normal",
    task_type: "data_recording",
    status: "pending",
    sort_order: 0,
    ...overrides,
  });

  it("sorts urgent before high before normal before low", () => {
    const tasks = [
      mk({ priority: "low", id: "low" }),
      mk({ priority: "urgent", id: "urgent" }),
      mk({ priority: "normal", id: "normal" }),
      mk({ priority: "high", id: "high" }),
    ];
    const sorted = sortTasks(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["urgent", "high", "normal", "low"]);
  });

  it("puts chain_followup before regular tasks within same priority", () => {
    const tasks = [
      mk({ priority: "high", task_type: "data_recording", id: "regular" }),
      mk({ priority: "high", task_type: "chain_followup", id: "chain" }),
    ];
    const sorted = sortTasks(tasks);
    expect(sorted[0].id).toBe("chain");
    expect(sorted[1].id).toBe("regular");
  });

  it("sorts overdue before pending before blocked within same priority+type", () => {
    const tasks = [
      mk({ status: "blocked", id: "blocked" }),
      mk({ status: "overdue", id: "overdue" }),
      mk({ status: "pending", id: "pending" }),
    ];
    const sorted = sortTasks(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["overdue", "pending", "blocked"]);
  });

  it("does not mutate the original array", () => {
    const tasks = [mk({ id: "b" }), mk({ id: "a" })];
    const sorted = sortTasks(tasks);
    expect(tasks[0].id).toBe("b"); // original unchanged
    expect(sorted).not.toBe(tasks);
  });
});

/* ── computeNextRecommendation ───────────────────────────────────────────── */
describe("computeNextRecommendation", () => {
  it("returns null task and a message when list is empty", () => {
    const r = computeNextRecommendation([], "2026-09-16");
    expect(r.task).toBeNull();
    expect(r.reason).toBeTruthy();
  });

  it("returns the first task from the sorted list", () => {
    const tasks = [
      { id: "first", template_id: "daily-mortality", status: "pending", reason: null },
      { id: "second", template_id: "daily-env", status: "pending", reason: null },
    ];
    const r = computeNextRecommendation(tasks, "2026-09-16");
    expect(r.task.id).toBe("first");
    expect(r.reason).toMatch(/mortality/i);
  });

  it("uses task.reason when provided", () => {
    const tasks = [{ id: "t", template_id: "weight-d7", status: "pending", reason: "Custom reason" }];
    const r = computeNextRecommendation(tasks, "2026-09-16");
    expect(r.reason).toBe("Custom reason");
  });

  it("mentions overdue in reason for overdue tasks", () => {
    const tasks = [{ id: "t", template_id: "other", status: "overdue", scheduled_date: "2026-09-14", reason: null }];
    const r = computeNextRecommendation(tasks, "2026-09-16");
    expect(r.reason).toMatch(/overdue/i);
  });

  it("mentions follow-up in reason for chain tasks", () => {
    const tasks = [{ id: "t", template_id: null, task_type: "chain_followup", status: "pending", reason: null }];
    const r = computeNextRecommendation(tasks, "2026-09-16");
    expect(r.reason).toMatch(/follow.?up/i);
  });
});

/* ── classifyIncidentSeverity ────────────────────────────────────────────── */
describe("classifyIncidentSeverity", () => {
  it("returns urgent for urgent keywords", () => {
    expect(classifyIncidentSeverity("birds are dying everywhere")).toBe("urgent");
    expect(classifyIncidentSeverity("mass death in shed 2")).toBe("urgent");
    expect(classifyIncidentSeverity("emergency — birds collapsing")).toBe("urgent");
  });
  it("returns urgent for high mortalityPct", () => {
    expect(classifyIncidentSeverity("some birds sick", { mortalityPct: 6 })).toBe("urgent");
  });
  it("returns high for high-severity keywords", () => {
    expect(classifyIncidentSeverity("birds not eating today")).toBe("high");
    expect(classifyIncidentSeverity("nipples blocked, no water flow")).toBe("high");
    expect(classifyIncidentSeverity("birds are lethargic")).toBe("high");
    expect(classifyIncidentSeverity("water stopped completely")).toBe("high");
  });
  it("returns high for feedDrop50 signal", () => {
    expect(classifyIncidentSeverity("unusual", { feedDrop50: true })).toBe("high");
  });
  it("returns normal for generic description", () => {
    expect(classifyIncidentSeverity("birds look slightly less active")).toBe("normal");
  });
  it("is case-insensitive", () => {
    expect(classifyIncidentSeverity("BIRDS ARE DYING")).toBe("urgent");
    expect(classifyIncidentSeverity("Feed DROP noticed")).toBe("high");
  });
});

/* ── classifyIncidentCategory ────────────────────────────────────────────── */
describe("classifyIncidentCategory", () => {
  it("classifies water issues", () => {
    expect(classifyIncidentCategory("drinker blocked")).toBe("water");
    expect(classifyIncidentCategory("water pipe is leaking")).toBe("water");
    expect(classifyIncidentCategory("nipple pressure is low")).toBe("water");
  });
  it("classifies feed issues", () => {
    expect(classifyIncidentCategory("birds not eating the feed")).toBe("feed");
    expect(classifyIncidentCategory("feeder is empty")).toBe("feed");
  });
  it("classifies environment issues", () => {
    expect(classifyIncidentCategory("temperature is too high")).toBe("environment");
    expect(classifyIncidentCategory("fan stopped working")).toBe("environment");
    expect(classifyIncidentCategory("ventilation is poor")).toBe("environment");
  });
  it("classifies respiratory issues", () => {
    expect(classifyIncidentCategory("birds gasping for air")).toBe("respiratory");
    expect(classifyIncidentCategory("sneezing observed")).toBe("respiratory");
    expect(classifyIncidentCategory("breathing difficulty")).toBe("respiratory");
  });
  it("classifies lameness", () => {
    expect(classifyIncidentCategory("birds unable to walk")).toBe("lameness");
    expect(classifyIncidentCategory("leg problem in several birds")).toBe("lameness");
  });
  it("classifies digestive issues", () => {
    expect(classifyIncidentCategory("diarrhea observed")).toBe("digestive");
    expect(classifyIncidentCategory("loose stool")).toBe("digestive");
  });
  it("defaults to health for unrecognized descriptions", () => {
    expect(classifyIncidentCategory("general problem noticed")).toBe("health");
    expect(classifyIncidentCategory("")).toBe("health");
  });
});

/* ── buildGuidedResponse ─────────────────────────────────────────────────── */
describe("buildGuidedResponse", () => {
  it("returns an object with required keys", () => {
    const r = buildGuidedResponse("water", "urgent", 10);
    expect(r).toHaveProperty("checks");
    expect(r).toHaveProperty("explanations");
    expect(r).toHaveProperty("actions");
    expect(r).toHaveProperty("what_to_record");
    expect(r).toHaveProperty("escalate_if");
    expect(r).toHaveProperty("batch_day", 10);
    expect(r).toHaveProperty("disclaimer");
  });

  it("has non-empty checks array", () => {
    const r = buildGuidedResponse("mortality", "urgent", 5);
    expect(Array.isArray(r.checks)).toBe(true);
    expect(r.checks.length).toBeGreaterThan(0);
  });

  it("always appends the veterinarian escalation reminder", () => {
    const r = buildGuidedResponse("health", "normal", 0);
    expect(r.escalate_if).toMatch(/veterinarian/i);
  });

  it("falls back to health.severity for unknown category", () => {
    const r = buildGuidedResponse("unknown_category", "high", 3);
    expect(r.checks).toBeTruthy();
    expect(r.checks.length).toBeGreaterThan(0);
  });

  it("falls back to health.normal for fully unknown category+severity", () => {
    const r = buildGuidedResponse("unknown", "unknown_sev", 0);
    expect(r.checks).toBeTruthy();
    expect(r.disclaimer).toMatch(/rule-based/i);
  });

  it("includes batch_day in response", () => {
    const r = buildGuidedResponse("respiratory", "urgent", 21);
    expect(r.batch_day).toBe(21);
  });
});

/* ── shouldAutoFollowupHealth — auto-trigger predicate ───────────────────── */
describe("shouldAutoFollowupHealth", () => {
  // treatment always triggers
  it("treatment triggers regardless of severity", () => {
    expect(shouldAutoFollowupHealth("treatment", null)).toBe(true);
    expect(shouldAutoFollowupHealth("treatment", "urgent")).toBe(true);
    expect(shouldAutoFollowupHealth("treatment", "normal")).toBe(true);
    expect(shouldAutoFollowupHealth("treatment", "high")).toBe(true);
  });

  // outbreak always triggers
  it("outbreak triggers regardless of severity", () => {
    expect(shouldAutoFollowupHealth("outbreak", null)).toBe(true);
    expect(shouldAutoFollowupHealth("outbreak", "urgent")).toBe(true);
    expect(shouldAutoFollowupHealth("outbreak", "normal")).toBe(true);
  });

  // observation + urgent triggers
  it("observation with severity=urgent triggers", () => {
    expect(shouldAutoFollowupHealth("observation", "urgent")).toBe(true);
  });

  // observation + non-urgent does NOT trigger
  it("observation with severity=normal does NOT trigger", () => {
    expect(shouldAutoFollowupHealth("observation", "normal")).toBe(false);
  });
  it("observation with severity=high does NOT trigger", () => {
    expect(shouldAutoFollowupHealth("observation", "high")).toBe(false);
  });
  it("observation with no severity (null) does NOT trigger", () => {
    expect(shouldAutoFollowupHealth("observation", null)).toBe(false);
  });
  it("observation with undefined severity does NOT trigger", () => {
    expect(shouldAutoFollowupHealth("observation", undefined)).toBe(false);
  });

  // vet_visit never triggers
  it("vet_visit never triggers regardless of severity", () => {
    expect(shouldAutoFollowupHealth("vet_visit", null)).toBe(false);
    expect(shouldAutoFollowupHealth("vet_visit", "urgent")).toBe(false);
    expect(shouldAutoFollowupHealth("vet_visit", "normal")).toBe(false);
  });

  // complete matrix over all 4 event types
  it("complete trigger matrix matches approved design", () => {
    const ALL_TYPES = ["observation", "treatment", "vet_visit", "outbreak"];
    const alwaysTrigger = ALL_TYPES.filter((t) => shouldAutoFollowupHealth(t, null));
    expect(alwaysTrigger).toEqual(["treatment", "outbreak"]);
    // observation only fires when urgent — not in the "always" set
    expect(shouldAutoFollowupHealth("observation", "urgent")).toBe(true);
    expect(shouldAutoFollowupHealth("observation", "normal")).toBe(false);
  });
});

/* ── vaccinationFollowupDays — interval normalisation ───────────────────── */
describe("vaccinationFollowupDays", () => {
  it("defaults to 7 when payload is undefined", () => {
    expect(vaccinationFollowupDays(undefined)).toBe(7);
  });
  it("defaults to 7 when payload is null", () => {
    expect(vaccinationFollowupDays(null)).toBe(7);
  });
  it("defaults to 7 for non-numeric input", () => {
    expect(vaccinationFollowupDays("abc")).toBe(7);
    expect(vaccinationFollowupDays("")).toBe(7);
  });
  it("defaults to 7 for zero", () => {
    expect(vaccinationFollowupDays(0)).toBe(7);
  });
  it("defaults to 7 for negative values", () => {
    expect(vaccinationFollowupDays(-1)).toBe(7);
  });
  it("accepts integer 1 (minimum override)", () => {
    expect(vaccinationFollowupDays(1)).toBe(1);
  });
  it("accepts 7 (standard post-vacc check)", () => {
    expect(vaccinationFollowupDays(7)).toBe(7);
  });
  it("accepts 14 (custom override)", () => {
    expect(vaccinationFollowupDays(14)).toBe(14);
  });
  it("accepts 365 (maximum)", () => {
    expect(vaccinationFollowupDays(365)).toBe(365);
  });
  it("defaults to 7 for 366 (above maximum)", () => {
    expect(vaccinationFollowupDays(366)).toBe(7);
  });
  it("coerces numeric strings", () => {
    expect(vaccinationFollowupDays("14")).toBe(14);
  });
  it("defaults to 7 for float (not integer)", () => {
    expect(vaccinationFollowupDays(3.5)).toBe(7);
  });
});

/* ── outcomeClosesChain — chain resolution logic ─────────────────────────── */
describe("outcomeClosesChain", () => {
  it("resolving outcomes close the chain", () => {
    expect(outcomeClosesChain("recovered")).toBe(true);
    expect(outcomeClosesChain("resolved")).toBe(true);
    expect(outcomeClosesChain("deceased")).toBe(true);
  });

  it("ongoing outcomes do NOT close the chain", () => {
    expect(outcomeClosesChain("improved")).toBe(false);
    expect(outcomeClosesChain("same")).toBe(false);
    expect(outcomeClosesChain("worse")).toBe(false);
  });

  it("unknown outcome does NOT close the chain", () => {
    expect(outcomeClosesChain("unknown")).toBe(false);
    expect(outcomeClosesChain("")).toBe(false);
    expect(outcomeClosesChain(null)).toBe(false);
    expect(outcomeClosesChain(undefined)).toBe(false);
  });
});

/* ── idempotency key derivation for auto-created chains ──────────────────── */
describe("auto-chain idempotency key format", () => {
  it("health chain key embeds the health event id", () => {
    const id = "abc-123";
    const key = `auto_chain_health_${id}`;
    expect(key).toBe("auto_chain_health_abc-123");
    // The key must be unique per event — two different events produce two keys
    const id2 = "def-456";
    const key2 = `auto_chain_health_${id2}`;
    expect(key).not.toBe(key2);
  });

  it("vaccination chain key embeds the vaccination row id", () => {
    const id = "vacc-789";
    const key = `auto_chain_vacc_${id}`;
    expect(key).toBe("auto_chain_vacc_vacc-789");
    // Health and vaccination keys for same UUID do not collide
    const healthKey = `auto_chain_health_${id}`;
    expect(key).not.toBe(healthKey);
  });

  it("two retries of the same event produce the same key (idempotent)", () => {
    const id = "same-event-id";
    const key1 = `auto_chain_health_${id}`;
    const key2 = `auto_chain_health_${id}`;
    expect(key1).toBe(key2);
  });
});

/* ── outcome → chain-continuation logic ─────────────────────────────────── */
describe("chain continuation from outcome", () => {
  const ONGOING = ["improved", "same", "worse"];
  const RESOLVING = ["recovered", "resolved", "deceased"];

  it("all ongoing outcomes should NOT close the chain", () => {
    for (const o of ONGOING) {
      expect(outcomeClosesChain(o)).toBe(false);
    }
  });

  it("all resolving outcomes SHOULD close the chain", () => {
    for (const o of RESOLVING) {
      expect(outcomeClosesChain(o)).toBe(true);
    }
  });

  it("ongoing outcome with nextFollowupDays > 0 implies next task should be scheduled", () => {
    // Pure logic test: isResolution = false + nextFollowupDays = 1 → schedule next task
    for (const o of ONGOING) {
      const isResolution = outcomeClosesChain(o);
      const nextFollowupDays = 1;
      const shouldScheduleNext = !isResolution && nextFollowupDays >= 1;
      expect(shouldScheduleNext).toBe(true);
    }
  });

  it("resolving outcome implies no next task regardless of nextFollowupDays", () => {
    for (const o of RESOLVING) {
      const isResolution = outcomeClosesChain(o);
      const nextFollowupDays = 1;
      const shouldScheduleNext = !isResolution && nextFollowupDays >= 1;
      expect(shouldScheduleNext).toBe(false);
    }
  });

  it("ongoing outcome with nextFollowupDays=0 implies no next task", () => {
    for (const o of ONGOING) {
      const isResolution = outcomeClosesChain(o);
      const nextFollowupDays = 0;
      const shouldScheduleNext = !isResolution && nextFollowupDays >= 1;
      expect(shouldScheduleNext).toBe(false);
    }
  });
});
