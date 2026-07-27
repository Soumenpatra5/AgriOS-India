import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";
import FormSection, { FormField } from "../components/FormSection.jsx";
import { cmsService } from "../services/cmsService.js";

export default function ArticlesPage() {
  const [articles, setArticles] = useState([]);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");

  const load = () => cmsService.getArticles().then(setArticles);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!title.trim()) return;
    await cmsService.addArticle({ title, body, category, status: "published" });
    setTitle(""); setBody(""); setModal(false); load();
  };

  const remove = async (id) => { await cmsService.removeArticle(id); load(); };

  const columns = [
    { header: "Title", accessor: "title" },
    { header: "Category", accessor: "category" },
    { header: "Status", accessor: "status", render: (r) => <Badge color={r.status === "published" ? "green" : "gray"} pill>{r.status}</Badge> },
    { header: "Created", accessor: "createdAt", render: (r) => r.createdAt?.slice(0, 10) || "—" },
    { header: "Action", render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); remove(r.id); }}
        style={{ background: T.redSoft, color: T.red, border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Delete</button>
    )},
  ];

  const btnStyle = { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Manrope', sans-serif" };

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", path: "/" }, { label: "Articles" }]} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', sans-serif", margin: 0 }}>Articles ({articles.length})</h1>
        <button onClick={() => setModal(true)} style={{ ...btnStyle, background: T.primary, color: "#fff" }}>+ New Article</button>
      </div>
      <DataTable columns={columns} data={articles} />

      <Modal open={modal} onClose={() => setModal(false)} title="New Article">
        <FormSection>
          <FormField label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 8, border: `1.5px solid ${T.line}`, background: T.bg, color: T.ink, fontFamily: "inherit", boxSizing: "border-box" }} />
          </FormField>
          <FormField label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 8, border: `1.5px solid ${T.line}`, background: T.bg, color: T.ink, fontFamily: "inherit" }}>
              <option value="general">General</option>
              <option value="farming">Farming Tips</option>
              <option value="market">Market Updates</option>
              <option value="schemes">Government Schemes</option>
            </select>
          </FormField>
          <FormField label="Body">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 8, border: `1.5px solid ${T.line}`, background: T.bg, color: T.ink, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
          </FormField>
        </FormSection>
        <button onClick={save} style={{ ...btnStyle, background: T.primary, color: "#fff", width: "100%" }}>Publish Article</button>
      </Modal>
    </div>
  );
}
