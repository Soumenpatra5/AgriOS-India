import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { warehouseService } from "../../services/logistics/warehouseService.js";

export default function WarehousesPage() {
  const [data, setData] = useState([]);
  useEffect(() => { warehouseService.getAll().then(setData); }, []);

  const columns = [
    { header: "Name", accessor: "name" },
    { header: "Type", accessor: "type", render: (r) => r.type || "—" },
    { header: "District", accessor: "district", render: (r) => r.district || "—" },
    { header: "Capacity", accessor: "capacity", render: (r) => r.capacity ? `${r.capacity} MT` : "—" },
    { header: "Cold", accessor: "cold", render: (r) => <Badge color={r.cold ? "blue" : "gray"}>{r.cold ? "Yes" : "No"}</Badge> },
    { header: "Status", accessor: "status", render: (r) => <Badge color={r.status === "active" ? "green" : "gray"}>{r.status || "active"}</Badge> },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Warehouses" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Warehouses ({data.length})</h1>
      <DataTable columns={columns} data={data} />
    </div>
  );
}
