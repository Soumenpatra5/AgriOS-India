/* Forecast confidence calculator — rates reliability by model and day index. */

export function computeConfidence(model, dayIndex) {
  if (model === "ecmwf_ifs025") {
    if (dayIndex <= 2) return "high";
    if (dayIndex <= 6) return "medium";
    return "low";
  }
  // GFS or unknown
  if (dayIndex <= 2) return "medium";
  return "low";
}

export function confidencePercent(model, dayIndex) {
  if (model === "ecmwf_ifs025") {
    if (dayIndex <= 1) return 92;
    if (dayIndex <= 3) return 82;
    if (dayIndex <= 6) return 68;
    return 50;
  }
  if (dayIndex <= 1) return 78;
  if (dayIndex <= 3) return 65;
  return 45;
}
