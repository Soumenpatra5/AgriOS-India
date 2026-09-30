import { useState, useEffect, useRef } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Card, Button, Spinner, IconTile, ErrorState } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { MODULE_CATALOG, CORE_MODULES_ORDER, OPTIONAL_MODULES_ORDER } from "./moduleCatalog.js";
import Icon from "../../components/Icon.jsx";

/* Farm Space Customize
   Enables, disables, and reorders modules for a specific Farm Space.
   Active modules appear on the dashboard in their saved order.
   Disabled optional modules remain available to activate anytime. */

export default function FarmSpaceCustomize({ spaceId }) {
  const { pop, tc, toast } = useApp();
  const [space, setSpace] = useState(null);
  const [activeModules, setActiveModules] = useState([]);
  const [availableModules, setAvailableModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Keep a ref to compare dirty state
  const initialOrderRef = useRef("");

  useEffect(() => {
    let alive = true;
    const s = farmSpaceService.peekSpaces()?.find((x) => x.id === spaceId) || farmSpaceService.active();
    if (!s) {
      pop();
      return;
    }
    setSpace(s);

    farmSpaceService
      .modules(s.id)
      .then((mods) => {
        if (!alive) return;
        const enabledIds = (mods || [])
          .filter((m) => m.enabled !== false)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((m) => m.module_id);

        // Ensure all required core modules are present
        const activeList = [...enabledIds];
        for (const coreId of CORE_MODULES_ORDER) {
          if (!activeList.includes(coreId)) {
            activeList.push(coreId);
          }
        }

        // Available = optional modules not in active
        const availableList = OPTIONAL_MODULES_ORDER.filter((id) => !activeList.includes(id));

        setActiveModules(activeList);
        setAvailableModules(availableList);
        initialOrderRef.current = activeList.join(",");
        setLoading(false);
      })
      .catch((err) => {
        if (alive) {
          setError(err.message || "Failed to load modules");
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [spaceId, pop]);

  // Reordering helpers
  const moveActive = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= activeModules.length) return;
    const next = [...activeModules];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setActiveModules(next);
  };

  // Drag and drop handlers
  const handleDragStart = (idx) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  };

  const handleDrop = (idx) => {
    if (draggedIdx !== null && draggedIdx !== idx) {
      moveActive(draggedIdx, idx);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // Enable an available module
  const enableModule = (id) => {
    setAvailableModules((prev) => prev.filter((m) => m !== id));
    setActiveModules((prev) => [...prev, id]);
  };

  // Disable an active module (only optional modules)
  const disableModule = (id) => {
    if (CORE_MODULES_ORDER.includes(id)) return; // Required
    setActiveModules((prev) => prev.filter((m) => m !== id));
    setAvailableModules((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const isDirty = activeModules.join(",") !== initialOrderRef.current;

  // Save changes to server
  const save = async () => {
    if (saving || !space) return;
    setSaving(true);
    try {
      // Send active modules in order
      const orderedModuleIds = [...activeModules];

      const res = await farmSpaceService.updateModules(space.id, {
        expected_version: space.configuration_version || 1,
        orderedModuleIds,
      });

      // Update local space version
      if (res?.configuration_version) {
        setSpace((prev) => ({ ...prev, configuration_version: res.configuration_version }));
      }

      toast(tc({ en: "Changes saved.", hi: "बदलाव सहेजे गए।", bn: "পরিবর্তন সংরক্ষিত হয়েছে।" }), "success");
      pop();
    } catch (err) {
      toast(err?.message || "Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <AppBar title={tc({ en: "Customize Workspace", hi: "कार्यस्थान कस्टमाइज़ करें", bn: "কর্মক্ষেত্র কাস্টমাইজ করুন" })} onBack={pop} />
        <div style={{ padding: 60, display: "grid", placeItems: "center" }}>
          <Spinner />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AppBar title={tc({ en: "Customize Workspace", hi: "कार्यस्थान कस्टमाइज़ करें", bn: "কর্মক্ষেত্র কাস্টমাইজ করুন" })} onBack={pop} />
        <div style={{ padding: 20 }}>
          <ErrorState body={error} />
        </div>
      </>
    );
  }

  return (
    <>
      <AppBar title={tc({ en: "Customize Workspace", hi: "कार्यस्थान कस्टमाइज़ करें", bn: "কর্মক্ষেত্র কাস্টমাইজ করুন" })} onBack={pop} />
      <div style={{ padding: "8px 16px 100px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ACTIVE MODULES SECTION */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: T.ink }}>
              {tc({ en: `Active Modules (${activeModules.length})`, hi: `सक्रिय मॉड्यूल (${activeModules.length})`, bn: `সক্রিয় মডিউল (${activeModules.length})` })}
            </div>
            <div style={{ fontSize: 11, color: T.inkFaint }}>
              {tc({ en: "Drag ☰ or use arrows to reorder", hi: "क्रम बदलने के लिए ☰ खींचें या तीर का उपयोग करें", bn: "ক্রম সাজাতে ☰ টানুন বা তীরচিহ্ন ব্যবহার করুন" })}
            </div>
          </div>

          <Card pad={0}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activeModules.map((id, index) => {
                const def = MODULE_CATALOG[id];
                if (!def) return null;
                const isCore = CORE_MODULES_ORDER.includes(id);
                const isFirst = index === 0;
                const isLast = index === activeModules.length - 1;
                const isBeingDragged = draggedIdx === index;
                const isDragOver = dragOverIdx === index;

                return (
                  <div
                    key={id}
                    data-module-id={id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderBottom: isLast ? "none" : `1px solid ${T.border}`,
                      background: isDragOver ? (T.primarySoft || "#f0fdf4") : T.surface,
                      opacity: isBeingDragged ? 0.4 : 1,
                      transition: "background 0.15s ease",
                      cursor: "grab",
                    }}
                  >
                    {/* Drag Handle & Up/Down Arrows */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8, flexShrink: 0 }}>
                      <div
                        title="Drag to reorder"
                        style={{ padding: "4px 2px", color: T.inkFaint, cursor: "grab", display: "grid", placeItems: "center" }}
                      >
                        <Icon name="Menu" size={16} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); moveActive(index, index - 1); }}
                          disabled={isFirst}
                          aria-label={`Move ${tc(def.label)} up`}
                          style={{
                            background: "none", border: "none", padding: 1, cursor: isFirst ? "default" : "pointer",
                            opacity: isFirst ? 0.2 : 0.7, color: T.ink,
                          }}
                        >
                          <Icon name="ChevronUp" size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); moveActive(index, index + 1); }}
                          disabled={isLast}
                          aria-label={`Move ${tc(def.label)} down`}
                          style={{
                            background: "none", border: "none", padding: 1, cursor: isLast ? "default" : "pointer",
                            opacity: isLast ? 0.2 : 0.7, color: T.ink,
                          }}
                        >
                          <Icon name="ChevronDown" size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Module Icon Tile */}
                    <IconTile name={def.icon} accent={def.a} size={32} />

                    {/* Module Info */}
                    <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{tc(def.label)}</div>
                      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tc(def.desc)}
                      </div>
                    </div>

                    {/* Action: Required badge or Disable button */}
                    <div style={{ marginLeft: 8, flexShrink: 0 }}>
                      {isCore ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: T.faint || "#f3f4f6",
                            color: T.inkSoft,
                          }}
                        >
                          {tc({ en: "Required", hi: "आवश्यक", bn: "প্রয়োজনীয়" })}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); disableModule(id); }}
                          title={tc({ en: "Disable module", hi: "मॉड्यूल अक्षम करें", bn: "মডিউল নিষ্ক্রিয় করুন" })}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: `1px solid ${T.border}`,
                            background: "none",
                            color: T.danger || "#ef4444",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <Icon name="X" size={13} />
                          {tc({ en: "Disable", hi: "अक्षम", bn: "নিষ্ক্রিয়" })}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* AVAILABLE MODULES SECTION */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: T.ink }}>
              {tc({ en: `Available Modules (${availableModules.length})`, hi: `उपलब्ध मॉड्यूल (${availableModules.length})`, bn: `উপলব্ধ মডিউল (${availableModules.length})` })}
            </div>
            <div style={{ fontSize: 11, color: T.inkFaint }}>
              {tc({ en: "Activate to show on dashboard", hi: "डैशबोर्ड पर दिखाने के लिए सक्षम करें", bn: "ড্যাশবোর্ডে দেখাতে সক্রিয় করুন" })}
            </div>
          </div>

          {availableModules.length === 0 ? (
            <Card pad={16} style={{ textAlign: "center", color: T.inkSoft, fontSize: 13 }}>
              {tc({
                en: "All available modules are currently active.",
                hi: "सभी उपलब्ध मॉड्यूल वर्तमान में सक्रिय हैं।",
                bn: "সমস্ত উপলব্ধ মডিউল বর্তমানে সক্রিয় রয়েছে।",
              })}
            </Card>
          ) : (
            <Card pad={0}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {availableModules.map((id, index) => {
                  const def = MODULE_CATALOG[id];
                  if (!def) return null;
                  const isLast = index === availableModules.length - 1;

                  return (
                    <div
                      key={id}
                      data-module-id={id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "12px 14px",
                        borderBottom: isLast ? "none" : `1px solid ${T.border}`,
                      }}
                    >
                      <IconTile name={def.icon} accent={def.a} size={32} style={{ opacity: 0.7 }} />

                      <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{tc(def.label)}</div>
                        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tc(def.desc)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => enableModule(id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${T.primary}`,
                          background: T.primarySoft || "#f0fdf4",
                          color: T.primary,
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Icon name="Plus" size={14} />
                        {tc({ en: "Enable", hi: "सक्षम करें", bn: "সক্রিয় করুন" })}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* STICKY SAVE BAR */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            maxWidth: 460,
            margin: "0 auto",
            padding: 16,
            paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
            background: T.surface,
            borderTop: `1px solid ${T.border}`,
            boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
            zIndex: 40,
          }}
        >
          <Button full size="large" onClick={save} disabled={saving || !isDirty}>
            {saving
              ? tc({ en: "Saving changes…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ করা হচ্ছে…" })
              : tc({ en: "Save Changes", hi: "बदलाव सहेजें", bn: "পরিবর্তন সংরক্ষণ করুন" })}
          </Button>
        </div>
      </div>
    </>
  );
}
