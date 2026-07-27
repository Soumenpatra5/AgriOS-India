import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { T } from "../../theme/ThemeProvider.jsx";

const SCHEMES_DATA = [
  { id: "1", name: "PM-KISAN", category: "Income Support", desc: "₹6,000/year direct income support" },
  { id: "2", name: "PM Fasal Bima Yojana", category: "Crop Insurance", desc: "Subsidized crop insurance" },
  { id: "3", name: "Kisan Credit Card", category: "Credit", desc: "Short-term credit for farmers" },
  { id: "4", name: "Soil Health Card", category: "Advisory", desc: "Soil testing and nutrient recommendations" },
  { id: "5", name: "e-NAM", category: "Market Access", desc: "National agriculture market platform" },
  { id: "6", name: "PM Krishi Sinchai Yojana", category: "Irrigation", desc: "Micro-irrigation and water use efficiency" },
  { id: "7", name: "Paramparagat Krishi Vikas", category: "Organic", desc: "Organic farming promotion" },
  { id: "8", name: "National Horticulture Mission", category: "Horticulture", desc: "Horticulture development" },
];

export default function SchemesPage() {
  const schemes = SCHEMES_DATA;

  const columns = [
    { header: "Name", accessor: "name", render: (r) => r.name || r.title || "—" },
    { header: "Category", accessor: "category", render: (r) => r.category || "—" },
    { header: "Status", render: () => <Badge color="green" pill>Active</Badge> },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Schemes" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Government Schemes ({schemes.length})</h1>
      {schemes.length > 0 ? (
        <DataTable columns={columns} data={schemes} />
      ) : (
        <div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>No schemes data available. Schemes are managed in constants/content.js.</div>
      )}
    </div>
  );
}
