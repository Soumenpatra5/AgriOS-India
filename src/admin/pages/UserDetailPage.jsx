import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import AdminCard from "../components/AdminCard.jsx";
import Badge from "../components/Badge.jsx";
import { useRouter } from "../adminRouter.jsx";
import { sellerService } from "../../services/marketplace/sellerService.js";
import { providerService } from "../../services/svcMarketplace/providerService.js";
import { driverService } from "../../services/logistics/driverService.js";

const svc = { Seller: sellerService, Provider: providerService, Driver: driverService };

export default function UserDetailPage() {
  const { params } = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const s = svc[params.role];
    if (s && params.id) s.getById(params.id).then(setUser);
  }, [params.id, params.role]);

  if (!user) return <div style={{ padding: 40, color: T.inkSoft }}>Loading…</div>;

  const name = user.businessName || user.name || "—";

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Users", path: "/users" }, { label: name }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>{name}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <AdminCard title="Profile">
          <Row label="Role"><Badge color="blue" pill>{params.role}</Badge></Row>
          <Row label="Phone">{user.phone || "—"}</Row>
          <Row label="District">{user.district || "—"}</Row>
          <Row label="Status"><Badge color={user.verified || user.status === "active" ? "green" : "gray"}>{user.status || (user.verified ? "Verified" : "Pending")}</Badge></Row>
          <Row label="Created">{user.createdAt?.slice(0, 10) || "—"}</Row>
        </AdminCard>
        <AdminCard title="Details">
          {Object.entries(user).filter(([k]) => !["id", "createdAt", "updatedAt", "businessName", "name", "phone", "district", "status", "verified"].includes(k))
            .slice(0, 10).map(([k, v]) => (
              <Row key={k} label={k}>{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</Row>
            ))}
        </AdminCard>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 13 }}>
      <span style={{ color: T.inkSoft, fontWeight: 600 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}
