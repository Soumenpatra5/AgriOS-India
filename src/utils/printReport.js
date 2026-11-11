/**
 * AgriOS India — Printable Report Utility
 * Generates a clean, professional print/PDF-ready layout for browser print.
 */

const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

export function generateReportHtml({
  title = "AgriOS India Report",
  subtitle = "",
  columns = [],
  rows = [],
  summary = [],
  generatedAt = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
}) {
  const summaryHtml = summary && summary.length > 0 ? `
    <div class="summary-cards">
      ${summary.map((s) => `
        <div class="summary-card">
          <div class="summary-label">${esc(s.label)}</div>
          <div class="summary-value">${esc(s.value)}</div>
        </div>
      `).join("")}
    </div>
  ` : "";

  const tableHeadersHtml = columns.map((col) => `
    <th style="text-align: ${col.align || "left"}">${esc(col.header || col.key)}</th>
  `).join("");

  const tableRowsHtml = rows.map((row) => `
    <tr>
      ${columns.map((col) => `
        <td style="text-align: ${col.align || "left"}">${esc(row[col.key] ?? "—")}</td>
      `).join("")}
    </tr>
  `).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #12211A; margin: 0; font-size: 12px; line-height: 1.5; }
    header { border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 18px; font-weight: 800; color: #16a34a; letter-spacing: -0.5px; }
    .brand span { color: #12211A; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #12211A; }
    .subtitle { font-size: 13px; color: #475569; margin: 0; }
    .meta { font-size: 11px; color: #64748b; text-align: right; }
    
    .summary-cards { display: flex; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
    .summary-card { flex: 1; min-width: 120px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .summary-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-value { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px; }

    table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; }
    th { background: #f1f5f9; font-weight: 700; color: #334155; }
    tr:nth-child(even) td { background: #fafafa; }

    footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 10.5px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="brand">Agri<span>OS</span> India</div>
      <h1>${esc(title)}</h1>
      ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ""}
    </div>
    <div class="meta">
      <div><strong>Date:</strong> ${esc(generatedAt)}</div>
      <div>Official Operational Record</div>
    </div>
  </header>

  ${summaryHtml}

  <table>
    <thead>
      <tr>${tableHeadersHtml}</tr>
    </thead>
    <tbody>
      ${tableRowsHtml || '<tr><td colspan="' + columns.length + '" style="text-align: center; color: #94a3b8; padding: 24px;">No records found</td></tr>'}
    </tbody>
  </table>

  <footer>
    <div>AgriOS India · Digital Agriculture Operating System</div>
    <div>Confidential &amp; Verified Farm Record</div>
  </footer>
</body>
</html>`;
}

/**
 * Triggers a browser print preview for the given report data.
 * Returns boolean indicating whether print window was successfully opened.
 */
export function printReport(options) {
  if (typeof window === "undefined") return false;
  const html = generateReportHtml(options);
  const win = window.open("", "_blank");
  if (!win) return false;

  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    return true;
  } catch {
    return false;
  }
}
