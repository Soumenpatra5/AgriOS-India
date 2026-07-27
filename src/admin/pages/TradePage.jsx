import { useState, useEffect } from "react";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import Tabs from "../components/Tabs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import { repo } from "../../services/logistics/logisticsDb.js";

const contracts = repo("contracts");
const auctions = repo("auctions");
const procurements = repo("procurements");
const exportOrders = repo("exportOrders");

const TABS = [
  { key: "contracts", label: "Contracts" },
  { key: "auctions", label: "Auctions" },
  { key: "procurement", label: "Procurement" },
  { key: "export", label: "Export" },
];

export default function TradePage() {
  const [tab, setTab] = useState("contracts");
  const [data, setData] = useState([]);

  useEffect(() => {
    const r = { contracts, auctions, procurement: procurements, export: exportOrders }[tab];
    r.getAll().then(setData);
  }, [tab]);

  const cols = {
    contracts: [
      { header: "ID", accessor: "id", render: (r) => r.id?.slice(0, 10) },
      { header: "Commodity", accessor: "commodity", render: (r) => r.commodity || "—" },
      { header: "Status", accessor: "status", render: (r) => <Badge color={r.status === "active" ? "green" : "gray"} pill>{r.status}</Badge> },
      { header: "Created", accessor: "createdAt", render: (r) => r.createdAt?.slice(0, 10) },
    ],
    auctions: [
      { header: "ID", accessor: "id", render: (r) => r.id?.slice(0, 10) },
      { header: "Type", accessor: "type" },
      { header: "Commodity", accessor: "commodity", render: (r) => r.commodity || r.title || "—" },
      { header: "Status", accessor: "status", render: (r) => <Badge color={r.status === "open" ? "green" : "gray"} pill>{r.status}</Badge> },
    ],
    procurement: [
      { header: "ID", accessor: "id", render: (r) => r.id?.slice(0, 10) },
      { header: "Type", accessor: "type" },
      { header: "Title", accessor: "title", render: (r) => r.title || "—" },
      { header: "Status", accessor: "status", render: (r) => <Badge color={r.status === "open" ? "green" : "gray"} pill>{r.status}</Badge> },
    ],
    export: [
      { header: "ID", accessor: "id", render: (r) => r.id?.slice(0, 10) },
      { header: "Commodity", accessor: "commodity", render: (r) => r.commodity || "—" },
      { header: "Destination", accessor: "destinationCountry", render: (r) => r.destinationCountry || "—" },
      { header: "Status", accessor: "status", render: (r) => <Badge color={r.status === "completed" ? "green" : "orange"} pill>{r.status}</Badge> },
    ],
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Trade" }]} />
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: "0 0 16px" }}>Trade Management</h1>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <DataTable columns={cols[tab]} data={data} />
    </div>
  );
}
