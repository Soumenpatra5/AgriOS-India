import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { providerService } from "../../services/svcMarketplace/providerService.js";

export default function ProvidersPage() {
  const [providers, setProviders] = useState([]);
  useEffect(() => { providerService.getAll().then(setProviders); }, []);

  const columns = [
    { header: "Name", accessor: "businessName", render: (r) => r.businessName || r.name || "—" },
    { header: "Category", accessor: "category", render: (r) => r.category || "—" },
    { header: "District", accessor: "district", render: (r) => r.district || "—" },
    { header: "Verified", accessor: "verified", render: (r) => <Badge color={r.verified ? "green" : "gray"}>{r.verified ? "Yes" : "No"}</Badge> },
    { header: "Rating", accessor: "avgRating", render: (r) => r.avgRating ? `${r.avgRating.toFixed(1)} ★` : "—" },
    { header: "Created", accessor: "createdAt", render: (r) => r.createdAt?.slice(0, 10) || "—" },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Providers" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Service Providers ({providers.length})</h1>
      <DataTable columns={columns} data={providers} />
    </div>
  );
}
