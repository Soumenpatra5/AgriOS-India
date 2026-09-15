import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { poultryApi } from "../../services/poultry/poultryApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const today = () => new Date().toISOString().slice(0, 10);

const BATCH_STATUS = {
  draft:          { a: "faint",   label: { en: "Draft",          hi: "ड्राफ़्ट",      bn: "ড্রাফ্ট" } },
  active:         { a: "primary", label: { en: "Active",         hi: "सक्रिय",       bn: "সক্রিয়" } },
  harvesting:     { a: "orange",  label: { en: "Harvesting",     hi: "कटाई",         bn: "কর্তন" } },
  partially_sold: { a: "orange",  label: { en: "Partial sale",   hi: "आंशिक बिक्री", bn: "আংশিক বিক্রয়" } },
  completed:      { a: "blue",    label: { en: "Completed",      hi: "पूर्ण",         bn: "সম্পন্ন" } },
  closed:         { a: "faint",   label: { en: "Closed",         hi: "बंद",           bn: "বন্ধ" } },
  archived:       { a: "faint",   label: { en: "Archived",       hi: "संग्रहित",      bn: "আর্কাইভড" } },
};

const TRANSITION_LABEL = {
  activate:         { en: "Activate",       hi: "सक्रिय करें",    bn: "সক্রিয় করুন" },
  start_harvesting: { en: "Start harvest",  hi: "कटाई शुरू",      bn: "কর্তন শুরু" },
  partially_sold:   { en: "Partial sale",   hi: "आंशिक बिक्री",   bn: "আংশিক বিক্রয়" },
  complete:         { en: "Mark complete",  hi: "पूरा चिह्नित",    bn: "সম্পন্ন করুন" },
  close:            { en: "Close batch",    hi: "बैच बंद करें",    bn: "ব্যাচ বন্ধ" },
  reopen:           { en: "Reopen",         hi: "फिर खोलें",       bn: "পুনরায় খুলুন" },
  archive:          { en: "Archive",        hi: "संग्रहित करें",   bn: "আর্কাইভ করুন" },
};

function statFg(a) {
  if (a === "primary") return T.primary;
  if (a === "orange")  return T.orange;
  if (a === "blue")    return T.blue;
  return T.inkSoft;
}

export default function PoultryDashboard() {
  const { pop, push, tc, toast } = useApp();
  const [space, setSpace]     = useState(null);
  const [batches, setBatches] = useState([]);
  const [sheds, setSheds]     = useState([]);
  const [state, setState]     = useState("loading");
  const [reason, setReason]   = useState(null);

  /* Create batch sheet */
  const [createOpen, setCreateOpen] = useState(false);
  const [bform, setBform] = useState({
    name: "", shed_id: "", placed_qty: "", placement_avg_weight_g: "",
    placement_date: today(), target_age_days: "42", target_fcr: "1.80",
    breed: "", supplier: "",
  });
  const [bbusy, setBbusy] = useState(false);

  /* Create shed sheet */
  const [shedOpen, setShedOpen] = useState(false);
  const [sform, setSform] = useState({ name: "", capacity: "" });
  const [sbusy, setSbusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const [bs, ss] = await Promise.all([
        poultryApi.listBatches(active.id, { limit: 100 }),
        poultryApi.listSheds(active.id),
      ]);
      setBatches(bs || []);
      setSheds(ss || []);
      setState("ready");
    } catch (err) {
      if (state !== "ready") { setReason(err?.reason || FARM_ERROR.FAILED); setState("error"); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  /* Permission helpers */
  const canManage = space && farmSpaceService.can(space, "farm.poultry.manage");

  /* Stats */
  const activeBatches = batches.filter(b => b.status === "active" || b.status === "harvesting" || b.status === "partially_sold");
  const totalLiveBirds = activeBatches.reduce((s, b) => s + (b.live_birds ?? b.placed_qty), 0);
  const activeCount = activeBatches.length;

  /* Create batch */
  const createBatch = async () => {
    if (!bform.name.trim() || !bform.placed_qty || !bform.placement_date) return;
    setBbusy(true);
    try {
      await poultryApi.createBatch(space.id, {
        name: bform.name.trim(),
        shed_id: bform.shed_id || null,
        placed_qty: Number(bform.placed_qty),
        placement_avg_weight_g: bform.placement_avg_weight_g ? Number(bform.placement_avg_weight_g) : null,
        placement_date: bform.placement_date,
        target_age_days: Number(bform.target_age_days) || 42,
        target_fcr: Number(bform.target_fcr) || 1.8,
        breed: bform.breed.trim() || null,
        supplier: bform.supplier.trim() || null,
      });
      setCreateOpen(false);
      setBform({ name: "", shed_id: "", placed_qty: "", placement_avg_weight_g: "",
        placement_date: today(), target_age_days: "42", target_fcr: "1.80", breed: "", supplier: "" });
      toast(tc({ en: "Batch created", hi: "बैच बनाया गया", bn: "ব্যাচ তৈরি হয়েছে" }), "success");
      load();
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setBbusy(false); }
  };

  /* Create shed */
  const createShed = async () => {
    if (!sform.name.trim()) return;
    setSbusy(true);
    try {
      await poultryApi.createShed(space.id, {
        name: sform.name.trim(),
        capacity: sform.capacity ? Number(sform.capacity) : null,
      });
      setShedOpen(false);
      setSform({ name: "", capacity: "" });
      toast(tc({ en: "Shed added", hi: "शेड जोड़ा गया", bn: "শেড যোগ হয়েছে" }), "success");
      load();
    } catch (err) {
      toast(err.message || tc({ en: "Failed", hi: "विफल", bn: "ব্যর্থ" }), "error");
    } finally { setSbusy(false); }
  };

  /* Shed dropdown options for the create-batch form */
  const shedOptions = [
    { label: tc({ en: "— No shed —", hi: "— शेड नहीं —", bn: "— কোনো শেড নেই —" }), value: "" },
    ...sheds.filter(s => s.status !== "archived").map(s => ({ label: s.name, value: s.id })),
  ];

  const title = tc({ en: "Poultry", hi: "मुर्गीपालन", bn: "হাঁস-মুরগি" });

  /* ── render states ───────────────────────────────────────────────────── */

  if (state === "loading") return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div>
    </>
  );

  if (state === "error") return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: 20 }}>
        <ErrorState body={farmErrorText(reason, tc)} onRetry={load} />
      </div>
    </>
  );

  const showAll = batches.filter(b => !["archived"].includes(b.status));

  return (
    <>
      <AppBar
        title={title}
        onBack={pop}
        action={canManage
          ? <button onClick={() => setCreateOpen(true)} style={{
              background: T.orange, color: "#fff", border: "none", borderRadius: T.rMd,
              padding: "6px 14px", fontFamily: T.body, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
            }}>
              + {tc({ en: "Batch", hi: "बैच", bn: "ব্যাচ" })}
            </button>
          : null}
      />

      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Summary row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatTile
            label={tc({ en: "Active batches", hi: "सक्रिय बैच", bn: "সক্রিয় ব্যাচ" })}
            value={activeCount} accent="primary"
          />
          <StatTile
            label={tc({ en: "Live birds", hi: "जीवित पक्षी", bn: "জীবিত পাখি" })}
            value={totalLiveBirds.toLocaleString("en-IN")} accent="orange"
          />
        </div>

        {/* Active/harvesting batches */}
        {activeBatches.length > 0 && (
          <Section title={tc({ en: "Active batches", hi: "सक्रिय बैच", bn: "সক্রিয় ব্যাচ" })}>
            {activeBatches.map(b => (
              <BatchCard key={b.id} batch={b} tc={tc} onTap={() =>
                push({ kind: "poultryBatchDetail", props: { batchId: b.id } })
              } />
            ))}
          </Section>
        )}

        {/* Draft batches */}
        {batches.filter(b => b.status === "draft").length > 0 && (
          <Section title={tc({ en: "Draft batches", hi: "ड्राफ़्ट बैच", bn: "ড্রাফ্ট ব্যাচ" })}>
            {batches.filter(b => b.status === "draft").map(b => (
              <BatchCard key={b.id} batch={b} tc={tc} onTap={() =>
                push({ kind: "poultryBatchDetail", props: { batchId: b.id } })
              } />
            ))}
          </Section>
        )}

        {/* Completed / closed */}
        {batches.filter(b => ["completed", "closed"].includes(b.status)).length > 0 && (
          <Section title={tc({ en: "Closed batches", hi: "बंद बैच", bn: "বন্ধ ব্যাচ" })}>
            {batches.filter(b => ["completed", "closed"].includes(b.status)).map(b => (
              <BatchCard key={b.id} batch={b} tc={tc} onTap={() =>
                push({ kind: "poultryBatchDetail", props: { batchId: b.id } })
              } />
            ))}
          </Section>
        )}

        {/* No batches */}
        {showAll.length === 0 && (
          <EmptyState
            icon="Bird"
            title={tc({ en: "No batches yet", hi: "अभी कोई बैच नहीं", bn: "এখনও কোনো ব্যাচ নেই" })}
            body={tc({ en: "Create a batch to start tracking your broiler flock.",
                        hi: "अपने ब्रायलर झुंड को ट्रैक करना शुरू करने के लिए एक बैच बनाएँ।",
                        bn: "আপনার ব্রয়লার ঝাঁক ট্র্যাক করতে একটি ব্যাচ তৈরি করুন।" })}
          />
        )}

        {/* Sheds */}
        <Section title={tc({ en: "Sheds", hi: "शेड", bn: "শেড" })}
          action={canManage ? (
            <button onClick={() => setShedOpen(true)}
              style={{ background: "none", border: "none", color: T.primary, fontFamily: T.body,
                fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
              + {tc({ en: "Add shed", hi: "शेड जोड़ें", bn: "শেড যোগ" })}
            </button>
          ) : null}>
          {sheds.filter(s => s.status !== "archived").length === 0
            ? <p style={{ margin: 0, fontSize: 13, color: T.inkSoft }}>
                {tc({ en: "No sheds yet", hi: "अभी कोई शेड नहीं", bn: "এখনও কোনো শেড নেই" })}
              </p>
            : <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {sheds.filter(s => s.status !== "archived").map(s => (
                  <div key={s.id} style={{ background: T.surface2, borderRadius: T.rMd,
                    padding: "6px 12px", fontSize: 13, color: T.ink }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    {s.capacity ? <span style={{ color: T.inkSoft }}> · {s.capacity.toLocaleString("en-IN")} cap</span> : null}
                  </div>
                ))}
              </div>
          }
        </Section>

      </div>

      {/* Create batch sheet */}
      <BottomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tc({ en: "New Batch", hi: "नया बैच", bn: "নতুন ব্যাচ" })}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Batch name *", hi: "बैच नाम *", bn: "ব্যাচের নাম *" })}
            value={bform.name} onChange={v => setBform(f => ({ ...f, name: v }))} />
          <Dropdown label={tc({ en: "Shed", hi: "शेड", bn: "শেড" })}
            value={bform.shed_id} onChange={v => setBform(f => ({ ...f, shed_id: v }))}
            options={shedOptions} />
          <Input label={tc({ en: "Birds placed *", hi: "रखे गए पक्षी *", bn: "স্থাপিত পাখি *" })}
            value={bform.placed_qty} onChange={v => setBform(f => ({ ...f, placed_qty: v }))} type="number" />
          <Input label={tc({ en: "Avg placement weight (g)", hi: "औसत वजन (g)", bn: "গড় ওজন (g)" })}
            value={bform.placement_avg_weight_g} onChange={v => setBform(f => ({ ...f, placement_avg_weight_g: v }))} type="number" />
          <Input label={tc({ en: "Placement date *", hi: "रखने की तारीख *", bn: "স্থাপনের তারিখ *" })}
            value={bform.placement_date} onChange={v => setBform(f => ({ ...f, placement_date: v }))} type="date" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label={tc({ en: "Target days", hi: "लक्ष्य दिन", bn: "লক্ষ্য দিন" })}
              value={bform.target_age_days} onChange={v => setBform(f => ({ ...f, target_age_days: v }))} type="number" />
            <Input label={tc({ en: "Target FCR", hi: "लक्ष्य FCR", bn: "লক্ষ্য FCR" })}
              value={bform.target_fcr} onChange={v => setBform(f => ({ ...f, target_fcr: v }))} type="number" />
          </div>
          <Input label={tc({ en: "Breed", hi: "नस्ल", bn: "জাত" })}
            value={bform.breed} onChange={v => setBform(f => ({ ...f, breed: v }))} />
          <Input label={tc({ en: "Supplier", hi: "आपूर्तिकर्ता", bn: "সরবরাহকারী" })}
            value={bform.supplier} onChange={v => setBform(f => ({ ...f, supplier: v }))} />
          <Button full onClick={createBatch}
            disabled={!bform.name.trim() || !bform.placed_qty || !bform.placement_date || bbusy}>
            {bbusy
              ? tc({ en: "Creating…", hi: "बना रहे हैं…", bn: "তৈরি হচ্ছে…" })
              : tc({ en: "Create batch", hi: "बैच बनाएँ", bn: "ব্যাচ তৈরি করুন" })}
          </Button>
        </div>
      </BottomSheet>

      {/* Create shed sheet */}
      <BottomSheet
        open={shedOpen}
        onClose={() => setShedOpen(false)}
        title={tc({ en: "New Shed", hi: "नया शेड", bn: "নতুন শেড" })}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" }}>
          <Input label={tc({ en: "Shed name *", hi: "शेड नाम *", bn: "শেডের নাম *" })}
            value={sform.name} onChange={v => setSform(f => ({ ...f, name: v }))} />
          <Input label={tc({ en: "Capacity (birds)", hi: "क्षमता (पक्षी)", bn: "ধারণক্ষমতা (পাখি)" })}
            value={sform.capacity} onChange={v => setSform(f => ({ ...f, capacity: v }))} type="number" />
          <Button full onClick={createShed} disabled={!sform.name.trim() || sbusy}>
            {sbusy
              ? tc({ en: "Adding…", hi: "जोड़ रहे हैं…", bn: "যোগ হচ্ছে…" })
              : tc({ en: "Add shed", hi: "शेड जोड़ें", bn: "শেড যোগ করুন" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

function Section({ title, action, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase",
          letterSpacing: 0.5 }}>{title}</div>
        {action}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function StatTile({ label, value, accent }) {
  return (
    <Card style={{ textAlign: "center", padding: "14px 12px" }}>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: T.display, color: statFg(accent) }}>
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>{label}</div>
    </Card>
  );
}

function BatchCard({ batch, tc, onTap }) {
  const meta = BATCH_STATUS[batch.status] || BATCH_STATUS.draft;
  const live = batch.live_birds ?? batch.placed_qty;

  return (
    <Card pad={0}>
      <button onClick={onTap} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "13px 12px", background: "none", border: "none",
        cursor: "pointer", fontFamily: T.body, textAlign: "left",
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid",
          placeItems: "center", background: T.orangeSoft, color: T.orange }}>
          <Icon name="Bird" size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, marginBottom: 2 }}>{batch.name}</div>
          <div style={{ fontSize: 12, color: T.inkSoft, display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
            {batch.shed_name && <span>{batch.shed_name}</span>}
            {batch.age_days != null && (
              <span>Day {batch.age_days}</span>
            )}
            <span>{live.toLocaleString("en-IN")} birds</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <Chip accent={meta.a}>{tc(meta.label)}</Chip>
          <Icon name="ChevronRight" size={16} style={{ color: T.inkFaint }} />
        </div>
      </button>
    </Card>
  );
}
