import { useState, useEffect, useCallback, useMemo } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { Button, Spinner } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceBridgeService } from "../../services/farmSpace/farmSpaceBridgeService.js";

const DOMAINS = [
  { id: "parcels", label: { en: "Land Parcels", hi: "भूमि खंड", bn: "জমির প্লট" }, icon: "Layers", module: "cropDashboard" },
  { id: "dairy", label: { en: "Dairy Herd", hi: "डेयरी झुंड", bn: "ডেয়ারি পাল" }, icon: "Milk", module: "dairyDashboard" },
  { id: "goat", label: { en: "Goats & Sheep", hi: "बकरी और भेड़", bn: "ছাগল ও ভেড়া" }, icon: "Rabbit", module: "goatDashboard" },
  { id: "pig", label: { en: "Swine / Pigs", hi: "सूअर", bn: "শূকর" }, icon: "PiggyBank", module: "pigDashboard" },
  { id: "poultry", label: { en: "Poultry Flocks", hi: "पोल्ट्री झुंड", bn: "হাঁস-মুরগির ঝাঁক" }, icon: "Bird", module: "poultryDashboard" },
  { id: "fish", label: { en: "Aquaculture Ponds", hi: "मछली तालाब", bn: "মাছের পুকুর" }, icon: "Fish", module: "fishDashboard" },
  { id: "bee", label: { en: "Apiary Hives", hi: "मधुमक्खी छत्ते", bn: "মৌমাছির বাক্স" }, icon: "Hexagon", module: "beeDashboard" },
];

function renderItemSubtitle(domain, local) {
  if (!local) return "—";
  if (domain === "parcels") {
    const parts = [];
    if (local.area != null) parts.push(`${local.area} ${local.areaUnit || ""}`.trim());
    if (local.currentCrop) parts.push(local.currentCrop);
    if (local.soilType) parts.push(local.soilType);
    return parts.length ? parts.join(" · ") : "—";
  }
  if (domain === "poultry") {
    const parts = [];
    const count = local.placedQty ?? local.count;
    if (count != null) parts.push(`${count} birds`);
    if (local.poultryType) parts.push(local.poultryType);
    if (local.purpose) parts.push(local.purpose);
    if (local.breed) parts.push(local.breed);
    return parts.length ? parts.join(" · ") : "—";
  }
  if (domain === "fish") {
    const parts = [];
    if (local.species) parts.push(local.species);
    if (local.areaSqm != null) parts.push(`${local.areaSqm} m²`);
    else if (local.sizeAcres != null) parts.push(`${local.sizeAcres} acres`);
    if (local.stockingCount != null) parts.push(`${local.stockingCount} stocked`);
    return parts.length ? parts.join(" · ") : "—";
  }
  if (domain === "bee") {
    const parts = [];
    if (local.hiveType) parts.push(local.hiveType);
    if (local.currentStatus) parts.push(local.currentStatus);
    else if (local.colonyStrength) parts.push(local.colonyStrength);
    if (local.installationDate) parts.push(local.installationDate);
    else if (local.installedDate) parts.push(local.installedDate);
    return parts.length ? parts.join(" · ") : "—";
  }
  const parts = [];
  if (local.species) parts.push(local.species);
  if (local.sex && local.sex !== "unknown") parts.push(local.sex);
  if (local.breed) parts.push(local.breed);
  if (local.tagId) parts.push(`#${local.tagId}`);
  if (local.currentStatus) parts.push(local.currentStatus);
  return parts.length ? parts.join(" · ") : "—";
}

function getDomainNoun(domain) {
  if (domain === "parcels") return "parcel(s)";
  if (domain === "poultry") return "batch(es)";
  if (domain === "fish") return "pond(s)";
  if (domain === "bee") return "hive(s)";
  return "animal(s)";
}

function getDomainNounPlural(domain) {
  if (domain === "parcels") return "Fields";
  if (domain === "poultry") return "Batches";
  if (domain === "fish") return "Ponds";
  if (domain === "bee") return "Hives";
  return "Animals";
}

/**
 * FarmSpaceBridgeModal
 *
 * Explicit, user-initiated bridge to publish device-local ERP data (parcels & livestock)
 * into the active Farm Space without merging identities, touching employee data, or deleting
 * local records.
 */
export default function FarmSpaceBridgeModal({ open, onClose, space }) {
  const { tc, toast } = useApp();

  const [domain, setDomain] = useState("parcels");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parcels, setParcels] = useState([]);
  const [preview, setPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [overwriteDiffs, setOverwriteDiffs] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState(null);

  const activeDomainDef = DOMAINS.find((d) => d.id === domain) || DOMAINS[0];

  const isModuleDisabled = useMemo(() => {
    if (!space?.modules || !activeDomainDef.module) return false;
    if (Array.isArray(space.modules)) {
      if (typeof space.modules[0] === "string") {
        return !space.modules.includes(activeDomainDef.module);
      }
      const m = space.modules.find((mod) => (mod.module_id || mod.id) === activeDomainDef.module);
      return m ? m.enabled === false : false;
    }
    return false;
  }, [space?.modules, activeDomainDef]);

  // Reset and reload when modal opens, target space changes, or domain changes
  const runPreview = useCallback(async () => {
    if (!space?.id) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setConfirming(false);
    setPublishing(false);
    setResult(null);

    try {
      let localItems = [];
      let previewRes = null;

      if (domain === "parcels") {
        localItems = await farmSpaceBridgeService.getLocalParcels();
        setParcels(localItems);

        if (localItems.length === 0) {
          setLoading(false);
          return;
        }

        previewRes = await farmSpaceBridgeService.preview({
          spaceId: space.id,
          parcels: localItems,
        });
      } else {
        localItems = await farmSpaceBridgeService.getLocalAnimals(domain);
        setParcels(localItems);

        if (localItems.length === 0) {
          setLoading(false);
          return;
        }

        previewRes = await farmSpaceBridgeService.previewLivestock({
          spaceId: space.id,
          enterprise: domain,
          animals: localItems,
        });
      }

      setPreview(previewRes);

      // Pre-select all NEW items by default
      const initialSelected = new Set();
      (previewRes.items || []).forEach((item) => {
        if (item.status === "NEW") {
          initialSelected.add(item.clientUuid);
        }
      });
      setSelectedIds(initialSelected);
    } catch (err) {
      setError(err?.message || "Failed to load bridge preview");
    } finally {
      setLoading(false);
    }
  }, [space?.id, domain]);

  useEffect(() => {
    if (open) {
      runPreview();
    } else {
      // Clean up state on close so nothing leaks across spaces
      setPreview(null);
      setResult(null);
      setSelectedIds(new Set());
      setConfirming(false);
      setPublishing(false);
      setError(null);
    }
  }, [open, runPreview]);

  const toggleSelect = (id) => {
    // Prevent selecting items already belonging to another Farm Space
    const isConflict = (preview?.items || []).some(
      (item) => item.clientUuid === id && item.status === "CONFLICT_OTHER_SPACE"
    );
    if (isConflict) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = selectedIds.size;

  const selectedParcels = useMemo(() => {
    const conflictUuids = new Set(
      (preview?.items || [])
        .filter((i) => i.status === "CONFLICT_OTHER_SPACE")
        .map((i) => i.clientUuid)
    );
    return parcels.filter(
      (p) => selectedIds.has(String(p.id)) && !conflictUuids.has(String(p.id))
    );
  }, [parcels, selectedIds, preview]);

  const hasSelectedDiffs = useMemo(() => {
    if (!preview?.items) return false;
    return preview.items.some(
      (item) => selectedIds.has(item.clientUuid) && item.status === "EXISTS_DIFF"
    );
  }, [preview, selectedIds]);

  const handlePublish = async () => {
    if (selectedParcels.length === 0 || !space?.id) return;
    setPublishing(true);
    setError(null);

    try {
      let res = null;
      if (domain === "parcels") {
        res = await farmSpaceBridgeService.publish({
          spaceId: space.id,
          parcels: selectedParcels,
          overwrite: overwriteDiffs,
        });
      } else {
        res = await farmSpaceBridgeService.publishLivestock({
          spaceId: space.id,
          enterprise: domain,
          animals: selectedParcels,
          overwrite: overwriteDiffs,
        });
      }
      setResult(res);
      setConfirming(false);
      const entityLabel = getDomainNoun(domain);
      toast(
        tc({
          en: `Published ${res.created.length} ${entityLabel} to ${space.name}`,
          hi: `${space.name} में ${res.created.length} प्रकाशित किए गए`,
          bn: `${space.name}-এ ${res.created.length}টি প্রকাশ করা হয়েছে`,
        }),
        "success"
      );
    } catch (err) {
      setError(err?.message || "Publish failed");
      toast(err?.message || "Publish failed", "error");
    } finally {
      setPublishing(false);
    }
  };

  if (!open) return null;

  const newItems = (preview?.items || []).filter((i) => i.status === "NEW");
  const diffItems = (preview?.items || []).filter((i) => i.status === "EXISTS_DIFF");
  const sameItems = (preview?.items || []).filter((i) => i.status === "EXISTS_SAME");
  const conflictItems = (preview?.items || []).filter((i) => i.status === "CONFLICT_OTHER_SPACE");

  return (
    <div
      onClick={onClose}
      data-testid="bridge-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: T.scrim,
        display: "grid",
        placeItems: "center",
        padding: 16,
        animation: "ag-fade .2s var(--ag-ease)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        data-testid="bridge-modal-dialog"
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          background: T.surface,
          borderRadius: T.rXl,
          boxShadow: T.shadowLg,
          overflow: "hidden",
        }}
      >
        {/* ── Modal Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: `1px solid ${T.line}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.ink }}>
              {tc({ en: "Bridge Local ERP Data", hi: "स्थानीय ईआरपी डेटा ब्रिज करें", bn: "স্থানীয় ইআরপি ডেটা ব্রিজ করুন" })}
            </div>
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>
              {domain === "parcels"
                ? tc({ en: "Phase 1: Land Parcels → Farm Fields", hi: "चरण 1: भूमि खंड → फ़ार्म फ़ील्ड्स", bn: "পর্যায় ১: জমির প্লট → ফার্ম ফিল্ড" })
                : ["dairy", "goat", "pig"].includes(domain)
                ? tc({ en: `Phase 2: ${activeDomainDef.label.en} → Cloud Livestock`, hi: `चरण 2: ${tc(activeDomainDef.label)} → क्लाउड पशुधन`, bn: `পর্যায় ২: ${tc(activeDomainDef.label)} → ক্লাউড পশুসম্পদ` })
                : tc({ en: `Phase 3: ${activeDomainDef.label.en} → Cloud Register`, hi: `चरण 3: ${tc(activeDomainDef.label)} → क्लाउड रजिस्टर`, bn: `পর্যায় ৩: ${tc(activeDomainDef.label)} → ক্লাউড রেজিস্টার` })}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            data-testid="bridge-modal-close"
            style={{
              background: T.surface2,
              border: "none",
              borderRadius: 10,
              padding: 7,
              cursor: "pointer",
              color: T.ink,
              display: "flex",
            }}
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* ── Enterprise / Domain Tabs ── */}
        <div
          data-testid="bridge-domain-tabs"
          style={{
            display: "flex",
            gap: 4,
            padding: "8px 16px 0",
            background: T.surface2,
            borderBottom: `1px solid ${T.line}`,
            overflowX: "auto",
          }}
        >
          {DOMAINS.map((d) => {
            const active = domain === d.id;
            return (
              <button
                key={d.id}
                type="button"
                data-testid={`bridge-tab-${d.id}`}
                onClick={() => {
                  if (loading || publishing) return;
                  setDomain(d.id);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  border: "none",
                  borderBottom: active ? `2px solid ${T.primary}` : "2px solid transparent",
                  background: "none",
                  cursor: (loading || publishing) ? "not-allowed" : "pointer",
                  fontWeight: active ? 700 : 500,
                  fontSize: 12.5,
                  color: active ? T.primary : T.inkSoft,
                  whiteSpace: "nowrap",
                }}
              >
                <Icon name={d.icon} size={14} color={active ? T.primary : T.inkFaint} />
                {tc(d.label)}
              </button>
            );
          })}
        </div>

        {/* ── Target Space & Warning Banner ── */}
        <div style={{ padding: "12px 20px", background: T.surface2, borderBottom: `1px solid ${T.line}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase" }}>
              {tc({ en: "Target Farm Space:", hi: "लक्षित फ़ार्म स्पेस:", bn: "টার্গেট ফার্ম স্পেস:" })}
            </span>
            <span
              data-testid="target-space-badge"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: T.primary,
                background: T.primarySoft,
                padding: "2px 8px",
                borderRadius: 6,
              }}
            >
              {space?.name || "—"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.45 }}>
            <Icon name="AlertTriangle" size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4, color: T.amber }} />
            {domain === "parcels"
              ? tc({
                  en: "Publishing copies your device-local land parcels into this shared Farm Space. Local ERP records are never modified or deleted.",
                  hi: "प्रकाशन से आपके स्थानीय भूमि खंड इस साझा फ़ार्म स्पेस में कॉपी होते हैं। स्थानीय रिकॉर्ड कभी नहीं बदले जाते।",
                  bn: "প্রকাশ করার মাধ্যমে আপনার স্থানীয় জমির প্লট এই শেয়ার্ড ফার্ম স্পেসে কপি হবে। স্থানীয় রেকর্ড পরিবর্তিত বা মোছা হবে না।",
                })
              : tc({
                  en: "Publishing copies your device-local animals into this shared Farm Space. Local ERP records are never modified or deleted.",
                  hi: "प्रकाशन से आपके स्थानीय पशु इस साझा फ़ार्म स्पेस में कॉपी होते हैं। स्थानीय रिकॉर्ड कभी नहीं बदले जाते।",
                  bn: "প্রকাশ করার মাধ্যমে আপনার স্থানীয় পশু এই শেয়ার্ড ফার্ম স্পেসে কপি হবে। স্থানীয় রেকর্ড পরিবর্তিত বা মোছা হবে না।",
                })}
          </div>
        </div>

        {isModuleDisabled && (
          <div
            data-testid="bridge-module-disabled-banner"
            style={{
              padding: "10px 16px",
              background: T.amberSoft,
              borderBottom: `1px solid ${T.amber}`,
              color: T.ink,
              fontSize: 12.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon name="AlertTriangle" size={15} color={T.amber} />
            <span>
              {tc({
                en: `The ${tc(activeDomainDef.label)} module is disabled in this Farm Space. Bridge operations will be rejected until enabled in Settings.`,
                hi: `इस फ़ार्म स्पेस में ${tc(activeDomainDef.label)} मॉड्यूल अक्षम है। सेटिंग्स में सक्षम किए बिना ब्रिज संचालन अस्वीकार कर दिया जाएगा।`,
                bn: `এই ফার্ম স্পেসে ${tc(activeDomainDef.label)} মডিউল নিষ্ক্রিয়। সেটিংসে সক্রিয় না করা পর্যন্ত ব্রিজ পরিচালনা প্রত্যাখ্যান করা হবে।`,
              })}
            </span>
          </div>
        )}

        {/* ── Modal Content Area ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {loading && (
            <div style={{ padding: 40, display: "grid", placeItems: "center", gap: 12 }}>
              <Spinner />
              <div style={{ fontSize: 13, color: T.inkSoft }}>
                {tc({ en: `Evaluating ${domain === "parcels" ? "parcels" : "animals"} against Farm Space...`, hi: `फ़ार्म स्पेस के विरुद्ध जाँच हो रही है...`, bn: `ফার্ম স্পেসের সাথে যাচাই করা হচ্ছে...` })}
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: T.redSoft,
                color: T.red,
                fontSize: 13,
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon name="AlertCircle" size={16} />
              <span style={{ flex: 1 }}>{error}</span>
              <Button variant="outline" size="sm" onClick={runPreview}>
                {tc({ en: "Retry", hi: "पुनः प्रयास", bn: "পুনরায় চেষ্টা" })}
              </Button>
            </div>
          )}

          {!loading && parcels.length === 0 && (
            <div style={{ padding: 30, textAlign: "center" }}>
              <Icon name="Folder" size={36} style={{ color: T.inkFaint, margin: "0 auto 10px" }} />
              <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>
                {domain === "parcels"
                  ? tc({ en: "No local land parcels found", hi: "कोई स्थानीय भूमि खंड नहीं मिला", bn: "কোনো स्थानीय জমির প্লট পাওয়া যায়নি" })
                  : tc({ en: "No local animals found for this enterprise", hi: "इस उद्यम के लिए कोई स्थानीय पशु नहीं मिले", bn: "এই এন্টারপ্রাইজের জন্য কোনো প্রাণী পাওয়া যায়নি" })}
              </div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4 }}>
                {domain === "parcels"
                  ? tc({ en: "Add land parcels in the ERP Land Manager first.", hi: "पहले ईआरपी लैंड मैनेजर में खंड जोड़ें।", bn: "প্রথমে ইআরপি ল্যান্ড ম্যানেজারে প্লট যোগ করুন।" })
                  : tc({ en: "Add animals in the local Livestock register first.", hi: "पहले स्थानीय पशुधन रजिस्टर में जोड़ें।", bn: "প্রথমে স্থানীয় পশুসম্পদ রেজিস্ট্রারে যোগ করুন।" })}
              </div>
            </div>
          )}

          {!loading && result && (
            /* ── Publish Result Screen ── */
            <div data-testid="bridge-result-view" style={{ textAlign: "center", padding: "16px 8px" }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: T.greenSoft,
                  color: T.green,
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 12px",
                }}
              >
                <Icon name="Check" size={26} />
              </div>
              <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.ink }}>
                {tc({ en: "Bridge Complete", hi: "ब्रिज पूर्ण हुआ", bn: "ব্রিজ সম্পন্ন" })}
              </div>
              <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4, marginBottom: 20 }}>
                {tc({
                  en: `Processed ${result.total} ${getDomainNoun(domain)} for ${space?.name}`,
                  hi: `${space?.name} के लिए ${result.total} रिकॉर्ड संसाधित किए गए`,
                  bn: `${space?.name}-এর জন্য ${result.total}টি রেকর্ড প্রক্রিয়া সম্পন্ন`,
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                <div style={{ padding: "12px 8px", background: T.surface2, borderRadius: 10 }}>
                  <div data-testid="result-published" style={{ fontSize: 20, fontWeight: 700, color: T.green }}>
                    {result.created.length}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
                    {tc({ en: "Published", hi: "प्रकाशित", bn: "প্রকাশিত" })}
                  </div>
                </div>
                <div style={{ padding: "12px 8px", background: T.surface2, borderRadius: 10 }}>
                  <div data-testid="result-updated" style={{ fontSize: 20, fontWeight: 700, color: T.primary }}>
                    {result.updated.length}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
                    {tc({ en: "Updated", hi: "अपडेट", bn: "আপডেট" })}
                  </div>
                </div>
                <div style={{ padding: "12px 8px", background: T.surface2, borderRadius: 10 }}>
                  <div data-testid="result-synced" style={{ fontSize: 20, fontWeight: 700, color: T.inkFaint }}>
                    {result.skipped.length}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
                    {tc({ en: "Already Synced", hi: "पहले से सिंक", bn: "আগে থেকেই সিঙ্ক" })}
                  </div>
                </div>
              </div>

              {result.created.length > 0 && (
                <div style={{ textAlign: "left", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, marginBottom: 6 }}>
                    {tc({ en: `Newly Created ${getDomainNounPlural(domain)}:`, hi: "नए बनाए गए रिकॉर्ड्स:", bn: "নতুন তৈরি রেকর্ড:" })}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.created.map((c) => (
                      <span
                        key={c.id}
                        style={{
                          fontSize: 12,
                          padding: "3px 8px",
                          background: T.greenSoft,
                          color: T.green,
                          borderRadius: 6,
                          fontWeight: 500,
                        }}
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !result && confirming && (
            /* ── Confirmation View ── */
            <div data-testid="bridge-confirm-view" style={{ padding: "10px 4px" }}>
              <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 8 }}>
                {tc({ en: "Confirm Publishing", hi: "प्रकाशन की पुष्टि करें", bn: "প্রকাশ নিশ্চিত করুন" })}
              </div>
              <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5, marginBottom: 16 }}>
                {tc({
                  en: `You are about to publish ${selectedCount} selected local ${getDomainNoun(domain)} into "${space?.name}".`,
                  hi: `आप ${selectedCount} चयनित स्थानीय ${domain === "parcels" ? "भूमि खंड" : "पशु"} "${space?.name}" में प्रकाशित करने वाले हैं।`,
                  bn: `আপনি ${selectedCount}টি নির্বাচিত স্থানীয় ${domain === "parcels" ? "জমির প্লট" : "পশু"} "${space?.name}"-এ প্রকাশ করতে যাচ্ছেন।`,
                })}
              </div>

              {hasSelectedDiffs && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: T.amberSoft,
                    border: `1px solid ${T.amber}`,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 4 }}>
                    {tc({ en: "Differences Detected", hi: "भिन्नताएँ पाई गईं", bn: "পার্থক্য শনাক্ত হয়েছে" })}
                  </div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>
                    {tc({
                      en: `Some selected ${domain === "parcels" ? "parcels" : "animals"} exist in the cloud with different attributes.`,
                      hi: `कुछ चयनित ${domain === "parcels" ? "खंड" : "पशु"} क्लाउड में भिन्न विशेषताओं के साथ मौजूद हैं।`,
                      bn: `কিছু নির্বাচিত ${domain === "parcels" ? "প্লট" : "পশু"} ক্লাউডে ভিন্ন বৈশিষ্ট্যে বিদ্যমান।`,
                    })}
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.ink,
                    }}
                  >
                    <input
                      type="checkbox"
                      data-testid="overwrite-diffs-checkbox"
                      checked={overwriteDiffs}
                      onChange={(e) => setOverwriteDiffs(e.target.checked)}
                    />
                    {tc({
                      en: "Overwrite cloud fields with local ERP data",
                      hi: "क्लाउड फ़ील्ड्स को स्थानीय ईआरपी डेटा से अधिलेखित करें",
                      bn: "স্থানীয় ইআরপি ডেটা দিয়ে ক্লাউড ফিল্ড ওভাররাইট করুন",
                    })}
                  </label>
                </div>
              )}
            </div>
          )}

          {!loading && !result && !confirming && preview && (
            /* ── Preview Classification View ── */
            <div data-testid="bridge-preview-view" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Summary Badges */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: T.surface2, color: T.ink }}>
                  Total: {preview.summary.total}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: T.greenSoft, color: T.green }}>
                  New: {preview.summary.newCount}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: T.amberSoft, color: T.amber }}>
                  Differences: {preview.summary.diffCount}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: T.surface2, color: T.inkFaint }}>
                  Unchanged: {preview.summary.sameCount}
                </span>
                {(preview.summary?.conflictCount > 0 || conflictItems.length > 0) && (
                  <span
                    data-testid="badge-conflicts"
                    style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: T.redSoft, color: T.red }}
                  >
                    Conflicts: {preview.summary?.conflictCount ?? conflictItems.length}
                  </span>
                )}
              </div>

              {/* SECTION 1: NEW PARCELS */}
              {newItems.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {tc({
                        en: `New ${getDomainNounPlural(domain)} (${newItems.length})`,
                        hi: `नए ${domain === "parcels" ? "खंड" : "पशु"} (${newItems.length})`,
                        bn: `নতুন ${domain === "parcels" ? "প্লট" : "পশু"} (${newItems.length})`,
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {newItems.map((item) => {
                      const isSelected = selectedIds.has(item.clientUuid);
                      return (
                        <div
                          key={item.clientUuid}
                          onClick={() => toggleSelect(item.clientUuid)}
                          data-testid={`parcel-item-${item.clientUuid}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 12px",
                            background: isSelected ? T.greenSoft : T.surface2,
                            border: `1px solid ${isSelected ? T.green : T.line}`,
                            borderRadius: 10,
                            cursor: "pointer",
                            transition: "all .15s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            data-testid={`parcel-checkbox-${item.clientUuid}`}
                            checked={isSelected}
                            onChange={() => toggleSelect(item.clientUuid)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: 12, color: T.inkSoft }}>
                              {renderItemSubtitle(domain, item.local)}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: T.green,
                              background: T.surface,
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            NEW
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 2: PARCELS WITH DIFFERENCES */}
              {diffItems.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.amber, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    {tc({ en: `Existing with Differences (${diffItems.length})`, hi: `भिन्नता वाले मौजूद खंड (${diffItems.length})`, bn: `পার্থক্যসহ বিদ্যমান প্লট (${diffItems.length})` })}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {diffItems.map((item) => {
                      const isSelected = selectedIds.has(item.clientUuid);
                      return (
                        <div
                          key={item.clientUuid}
                          onClick={() => toggleSelect(item.clientUuid)}
                          data-testid={`parcel-item-${item.clientUuid}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 12px",
                            background: isSelected ? T.amberSoft : T.surface2,
                            border: `1px solid ${isSelected ? T.amber : T.line}`,
                            borderRadius: 10,
                            cursor: "pointer",
                            transition: "all .15s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            data-testid={`parcel-checkbox-${item.clientUuid}`}
                            checked={isSelected}
                            onChange={() => toggleSelect(item.clientUuid)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
                              {item.diffs.map((d) => `${d.field}: local "${d.local}" ≠ cloud "${d.cloud}"`).join(" · ")}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: T.amber,
                              background: T.surface,
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            MODIFIED
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 3: UNCHANGED / ALREADY SYNCED */}
              {sameItems.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    {tc({ en: `Already Synced (${sameItems.length})`, hi: `पहले से सिंक किए गए (${sameItems.length})`, bn: `আগে থেকেই সিঙ্ক হওয়া (${sameItems.length})` })}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {sameItems.map((item) => (
                      <div
                        key={item.clientUuid}
                        data-testid={`parcel-item-${item.clientUuid}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          background: T.surface2,
                          border: `1px solid ${T.line}`,
                          borderRadius: 10,
                          opacity: 0.85,
                        }}
                      >
                        <Icon name="CheckCircle" size={16} style={{ color: T.inkFaint }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 500, color: T.ink }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: 12, color: T.inkSoft }}>
                            {renderItemSubtitle(domain, item.local)} · Identical
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: T.inkFaint,
                            background: T.surface,
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          UNCHANGED
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 4: CONFLICT / LINKED TO ANOTHER FARM SPACE */}
              {conflictItems.length > 0 && (
                <div data-testid="bridge-conflict-section">
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Icon name="AlertCircle" size={15} style={{ color: T.red }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.red, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {tc({
                        en: `Conflict: Linked to Another Farm Space (${conflictItems.length})`,
                        hi: `टकराव: दूसरे फ़ार्म स्पेस से जुड़ा हुआ (${conflictItems.length})`,
                        bn: `দ্বন্দ্ব: অন্য ফার্ম স্পেসের সাথে যুক্ত (${conflictItems.length})`,
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {conflictItems.map((item) => (
                      <div
                        key={item.clientUuid}
                        data-testid={`parcel-item-${item.clientUuid}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          background: T.redSoft,
                          border: `1px solid ${T.red}`,
                          borderRadius: 10,
                          opacity: 0.9,
                        }}
                      >
                        <Icon name="Lock" size={16} style={{ color: T.red, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: 12, color: T.red, marginTop: 2 }}>
                            {tc({
                              en: "Already published in a different Farm Space. Cannot be published here.",
                              hi: "पहले से ही किसी अन्य फ़ार्म स्पेस में प्रकाशित है। यहाँ प्रकाशित नहीं किया जा सकता।",
                              bn: "ইতিমধ্যেই অন্য কোনো ফার্ম স্পেসে প্রকাশিত। এখানে প্রকাশ করা যাবে না।",
                            })}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: T.red,
                            background: T.surface,
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          CONFLICT
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Modal Footer Actions ── */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: `1px solid ${T.line}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          {result ? (
            <Button
              variant="primary"
              data-testid="bridge-done-btn"
              onClick={onClose}
            >
              {tc({ en: "Done", hi: "पूर्ण", bn: "সম্পন্ন" })}
            </Button>
          ) : confirming ? (
            <>
              <Button
                variant="outline"
                disabled={publishing}
                onClick={() => setConfirming(false)}
              >
                {tc({ en: "Back", hi: "वापस", bn: "ফিরে যান" })}
              </Button>
              <Button
                variant="primary"
                data-testid="confirm-publish-btn"
                disabled={publishing}
                onClick={handlePublish}
              >
                {publishing ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Spinner size={14} /> {tc({ en: "Publishing...", hi: "प्रकाशित हो रहा है...", bn: "প্রকাশ হচ্ছে..." })}
                  </span>
                ) : (
                  tc({ en: "Confirm & Publish", hi: "पुष्टि करें और प्रकाशित करें", bn: "নিশ্চিত করুন ও প্রকাশ করুন" })
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                {tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" })}
              </Button>
              <Button
                variant="primary"
                data-testid="publish-selected-btn"
                disabled={loading || selectedCount === 0}
                onClick={() => setConfirming(true)}
              >
                {tc({
                  en: `Publish Selected (${selectedCount})`,
                  hi: `चयनित प्रकाशित करें (${selectedCount})`,
                  bn: `নির্বাচিত প্রকাশ করুন (${selectedCount})`,
                })}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
