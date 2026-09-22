import { useEffect, useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, EmptyState } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { datasetRegistry, DATASET_CATEGORIES } from "../../services/mlops/datasets/datasetRegistry.js";

function QualityDot({ score }) {
  const color = score >= 70 ? "var(--ag-primary)" : score >= 40 ? "var(--ag-orange)" : "var(--ag-red)";
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color, background: color + "18",
      borderRadius: 99, padding: "2px 8px" }}>
      {score ?? "—"}
    </span>
  );
}

export default function DatasetBrowser() {
  const { pop, push, tc } = useApp();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newDs, setNewDs] = useState({ name: "", category: DATASET_CATEGORIES[0], description: "" });

  const load = () => {
    setLoading(true);
    datasetRegistry.getAll()
      .then(setDatasets)
      .catch(() => setDatasets([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = datasets.filter((d) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || d.name.toLowerCase().includes(q) || d.category.includes(q);
    const matchesCat = catFilter === "all" || d.category === catFilter;
    return matchesSearch && matchesCat;
  });

  const createDataset = async () => {
    if (!newDs.name.trim()) return;
    await datasetRegistry.register(newDs);
    setShowCreate(false);
    setNewDs({ name: "", category: DATASET_CATEGORIES[0], description: "" });
    load();
  };

  return (
    <>
      <AppBar title={tc({en:"Dataset Browser",hi:"डेटासेट ब्राउज़र",bn:"ডেটাসেট ব্রাউজার"})} onBack={pop}
        action={<button onClick={() => setShowCreate(true)} style={{ background: "none", border: "none",
          cursor: "pointer", color: "var(--ag-primary)" }}><Icon name="Plus" size={22} /></button>} />

      <div style={{ padding: "12px 16px 32px", animation: "ag-fade .22s var(--ag-ease)" }}>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Icon name="Search" size={15} color={T.inkSoft} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tc({en:"Search datasets…",hi:"डेटासेट खोजें…",bn:"ডেটাসেট খুঁজুন…"})}
            style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: T.rMd, border: `1px solid ${T.line}`,
              background: T.surface, color: T.ink, fontSize: 14, fontFamily: T.body, boxSizing: "border-box" }} />
        </div>

        {/* Category chips */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 14, scrollbarWidth: "none" }}>
          {["all", ...DATASET_CATEGORIES].map((cat) => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 99, fontSize: 11,
                cursor: "pointer", fontFamily: T.body,
                border: `1.5px solid ${catFilter === cat ? "var(--ag-primary)" : T.line}`,
                background: catFilter === cat ? "var(--ag-primary-soft)" : T.surface,
                color: catFilter === cat ? "var(--ag-primary)" : T.inkSoft, fontWeight: catFilter === cat ? 600 : 400 }}>
              {cat.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{ background: T.surface, borderRadius: T.rLg, border: `1px solid ${T.line}`,
            padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 12 }}>{tc({en:"Register Dataset",hi:"डेटासेट रजिस्टर करें",bn:"ডেটাসেট নিবন্ধন করুন"})}</div>
            <input value={newDs.name} onChange={(e) => setNewDs({ ...newDs, name: e.target.value })}
              placeholder={tc({en:"Dataset name",hi:"डेटासेट का नाम",bn:"ডেটাসেটের নাম"})}
              style={{ width: "100%", padding: "9px 12px", borderRadius: T.rMd, border: `1px solid ${T.line}`,
                background: T.bg, color: T.ink, fontSize: 14, fontFamily: T.body, marginBottom: 8, boxSizing: "border-box" }} />
            <select value={newDs.category} onChange={(e) => setNewDs({ ...newDs, category: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: T.rMd, border: `1px solid ${T.line}`,
                background: T.bg, color: T.ink, fontSize: 14, fontFamily: T.body, marginBottom: 8 }}>
              {DATASET_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
            <input value={newDs.description} onChange={(e) => setNewDs({ ...newDs, description: e.target.value })}
              placeholder={tc({en:"Description (optional)",hi:"विवरण (वैकल्पिक)",bn:"বিবরণ (ঐচ্ছিক)"})}
              style={{ width: "100%", padding: "9px 12px", borderRadius: T.rMd, border: `1px solid ${T.line}`,
                background: T.bg, color: T.ink, fontSize: 14, fontFamily: T.body, marginBottom: 12, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={createDataset}
                style={{ flex: 1, padding: "10px", borderRadius: T.rMd, border: "none",
                  background: "var(--ag-primary)", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: T.body }}>
                {tc({en:"Register",hi:"रजिस्टर करें",bn:"নিবন্ধন করুন"})}
              </button>
              <button onClick={() => setShowCreate(false)}
                style={{ padding: "10px 16px", borderRadius: T.rMd, border: `1px solid ${T.line}`,
                  background: T.surface, color: T.ink, cursor: "pointer", fontFamily: T.body }}>
                {tc({en:"Cancel",hi:"रद्द करें",bn:"বাতিল করুন"})}
              </button>
            </div>
          </div>
        )}

        {/* Stats row */}
        {!loading && (
          <div style={{ fontSize: 12, color: T.inkFaint, marginBottom: 12 }}>
            {tc({en:`${filtered.length} of ${datasets.length} datasets`,hi:`${datasets.length} में से ${filtered.length} डेटासेट`,bn:`${datasets.length}-এর মধ্যে ${filtered.length} ডেটাসেট`})}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: T.inkSoft }}>
            <Icon name="RefreshCw" size={24} style={{ animation: "ag-blink 1.2s infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="Database" title={tc({en:"No datasets yet",hi:"अभी तक कोई डेटासेट नहीं",bn:"এখনও কোনো ডেটাসেট নেই"})}
            body={tc({en:"Register your first dataset to start building the MLOps pipeline.",hi:"MLOps पाइपलाइन बनाना शुरू करने के लिए अपना पहला डेटासेट रजिस्टर करें।",bn:"MLOps পাইপলাইন তৈরি শুরু করতে আপনার প্রথম ডেটাসেট নিবন্ধন করুন।"})} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((ds) => (
              <button key={ds.id} onClick={() => push({ kind: "datasetDetail", props: { datasetId: ds.id } })}
                style={{ textAlign: "left", background: T.surface, borderRadius: T.rLg,
                  border: `1px solid ${T.line}`, padding: "14px 16px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: T.rMd, background: "var(--ag-primary-soft)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="Database" size={18} color="var(--ag-primary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{ds.name}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft }}>{ds.category.replace(/_/g, " ")} · v{ds.version}</div>
                  <div style={{ fontSize: 11, color: T.inkFaint }}>{tc({en:`${ds.imageCount} images · ${ds.annotationCount} annotations`,hi:`${ds.imageCount} इमेज · ${ds.annotationCount} एनोटेशन`,bn:`${ds.imageCount} ছবি · ${ds.annotationCount} অ্যানোটেশন`})}</div>
                </div>
                <QualityDot score={ds.qualityScore} />
                <Icon name="ChevronRight" size={16} color={T.inkFaint} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
