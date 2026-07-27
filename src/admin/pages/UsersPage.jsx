import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { useRouter } from "../adminRouter.jsx";
import { sellerService } from "../../services/marketplace/sellerService.js";
import { providerService } from "../../services/svcMarketplace/providerService.js";
import { driverService } from "../../services/logistics/driverService.js";

export default function UsersPage() {
  const { navigate } = useRouter();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    Promise.all([
      sellerService.getAll(),
      providerService.getAll(),
      driverService.getAll(),
    ]).then(([sellers, providers, drivers]) => {
      const all = [
        ...sellers.map((s) => ({ ...s, _role: "Seller", _name: s.businessName || s.name || "—" })),
        ...providers.map((p) => ({ ...p, _role: "Provider", _name: p.businessName || p.name || "—" })),
        ...drivers.map((d) => ({ ...d, _role: "Driver", _name: d.name || "—" })),
      ];
      setUsers(all);
    });
  }, []);

  const columns = [
    { header: "Name", accessor: "_name" },
    { header: "Role", accessor: "_role", render: (r) => <Badge color={r._role === "Seller" ? "green" : r._role === "Provider" ? "blue" : "orange"} pill>{r._role}</Badge> },
    { header: "Status", accessor: "status", render: (r) => <Badge color={r.status === "active" || r.verified ? "green" : "gray"}>{r.status || (r.verified ? "Verified" : "Pending")}</Badge> },
    { header: "Created", accessor: "createdAt", render: (r) => r.createdAt?.slice(0, 10) || "—" },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Users" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>All Users ({users.length})</h1>
      <DataTable columns={columns} data={users}
        onRowClick={(row) => navigate(`/users/detail?id=${row.id}&role=${row._role}`)} />
    </div>
  );
}
