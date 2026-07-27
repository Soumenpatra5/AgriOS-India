import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import AdminCard from "../components/AdminCard.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";
import FormSection, { FormField } from "../components/FormSection.jsx";
import { cmsService } from "../services/cmsService.js";

export default function BannersPage() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const load = () => cmsService.getAnnouncements().then(setItems);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!title.trim()) return;
    await cmsService.addAnnouncement({ title, message });
    setTitle(""); setMessage(""); setModal(false); load();
  };

  const remove = async (id) => { await cmsService.removeAnnouncement(id); load(); };

  const btnStyle = { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Manrope', sans-serif" };

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Banners" }]} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: 0 }}>Banners & Announcements ({items.length})</h1>
        <button onClick={() => setModal(true)} style={{ ...btnStyle, background: T.primary, color: "#fff" }}>+ New</button>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: T.inkSoft }}>No banners yet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {items.map((b) => (
            <AdminCard key={b.id}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{b.title}</span>
                <Badge color={b.status === "active" ? "green" : "gray"} pill>{b.status}</Badge>
              </div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 8 }}>{b.message || "—"}</div>
              <button onClick={() => remove(b.id)}
                style={{ background: T.redSoft, color: T.red, border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </AdminCard>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="New Banner">
        <FormSection>
          <FormField label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 8, border: `1.5px solid ${T.line}`, background: T.bg, color: T.ink, fontFamily: "inherit", boxSizing: "border-box" }} />
          </FormField>
          <FormField label="Message">
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 8, border: `1.5px solid ${T.line}`, background: T.bg, color: T.ink, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
          </FormField>
        </FormSection>
        <button onClick={save} style={{ ...btnStyle, background: T.primary, color: "#fff", width: "100%" }}>Create Banner</button>
      </Modal>
    </div>
  );
}
