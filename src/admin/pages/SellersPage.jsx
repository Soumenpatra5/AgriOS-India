import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { sellerService } from "../../services/marketplace/sellerService.js";

export default function SellersPage() {
  const [sellers, setSellers] = useState([]);
  useEffect(() => { sellerService.getAll().then(setSellers); }, []);

  const columns = [
    { header: "Business Name", accessor: "businessName" },
    { header: "Type", accessor: "type", render: (r) => r.type || "—" },
    { header: "District", accessor: "district", render: (r) => r.district || "—" },
    { header: "Verified", accessor: "verified", render: (r) => <Badge color={r.verified ? "green" : "gray"}>{r.verified ? "Yes" : "No"}</Badge> },
    { header: "Rating", accessor: "avgRating", render: (r) => r.avgRating ? `${r.avgRating.toFixed(1)} ★` : "—" },
    { header: "Created", accessor: "createdAt", render: (r) => r.createdAt?.slice(0, 10) || "—" },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Sellers" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Sellers ({sellers.length})</h1>
      <DataTable columns={columns} data={sellers} />
    </div>
  );
}
