import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { mpOrderService } from "../../services/marketplace/mpOrderService.js";
import { rupee } from "../../utils/format.js";

const statusColor = { pending: "orange", processing: "blue", packed: "blue", shipped: "blue", delivered: "green", cancelled: "red", returned: "red" };

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  useEffect(() => { mpOrderService.getAll().then(setOrders); }, []);

  const columns = [
    { header: "Order ID", accessor: "id", render: (r) => r.id?.slice(0, 10) || "—" },
    { header: "Total", accessor: "total", render: (r) => rupee(r.total || 0) },
    { header: "Status", accessor: "status", render: (r) => <Badge color={statusColor[r.status] || "gray"} pill>{r.status}</Badge> },
    { header: "Payment", accessor: "paymentMethod", render: (r) => r.paymentMethod || "—" },
    { header: "Items", accessor: "items", render: (r) => r.items?.length || 0 },
    { header: "Date", accessor: "createdAt", render: (r) => r.createdAt?.slice(0, 10) || "—" },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Orders" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Orders ({orders.length})</h1>
      <DataTable columns={columns} data={orders} />
    </div>
  );
}
