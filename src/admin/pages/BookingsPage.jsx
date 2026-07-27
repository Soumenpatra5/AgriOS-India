import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { bookingService } from "../../services/svcMarketplace/bookingService.js";
import { rupee } from "../../utils/format.js";

const statusColor = { pending: "orange", confirmed: "blue", in_progress: "blue", completed: "green", cancelled: "red" };

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  useEffect(() => { bookingService.getAll().then(setBookings); }, []);

  const columns = [
    { header: "ID", accessor: "id", render: (r) => r.id?.slice(0, 10) || "—" },
    { header: "Service", accessor: "serviceName", render: (r) => r.serviceName || "—" },
    { header: "Date", accessor: "date", render: (r) => r.date || r.createdAt?.slice(0, 10) || "—" },
    { header: "Amount", accessor: "amount", render: (r) => r.amount ? rupee(r.amount) : "—" },
    { header: "Status", accessor: "status", render: (r) => <Badge color={statusColor[r.status] || "gray"} pill>{r.status}</Badge> },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Bookings" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Bookings ({bookings.length})</h1>
      <DataTable columns={columns} data={bookings} />
    </div>
  );
}
