import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";
import FormSection, { FormField } from "../components/FormSection.jsx";
import { ticketService } from "../services/ticketService.js";

const statusColor = { open: "orange", in_progress: "blue", resolved: "green", closed: "gray" };
const prioColor = { low: "gray", medium: "orange", high: "red", urgent: "red" };

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [modal, setModal] = useState(false);
  const [subject, setSubject] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("medium");

  const load = () => ticketService.getAll().then(setTickets);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!subject.trim()) return;
    await ticketService.create({ subject, description: desc, priority });
    setSubject(""); setDesc(""); setModal(false); load();
  };

  const columns = [
    { header: "Subject", accessor: "subject" },
    { header: "Priority", accessor: "priority", render: (r) => <Badge color={prioColor[r.priority] || "gray"} pill>{r.priority}</Badge> },
    { header: "Status", accessor: "status", render: (r) => <Badge color={statusColor[r.status] || "gray"} pill>{r.status}</Badge> },
    { header: "Created", accessor: "createdAt", render: (r) => r.createdAt?.slice(0, 10) || "—" },
    { header: "Action", render: (r) => r.status === "open" ? (
      <button onClick={(e) => { e.stopPropagation(); ticketService.resolve(r.id).then(load); }}
        style={{ background: T.primarySoft, color: T.primary, border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Resolve</button>
    ) : null },
  ];

  const btnStyle = { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Manrope', sans-serif" };

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Support Tickets" }]} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: 0 }}>Support Tickets ({tickets.length})</h1>
        <button onClick={() => setModal(true)} style={{ ...btnStyle, background: T.primary, color: "#fff" }}>+ New Ticket</button>
      </div>
      <DataTable columns={columns} data={tickets} />

      <Modal open={modal} onClose={() => setModal(false)} title="New Support Ticket">
        <FormSection>
          <FormField label="Subject">
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 8, border: `1.5px solid ${T.line}`, background: T.bg, color: T.ink, fontFamily: "inherit", boxSizing: "border-box" }} />
          </FormField>
          <FormField label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 8, border: `1.5px solid ${T.line}`, background: T.bg, color: T.ink, fontFamily: "inherit" }}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </FormField>
          <FormField label="Description">
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 8, border: `1.5px solid ${T.line}`, background: T.bg, color: T.ink, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
          </FormField>
        </FormSection>
        <button onClick={save} style={{ ...btnStyle, background: T.primary, color: "#fff", width: "100%" }}>Create Ticket</button>
      </Modal>
    </div>
  );
}
