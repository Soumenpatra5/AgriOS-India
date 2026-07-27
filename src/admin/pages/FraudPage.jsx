import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { fraudDetection } from "../../services/aiCommerce/fraudDetection.js";

const sevColor = { high: "red", medium: "orange", low: "gray" };

export default function FraudPage() {
  const [flags, setFlags] = useState([]);

  useEffect(() => {
    fraudDetection.scan().then((result) => setFlags(result.flags || []));
  }, []);

  const columns = [
    { header: "Product", accessor: "productName", render: (r) => r.productName || r.productId?.slice(0, 10) || "—" },
    { header: "Rule", accessor: "rule" },
    { header: "Severity", accessor: "severity", render: (r) => <Badge color={sevColor[r.severity] || "gray"} pill>{r.severity}</Badge> },
    { header: "Reason", accessor: "reason", render: (r) => <span style={{ fontSize: 12 }}>{r.reason}</span> },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Fraud Detection" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Fraud Flags ({flags.length})</h1>
      <DataTable columns={columns} data={flags} searchable={false} />
    </div>
  );
}
