import { useState, useMemo } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import Pagination from "./Pagination.jsx";

export default function DataTable({ columns, data = [], pageSize = 10, onRowClick, searchable = true, emptyLabel = "No data" }) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const v = col.accessor ? row[col.accessor] : col.render?.(row);
        return String(v ?? "").toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const col = columns.find((c) => c.accessor === sortCol);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (acc) => {
    if (!acc) return;
    if (sortCol === acc) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(acc); setSortDir("asc"); }
  };

  const thStyle = { padding: "10px 14px", textAlign: "left", fontSize: 11.5, fontWeight: 700, color: T.inkSoft,
    textTransform: "uppercase", letterSpacing: .3, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
    borderBottom: `2px solid ${T.line}`, background: T.surface2 };
  const tdStyle = { padding: "11px 14px", fontSize: 13.5, borderBottom: `1px solid ${T.lineSoft}` };

  return (
    <div>
      {searchable && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ position: "relative", maxWidth: 320 }}>
            <Icon name="Search" size={16} style={{ position: "absolute", left: 12, top: 11, color: T.inkFaint }} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search…"
              style={{ width: "100%", padding: "10px 12px 10px 36px", fontSize: 13, borderRadius: 9, border: `1.5px solid ${T.line}`,
                background: T.surface, color: T.ink, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
          </div>
        </div>
      )}
      <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${T.line}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.accessor || col.header} style={thStyle} onClick={() => toggleSort(col.accessor)}>
                  {col.header}
                  {sortCol === col.accessor && <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ ...tdStyle, textAlign: "center", color: T.inkFaint, padding: 32 }}>{emptyLabel}</td></tr>
            ) : paged.map((row, i) => (
              <tr key={row.id || i} onClick={() => onRowClick?.(row)}
                style={{ cursor: onRowClick ? "pointer" : "default", background: i % 2 === 0 ? T.surface : T.bg, transition: "background .1s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = T.primarySoft}
                onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? T.surface : T.bg}>
                {columns.map((col) => (
                  <td key={col.accessor || col.header} style={tdStyle}>
                    {col.render ? col.render(row) : row[col.accessor] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ marginTop: 12 }}>
          <Pagination page={safePage} total={totalPages} onChange={setPage} count={sorted.length} />
        </div>
      )}
    </div>
  );
}
