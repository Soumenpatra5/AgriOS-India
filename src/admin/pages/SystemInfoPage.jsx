import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import AdminCard from "../components/AdminCard.jsx";
import StatGrid from "../components/StatGrid.jsx";
import { openDb as openErpDb } from "../../services/erp/erpDb.js";
import { openDb as openLivestockDb } from "../../services/livestock/livestockDb.js";
import { openDb as openMarketDb } from "../../services/marketplace/marketDb.js";
import { openDb as openSvcDb } from "../../services/svcMarketplace/svcDb.js";
import { openDb as openLogDb } from "../../services/logistics/logisticsDb.js";
import { openDb as openAiDb } from "../../services/aiCommerce/aiCommerceDb.js";
import { openDb as openAdminDb } from "../adminDb.js";

const DBS = [
  { name: "agrios-erp", open: openErpDb },
  { name: "agrios-livestock", open: openLivestockDb },
  { name: "agrios-marketplace", open: openMarketDb },
  { name: "agrios-svc-marketplace", open: openSvcDb },
  { name: "agrios-logistics", open: openLogDb },
  { name: "agrios-ai-commerce", open: openAiDb },
  { name: "agrios-admin", open: openAdminDb },
];

export default function SystemInfoPage() {
  const [dbInfo, setDbInfo] = useState([]);
  const [lsSize, setLsSize] = useState(0);

  useEffect(() => {
    let size = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      size += (key.length + (localStorage.getItem(key)?.length || 0)) * 2;
    }
    setLsSize(size);

    Promise.all(DBS.map(async (db) => {
      try {
        const idb = await db.open();
        const storeNames = Array.from(idb.objectStoreNames);
        const counts = {};
        for (const s of storeNames) {
          try {
            counts[s] = await new Promise((res, rej) => {
              const tx = idb.transaction(s, "readonly");
              const req = tx.objectStore(s).count();
              req.onsuccess = () => res(req.result);
              req.onerror = () => rej(req.error);
            });
          } catch { counts[s] = "?"; }
        }
        return { name: db.name, stores: storeNames, counts, ok: true };
      } catch {
        return { name: db.name, stores: [], counts: {}, ok: false };
      }
    })).then(setDbInfo);
  }, []);

  const fmt = (bytes) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "System Info" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>System Information</h1>

      <StatGrid stats={[
        { icon: "HardDrive", label: "IndexedDB Databases", value: DBS.length, color: "#3b82f6" },
        { icon: "Server", label: "localStorage", value: fmt(lsSize), color: "#8b5cf6" },
        { icon: "Package", label: "Total Stores", value: dbInfo.reduce((s, d) => s + d.stores.length, 0), color: T.primary },
      ]} />

      {dbInfo.map((db) => (
        <AdminCard key={db.name} title={db.name}>
          {!db.ok ? (
            <div style={{ fontSize: 12.5, color: T.inkFaint }}>Database not initialized yet</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
              {db.stores.map((s) => (
                <div key={s} style={{ padding: "8px 12px", borderRadius: 8, background: T.bg, border: `1px solid ${T.lineSoft}`, fontSize: 12.5 }}>
                  <div style={{ fontWeight: 700 }}>{s}</div>
                  <div style={{ color: T.inkSoft }}>{db.counts[s] ?? 0} records</div>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      ))}

      <AdminCard title="Environment">
        <Row label="Platform">{navigator.platform}</Row>
        <Row label="User Agent">{navigator.userAgent.slice(0, 80)}…</Row>
        <Row label="Language">{navigator.language}</Row>
        <Row label="Online">{navigator.onLine ? "Yes" : "No"}</Row>
        <Row label="App Version">v2.0.0 (Phase 9)</Row>
      </AdminCard>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12.5 }}>
      <span style={{ color: T.inkSoft, fontWeight: 600 }}>{label}</span>
      <span style={{ maxWidth: "60%", textAlign: "right", wordBreak: "break-all" }}>{children}</span>
    </div>
  );
}
