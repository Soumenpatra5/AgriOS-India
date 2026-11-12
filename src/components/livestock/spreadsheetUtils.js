/**
 * Pure spreadsheet calculation and CSV formatting utilities for livestock & aquaculture.
 * Dependency-free and browser/node safe.
 */

/**
 * buildCSVContent — converts headers and rows to a properly escaped CSV string.
 */
export function buildCSVContent(headers = [], rows = []) {
  const escapeCell = (val) => {
    if (val == null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const headerLine = headers.map(escapeCell).join(",");
  const rowLines = rows.map((r) => r.map(escapeCell).join(","));
  return [headerLine, ...rowLines].join("\r\n");
}

/**
 * triggerCSVDownload — triggers a client-side download of a CSV file.
 */
export function triggerCSVDownload(filename, headers, rows) {
  if (typeof window === "undefined" || !window.Blob) return;
  const csv = buildCSVContent(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * filterHerdRecords — searches animals by name, breed, or tagNo.
 */
export function filterHerdRecords(animals = [], query = "") {
  if (!query || !query.trim()) return animals;
  const q = query.trim().toLowerCase();
  return animals.filter((a) => {
    const name = (a.name || "").toLowerCase();
    const breed = (a.breed || "").toLowerCase();
    const tag = (a.tagNo || a.tag_no || "").toLowerCase();
    return name.includes(q) || breed.includes(q) || tag.includes(q);
  });
}

/**
 * calculateHerdSummary — returns counts and breakdown metrics.
 */
export function calculateHerdSummary(animals = []) {
  const total = animals.length;
  const female = animals.filter((a) => a.gender === "female").length;
  const male = animals.filter((a) => a.gender === "male").length;
  return { total, female, male };
}

/**
 * calculatePondSummary — returns summary of aquaculture ponds.
 */
export function calculatePondSummary(ponds = []) {
  const count = ponds.length;
  const totalAcres = ponds.reduce((sum, p) => sum + (Number(p.sizeAcres) || 0), 0);
  const totalStocked = ponds.reduce((sum, p) => sum + (Number(p.stockingCount) || 0), 0);
  return { count, totalAcres: Math.round(totalAcres * 10) / 10, totalStocked };
}
