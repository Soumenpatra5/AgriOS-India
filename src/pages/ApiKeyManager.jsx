import { useState, useEffect, useCallback } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card, BottomSheet, Dialog, Spinner, EmptyState } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { keyManager } from "../ai/keyManager.js";
import { listProviders } from "../ai/providers/providerRegistry.js";

const S = {
  page: { padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 16, animation: "ag-fade .25s var(--ag-ease)" },
  section: { fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8, padding: "0 2px" },
  row: (active) => ({
    display: "flex", alignItems: "center", gap: 12, padding: "14px 14px",
    borderRadius: T.rLg, background: active ? T.primarySoft : T.surface,
    border: `1.5px solid ${active ? T.primary : T.line}`, cursor: "pointer",
    transition: "all .18s var(--ag-ease)", position: "relative",
  }),
  badge: { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: T.primary, color: "#fff" },
  badgeInactive: { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: T.line, color: T.inkSoft },
  dot: (color) => ({ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }),
  meta: { fontSize: 11.5, color: T.inkSoft },
  btn: (bg, color) => ({
    padding: "10px 18px", borderRadius: T.rMd, border: "none", cursor: "pointer",
    fontFamily: T.body, fontSize: 13, fontWeight: 600, background: bg, color,
  }),
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: T.inkSoft },
  input: {
    width: "100%", padding: "12px 14px", borderRadius: T.rMd, border: `1.5px solid ${T.line}`,
    background: T.surface, color: T.ink, fontSize: 14, fontFamily: T.body, outline: "none",
    boxSizing: "border-box",
  },
  select: {
    width: "100%", padding: "12px 14px", borderRadius: T.rMd, border: `1.5px solid ${T.line}`,
    background: T.surface, color: T.ink, fontSize: 14, fontFamily: T.body, outline: "none",
    boxSizing: "border-box", appearance: "none",
  },
  label: { fontSize: 12.5, fontWeight: 600, color: T.inkSoft, marginBottom: 5, display: "block" },
  healthCard: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" },
};

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function maskKey(key) {
  if (!key || key.length < 8) return "••••••••";
  return key.slice(0, 5) + "•".repeat(Math.max(key.length - 9, 4)) + key.slice(-4);
}

export default function ApiKeyManager() {
  const { pop, tc, toast } = useApp();
  const [keys, setKeys] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [health, setHealth] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [editKey, setEditKey] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search, setSearch] = useState("");
  const [visibleKeys, setVisibleKeys] = useState(new Set());
  const [showHealth, setShowHealth] = useState(null);

  const reload = useCallback(() => {
    setKeys(keyManager.listKeys());
    setActiveId(keyManager.getActiveKeyId());
    setHealth(keyManager.getAllHealth());
  }, []);

  useEffect(() => {
    reload();
    return keyManager.subscribe(reload);
  }, [reload]);

  const filtered = keys.filter((k) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return k.name.toLowerCase().includes(q) || k.provider.toLowerCase().includes(q) || (k.notes || "").toLowerCase().includes(q);
  });

  const handleSetActive = (id) => {
    keyManager.setActiveKey(id);
    toast(tc({ en: "Active key updated", hi: "सक्रिय कुंजी अपडेट हुई", bn: "সক্রিয় কী আপডেট হয়েছে" }), "success");
  };

  const handleDelete = (id) => {
    keyManager.deleteKey(id);
    setDeleteConfirm(null);
    toast(tc({ en: "Key deleted", hi: "कुंजी हटाई गई", bn: "কী মুছে ফেলা হয়েছে" }), "success");
  };

  const handleCopy = (key) => {
    navigator.clipboard?.writeText(key).then(
      () => toast(tc({ en: "Copied to clipboard", hi: "क्लिपबोर्ड पर कॉपी किया गया", bn: "ক্লিপবোর্ডে কপি হয়েছে" }), "success"),
      () => toast(tc({ en: "Copy failed", hi: "कॉपी विफल", bn: "কপি ব্যর্থ" }), "error"),
    );
  };

  const toggleVisible = (id) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <>
      <AppBar title={tc({ en: "API Key Manager", hi: "API कुंजी प्रबंधक", bn: "API কী ম্যানেজার" })} onBack={pop} />
      <div style={S.page}>
        {/* Active key banner */}
        {keys.length > 0 && (
          <Card pad={14}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: T.primarySoft, display: "grid", placeItems: "center" }}>
                <Icon name="Key" size={20} style={{ color: T.primary }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                  {tc({ en: "Active Key", hi: "सक्रिय कुंजी", bn: "সক্রিয় কী" })}
                </div>
                <div style={S.meta}>
                  {keys.find((k) => k.id === activeId)?.name || tc({ en: "None selected", hi: "कोई चयनित नहीं", bn: "কিছু নির্বাচিত নেই" })}
                </div>
              </div>
              <div style={S.dot(activeId ? "#22c55e" : "#ef4444")} />
              <span style={{ fontSize: 11, color: activeId ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                {activeId ? tc({ en: "Connected", hi: "जुड़ा", bn: "সংযুক্ত" }) : tc({ en: "No Key", hi: "कोई कुंजी नहीं", bn: "কোনো কী নেই" })}
              </span>
            </div>
          </Card>
        )}

        {/* Search + Add */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Icon name="Search" size={16} style={{ position: "absolute", left: 12, top: 12, color: T.inkFaint }} />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={tc({ en: "Search keys...", hi: "कुंजी खोजें...", bn: "কী অনুসন্ধান..." })}
              style={{ ...S.input, paddingLeft: 36 }}
            />
          </div>
          <button onClick={() => setShowAdd(true)} style={{ ...S.btn(T.primary, "#fff"), display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <Icon name="Plus" size={16} /> {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
          </button>
        </div>

        {/* Key list */}
        <div>
          <div style={S.section}>{tc({ en: "API Keys", hi: "API कुंजियाँ", bn: "API কী সমূহ" })} ({filtered.length})</div>
          {filtered.length === 0 && (
            <EmptyState
              icon="KeyRound"
              title={tc({ en: "No API keys yet", hi: "अभी कोई API कुंजी नहीं", bn: "এখনও কোনো API কী নেই" })}
              subtitle={tc({ en: "Add your first key to get started", hi: "शुरू करने के लिए अपनी पहली कुंजी जोड़ें", bn: "শুরু করতে আপনার প্রথম কী যোগ করুন" })}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((k) => {
              const isActive = k.id === activeId;
              const h = health[k.id] || {};
              const visible = visibleKeys.has(k.id);
              return (
                <div key={k.id} style={S.row(isActive)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{k.name}</span>
                      <span style={isActive ? S.badge : S.badgeInactive}>
                        {isActive
                          ? tc({ en: "Active", hi: "सक्रिय", bn: "সক্রিয়" })
                          : k.status === "active"
                            ? tc({ en: "Ready", hi: "तैयार", bn: "প্রস্তুত" })
                            : tc({ en: "Inactive", hi: "निष्क्रिय", bn: "নিষ্ক্রিয়" })}
                      </span>
                      <span style={{ fontSize: 11, color: T.inkFaint, textTransform: "capitalize" }}>{k.provider}</span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: T.inkSoft, marginBottom: 4 }}>
                      {visible ? k.key : maskKey(k.key)}
                    </div>
                    <div style={S.meta}>
                      {tc({ en: "Added", hi: "जोड़ा गया", bn: "যোগ হয়েছে" })}: {formatDate(k.dateAdded)}
                      {k.lastUsed && <> · {tc({ en: "Last used", hi: "अंतिम उपयोग", bn: "শেষ ব্যবহার" })}: {formatDate(k.lastUsed)}</>}
                    </div>
                    {k.notes && <div style={{ ...S.meta, marginTop: 2, fontStyle: "italic" }}>{k.notes}</div>}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    {!isActive && (
                      <button onClick={() => handleSetActive(k.id)} title="Set Active"
                        style={{ ...S.iconBtn, color: T.primary }}>
                        <Icon name="CheckCircle" size={18} />
                      </button>
                    )}
                    <button onClick={() => toggleVisible(k.id)} title="Show/Hide" style={S.iconBtn}>
                      <Icon name={visible ? "EyeOff" : "Eye"} size={16} />
                    </button>
                    <button onClick={() => handleCopy(k.key)} title="Copy" style={S.iconBtn}>
                      <Icon name="Copy" size={16} />
                    </button>
                    <button onClick={() => setShowHealth(k)} title="Health" style={S.iconBtn}>
                      <Icon name="Activity" size={16} />
                    </button>
                    <button onClick={() => setEditKey(k)} title="Edit" style={S.iconBtn}>
                      <Icon name="Pencil" size={16} />
                    </button>
                    <button onClick={() => setDeleteConfirm(k)} title="Delete"
                      style={{ ...S.iconBtn, color: "#ef4444" }}>
                      <Icon name="Trash2" size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Provider info */}
        <div>
          <div style={S.section}>{tc({ en: "Supported Providers", hi: "समर्थित प्रदाता", bn: "সমর্থিত প্রোভাইডার" })}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {listProviders().map((p) => (
              <div key={p.id} style={{ padding: "10px 12px", borderRadius: T.rMd, background: T.surface, border: `1px solid ${T.line}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{p.name}</div>
                <div style={{ fontSize: 11, color: T.inkSoft }}>{p.models.length} {tc({ en: "models", hi: "मॉडल", bn: "মডেল" })}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Key Sheet */}
      <BottomSheet open={showAdd} onClose={() => setShowAdd(false)}
        title={tc({ en: "Add API Key", hi: "API कुंजी जोड़ें", bn: "API কী যোগ করুন" })}>
        <KeyForm onSave={(data) => { keyManager.addKey(data); setShowAdd(false); toast(tc({ en: "Key added", hi: "कुंजी जोड़ी गई", bn: "কী যোগ হয়েছে" }), "success"); }} tc={tc} />
      </BottomSheet>

      {/* Edit Key Sheet */}
      <BottomSheet open={!!editKey} onClose={() => setEditKey(null)}
        title={tc({ en: "Edit API Key", hi: "API कुंजी संपादित करें", bn: "API কী সম্পাদনা করুন" })}>
        {editKey && (
          <KeyForm
            initial={editKey}
            onSave={(data) => { keyManager.updateKey(editKey.id, data); setEditKey(null); toast(tc({ en: "Key updated", hi: "कुंजी अपडेट हुई", bn: "কী আপডেট হয়েছে" }), "success"); }}
            tc={tc}
          />
        )}
      </BottomSheet>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <div style={{ padding: 20, textAlign: "center" }}>
          <Icon name="AlertTriangle" size={40} style={{ color: "#ef4444", marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 8 }}>
            {tc({ en: "Delete this key?", hi: "यह कुंजी हटाएँ?", bn: "এই কী মুছবেন?" })}
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 20 }}>
            {deleteConfirm?.name} — {tc({ en: "This action cannot be undone.", hi: "यह कार्य पूर्ववत नहीं किया जा सकता।", bn: "এই ক্রিয়া পূর্বাবস্থায় ফেরানো যাবে না।" })}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => setDeleteConfirm(null)} style={S.btn(T.surface, T.ink)}>
              {tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" })}
            </button>
            <button onClick={() => handleDelete(deleteConfirm.id)} style={S.btn("#ef4444", "#fff")}>
              {tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Health detail sheet */}
      <BottomSheet open={!!showHealth} onClose={() => setShowHealth(null)}
        title={tc({ en: "Key Health", hi: "कुंजी स्वास्थ्य", bn: "কী স্বাস্থ্য" })}>
        {showHealth && <HealthDetail keyData={showHealth} health={health[showHealth.id] || {}} tc={tc} />}
      </BottomSheet>
    </>
  );
}

function KeyForm({ initial, onSave, tc }) {
  const providers = listProviders();
  const [name, setName] = useState(initial?.name || "");
  const [key, setKey] = useState(initial?.key || "");
  const [provider, setProvider] = useState(initial?.provider || "openai");
  const [notes, setNotes] = useState(initial?.notes || "");

  const handleSubmit = () => {
    if (!key.trim()) return;
    onSave({ name: name.trim() || undefined, key: key.trim(), provider, notes: notes.trim() });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={S.label}>{tc({ en: "Name / Label", hi: "नाम / लेबल", bn: "নাম / লেবেল" })}</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={tc({ en: "e.g. Personal, Production", hi: "जैसे व्यक्तिगत, प्रोडक्शन", bn: "যেমন ব্যক্তিগত, প্রোডাকশন" })}
          style={S.input} />
      </div>
      <div>
        <label style={S.label}>{tc({ en: "API Key", hi: "API कुंजी", bn: "API কী" })} *</label>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)}
          placeholder="sk-..." style={{ ...S.input, fontFamily: "monospace" }} />
      </div>
      <div>
        <label style={S.label}>{tc({ en: "Provider", hi: "प्रदाता", bn: "প্রোভাইডার" })}</label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} style={S.select}>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label style={S.label}>{tc({ en: "Notes (optional)", hi: "नोट्स (वैकल्पिक)", bn: "নোটস (ঐচ্ছিক)" })}</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder={tc({ en: "Optional notes...", hi: "वैकल्पिक नोट्स...", bn: "ঐচ্ছিক নোটস..." })}
          style={S.input} />
      </div>
      <button onClick={handleSubmit} disabled={!key.trim()}
        style={{ ...S.btn(T.primary, "#fff"), opacity: key.trim() ? 1 : 0.5, marginTop: 4 }}>
        {initial ? tc({ en: "Update Key", hi: "कुंजी अपडेट करें", bn: "কী আপডেট করুন" }) : tc({ en: "Add Key", hi: "कुंजी जोड़ें", bn: "কী যোগ করুন" })}
      </button>
    </div>
  );
}

function HealthDetail({ keyData, health, tc }) {
  const rows = [
    { icon: "Activity", label: tc({ en: "Total Requests", hi: "कुल अनुरोध", bn: "মোট অনুরোধ" }), value: health.requests || 0 },
    { icon: "CheckCircle", label: tc({ en: "Last Success", hi: "अंतिम सफलता", bn: "শেষ সাফল্য" }), value: formatDate(health.lastSuccess), color: "#22c55e" },
    { icon: "AlertCircle", label: tc({ en: "Last Error", hi: "अंतिम त्रुटि", bn: "শেষ ত্রুটি" }), value: health.lastError ? `${health.lastError.message} (${health.lastError.status || "?"})` : "—", color: health.lastError ? "#ef4444" : undefined },
    { icon: "RefreshCw", label: tc({ en: "Consecutive Failures", hi: "लगातार विफलताएँ", bn: "ক্রমাগত ব্যর্থতা" }), value: health.failures || 0, color: (health.failures || 0) > 0 ? "#ef4444" : undefined },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{keyData.name}</div>
      {rows.map((r, i) => (
        <div key={i} style={S.healthCard}>
          <Icon name={r.icon} size={18} style={{ color: r.color || T.inkSoft, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: T.inkSoft }}>{r.label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: r.color || T.ink }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
