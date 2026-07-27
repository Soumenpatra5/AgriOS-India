import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { productService } from "../../services/marketplace/productService.js";
import { rupee } from "../../utils/format.js";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  useEffect(() => { productService.getAll().then(setProducts); }, []);

  const columns = [
    { header: "Name", accessor: "name" },
    { header: "Category", accessor: "category" },
    { header: "Price", accessor: "price", render: (r) => `${rupee(r.price)}/${r.unit || "kg"}` },
    { header: "Stock", accessor: "stock", render: (r) => r.stock ?? "—" },
    { header: "Status", accessor: "status", render: (r) => <Badge color={r.status === "active" ? "green" : r.status === "draft" ? "gray" : "orange"}>{r.status || "active"}</Badge> },
    { header: "Rating", accessor: "avgRating", render: (r) => r.avgRating ? `${r.avgRating.toFixed(1)} ★` : "—" },
    { header: "Created", accessor: "createdAt", render: (r) => r.createdAt?.slice(0, 10) || "—" },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Products" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Products ({products.length})</h1>
      <DataTable columns={columns} data={products} />
    </div>
  );
}
