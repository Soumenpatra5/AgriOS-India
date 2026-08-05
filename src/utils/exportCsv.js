export function downloadCsv(rows, filename) {
  if (!rows.length) return false;
  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows.map((r) =>
    keys.map((k) => {
      const v = r[k] == null ? "" : String(r[k]);
      return v.includes(",") || v.includes('"') || v.includes("\n")
        ? '"' + v.replace(/"/g, '""') + '"'
        : v;
    }).join(",")
  ).join("\n");

  const blob = new Blob(["﻿" + header + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
