import { describe, it, expect } from "vitest";

// deriveIsPregnant is the only exported pure function from GoatAnimalDetail.
// It scans repro events (desc by date) for the first definitive pregnancy signal.
// vi.stubGlobal is not needed — the export is a plain pure function with no imports.
import { deriveIsPregnant } from "../GoatAnimalDetail.jsx";

const mkRepro = (event_type, event_date, pregnancy_result = null) => ({
  kind: "repro_event", id: Math.random(), event_type, event_date,
  pregnancy_result,
});

describe("deriveIsPregnant", () => {
  it("returns false for empty history", () => {
    expect(deriveIsPregnant([])).toBe(false);
  });

  it("returns false when only mating events exist (no definitive signal)", () => {
    expect(deriveIsPregnant([
      mkRepro("mating", "2026-08-01"),
    ])).toBe(false);
  });

  it("returns false when only weaning or heat_observed events exist", () => {
    expect(deriveIsPregnant([
      mkRepro("weaning",       "2026-07-01"),
      mkRepro("heat_observed", "2026-06-01"),
    ])).toBe(false);
  });

  it("returns true on pregnancy_check positive", () => {
    expect(deriveIsPregnant([
      mkRepro("pregnancy_check", "2026-09-01", "positive"),
    ])).toBe(true);
  });

  it("returns false on pregnancy_check negative", () => {
    expect(deriveIsPregnant([
      mkRepro("pregnancy_check", "2026-09-01", "negative"),
    ])).toBe(false);
  });

  it("skips inconclusive and reads the next event", () => {
    expect(deriveIsPregnant([
      mkRepro("pregnancy_check", "2026-09-10", "inconclusive"),
      mkRepro("pregnancy_check", "2026-08-01", "positive"),
    ])).toBe(true);

    expect(deriveIsPregnant([
      mkRepro("pregnancy_check", "2026-09-10", "inconclusive"),
      mkRepro("pregnancy_check", "2026-08-01", "negative"),
    ])).toBe(false);
  });

  it("returns false when kidding is the most recent definitive event", () => {
    expect(deriveIsPregnant([
      mkRepro("kidding",          "2026-09-01"),
      mkRepro("pregnancy_check",  "2026-08-01", "positive"),
    ])).toBe(false);
  });

  it("returns false when abortion is the most recent definitive event", () => {
    expect(deriveIsPregnant([
      mkRepro("abortion",         "2026-09-01"),
      mkRepro("pregnancy_check",  "2026-08-01", "positive"),
    ])).toBe(false);
  });

  it("correctly re-flags pregnant after a new positive check post-kidding", () => {
    expect(deriveIsPregnant([
      mkRepro("pregnancy_check", "2026-10-01", "positive"),
      mkRepro("kidding",         "2026-09-01"),
      mkRepro("pregnancy_check", "2026-08-01", "positive"),
    ])).toBe(true);
  });

  it("ignores non-repro events in the history array", () => {
    const history = [
      { kind: "milk_record",   id: 1, event_date: "2026-09-10" },
      { kind: "health_event",  id: 2, event_date: "2026-09-09" },
      mkRepro("pregnancy_check", "2026-09-01", "positive"),
      { kind: "weight_record", id: 3, event_date: "2026-08-01" },
    ];
    expect(deriveIsPregnant(history)).toBe(true);
  });

  it("sorts by event_date descending, not array order", () => {
    // array has oldest first; algorithm must still find the most-recent event
    expect(deriveIsPregnant([
      mkRepro("pregnancy_check", "2026-08-01", "positive"), // older
      mkRepro("kidding",         "2026-09-01"),              // newer
    ])).toBe(false);

    expect(deriveIsPregnant([
      mkRepro("kidding",         "2026-08-01"),              // older
      mkRepro("pregnancy_check", "2026-09-01", "positive"), // newer
    ])).toBe(true);
  });

  it("uses kidding (not calving) to clear pregnancy — no calving type in goat", () => {
    // 'calving' is a dairy-only type; it must have no special effect in goat
    expect(deriveIsPregnant([
      { kind: "repro_event", id: 1, event_date: "2026-09-01",
        event_type: "calving", pregnancy_result: null },
      mkRepro("pregnancy_check", "2026-08-01", "positive"),
    ])).toBe(true); // calving is unknown → skipped; positive check below it wins
  });
});
