import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { auditService } from "../services/auditService.js";

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { auditService.getAll().then((all) => setLogs(all.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || "")))); }, []);

  const columns = [
    { header: "Time", accessor: "timestamp", render: (r) => r.timestamp?.slice(0, 19).replace("T", " ") || "—" },
    { header: "Action", accessor: "action", render: (r) => <Badge color="blue" pill>{r.action}</Badge> },
    { header: "Entity", accessor: "entity" },
    { header: "Admin", accessor: "adminId" },
    { header: "Details", accessor: "details", render: (r) => {
      const d = r.details;
      if (!d || Object.keys(d).length === 0) return "—";
      return <span style={{ fontSize: 11.5 }}>{JSON.stringify(d).slice(0, 60)}</span>;
    }},
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Audit Log" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Audit Log ({logs.length})</h1>
      <DataTable columns={columns} data={logs} />
    </div>
  );
}
