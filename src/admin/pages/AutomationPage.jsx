import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { commerceAutomation } from "../../services/aiCommerce/commerceAutomation.js";

export default function AutomationPage() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    commerceAutomation.list().then(setAlerts);
  }, []);

  const columns = [
    { header: "Type", accessor: "type", render: (r) => <Badge color="blue" pill>{r.type}</Badge> },
    { header: "Title", accessor: "title" },
    { header: "Message", accessor: "message", render: (r) => <span style={{ fontSize: 12 }}>{r.message?.slice(0, 80)}</span> },
    { header: "Read", accessor: "read", render: (r) => r.read ? "Yes" : "No" },
    { header: "Created", accessor: "createdAt", render: (r) => r.createdAt?.slice(0, 10) || "—" },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "AI Automation" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>AI Alerts ({alerts.length})</h1>
      <DataTable columns={columns} data={alerts} searchable={false} />
    </div>
  );
}
