import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { repo } from "../../services/logistics/logisticsDb.js";

const statusColor = { pending: "orange", assigned: "blue", picked_up: "blue", in_transit: "blue", delivered: "green", cancelled: "red", returned: "red" };
const shipments = repo("shipments");

export default function ShipmentsPage() {
  const [data, setData] = useState([]);
  useEffect(() => { shipments.getAll().then(setData); }, []);

  const columns = [
    { header: "ID", accessor: "id", render: (r) => r.id?.slice(0, 10) || "—" },
    { header: "Origin", accessor: "origin", render: (r) => r.origin || "—" },
    { header: "Destination", accessor: "destination", render: (r) => r.destination || "—" },
    { header: "Status", accessor: "status", render: (r) => <Badge color={statusColor[r.status] || "gray"} pill>{r.status}</Badge> },
    { header: "Created", accessor: "createdAt", render: (r) => r.createdAt?.slice(0, 10) || "—" },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Shipments" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Shipments ({data.length})</h1>
      <DataTable columns={columns} data={data} />
    </div>
  );
}
