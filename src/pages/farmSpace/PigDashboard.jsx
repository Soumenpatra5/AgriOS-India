import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Chip, Input, Dropdown,
  EmptyState, ErrorState, Spinner, BottomSheet,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { pigApi } from "../../services/pig/pigApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_CFG = {
  piglet:   { label: { en: "Piglet",   hi: "सूअर का बच्चा", bn: "শূকরছানা"    }, fg: T.primary,  bg: T.primarySoft },
  grower:   { label: { en: "Grower",   hi: "बढ़ता",          bn: "বেড়ে ওঠা"    }, fg: T.orange,   bg: "#fff3e8"      },
  finisher: { label: { en: "Finisher", hi: "फिनिशर",         bn: "ফিনিশার"      }, fg: "#7a5a1a",  bg: "#f8f0d8"      },
  breeder:  { label: { en: "Breeder",  hi: "प्रजनक",         bn: "প্রজনকারী"    }, fg: "#9b59b6",  bg: "#f4eef9"      },
  sold:     { label: { en: "Sold",     hi: "बेचा",           bn: "বিক্রিত"      }, fg: "#6b6b6b",  bg: "#f0f0f0"      },
  deceased: { label: { en: "Deceased", hi: "मृत",            bn: "মৃত"           }, fg: "#6b6b6b",  bg: "#f0f0f0"      },
  retired:  { label: { en: "Retired",  hi: "सेवानिवृत्त",   bn: "অবসরপ্রাপ্ত"  }, fg: "#6b6b6b",  bg: "#f0f0f0"      },
};

const FILTER_TABS = [
  { id: "",         label: { en: "All",      hi: "सभी",            bn: "সব"         } },
  { id: "piglet",   label: { en: "Piglet",   hi: "सूअर का बच्चा", bn: "শূকরছানা"   } },
  { id: "grower",   label: { en: "Grower",   hi: "बढ़ता",          bn: "বেড়ে ওঠা"   } },
  { id: "finisher", label: { en: "Finisher", hi: "फिनिशर",         bn: "ফিনিশার"    } },
  { id: "breeder",  label: { en: "Breeder",  hi: "प्रजनक",         bn: "প্রজনকারী"  } },
];

const BREEDS = [
  { value: "Yorkshire",   label: { en: "Yorkshire",   hi: "यॉर्कशायर",       bn: "ইয়র্কশায়ার"    } },
  { value: "Landrace",    label: { en: "Landrace",    hi: "लैंडरेस",         bn: "ল্যান্ড্রেস"    } },
  { value: "Duroc",       label: { en: "Duroc",       hi: "ड्यूरोक",          bn: "ডুরোক"         } },
  { value: "Hampshire",   label: { en: "Hampshire",   hi: "हैम्पशायर",        bn: "হ্যাম্পশায়ার"   } },
  { value: "Berkshire",   label: { en: "Berkshire",   hi: "बर्कशायर",        bn: "বার্কশায়ার"     } },
  { value: "Ghungroo",    label: { en: "Ghungroo",    hi: "घुंगरू",           bn: "ঘুংরু"          } },
  { value: "Agonda Goan", label: { en: "Agonda Goan", hi: "अगोंडा गोवा",     bn: "আগোন্ডা গোয়ান"  } },
  { value: "Desi / Local",label: { en: "Desi / Local",hi: "देसी / स्थानीय",  bn: "দেশি / স্থানীয়" } },
  { value: "Mixed",       label: { en: "Mixed",       hi: "मिश्रित",          bn: "মিশ্র"          } },
  { value: "Other",       label: { en: "Other",       hi: "अन्य",             bn: "অন্যান্য"       } },
];

const SEX_LABEL = {
  boar:    { en: "Boar",    hi: "सांड",           bn: "বরাহ"          },
  sow:     { en: "Sow",     hi: "सुअरी",          bn: "শূকরী"         },
  gilt:    { en: "Gilt",    hi: "जवान सुअरी",      bn: "তরুণ শূকরী"   },
  barrow:  { en: "Barrow",  hi: "बधिया",          bn: "বন্ধ্যা নর"    },
  unknown: { en: "Unknown", hi: "अज्ञात",          bn: "অজানা"         },
};

function StatusChip({ status, tc }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.piglet;
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, fontFamily: T.body,
      color: cfg.fg, background: cfg.bg,
      borderRadius: 5, padding: "2px 7px", letterSpacing: 0.3,
    }}>
      {tc(cfg.label)}
    </span>
  );
}

function MetricTile({ value, label, icon, accent }) {
  const fg = accent === "primary" ? T.primary : accent === "blue" ? T.blue : T.orange;
  const bg = accent === "primary" ? T.primarySoft : accent === "blue" ? T.blueSoft : "#fff3e8";
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, background: bg, borderRadius: T.rMd, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon name={icon} size={14} color={fg} />
        <span style={{ fontSize: 10.5, color: fg, fontWeight: 600, fontFamily: T.body }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: fg, fontFamily: T.display, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function AnimalCard({ animal, tc, onPress }) {
  const cfg = STATUS_CFG[animal.current_status] || STATUS_CFG.piglet;
  const sexLabel = tc(SEX_LABEL[animal.sex] || SEX_LABEL.unknown);

  return (
    <Card pad={0}>
      <button
        onClick={onPress}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "13px 14px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left", fontFamily: T.body }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: cfg.bg, display: "grid", placeItems: "center" }}>
          <Icon name="PiggyBank" size={20} color={cfg.fg} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>{animal.name}</span>
            <StatusChip status={animal.current_status} tc={tc} />
            {animal.overdue_count > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: T.red, background: T.redSoft,
                borderRadius: 5, padding: "1px 6px", whiteSpace: "nowrap" }}>
                {tc({ en: `${animal.overdue_count} overdue`, hi: `${animal.overdue_count} बकाया`, bn: `${animal.overdue_count} বকেয়া` })}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
            {sexLabel}
            {animal.breed ? ` · ${animal.breed}` : ""}
            {animal.tag_id ? ` · #${animal.tag_id}` : ""}
          </div>
        </div>
        <Icon name="ChevronRight" size={16} color={T.line} />
      </button>
    </Card>
  );
}

export default function PigDashboard() {
  const { pop, push, tc, toast } = useApp();

  const [space,   setSpace]   = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [filter,  setFilter]  = useState("");
  const [state,   setState]   = useState("loading");
  const [reason,  setReason]  = useState(null);

  const [finSummary, setFinSummary] = useState(null);
  const [finState,   setFinState]   = useState("idle");

  const [addOpen, setAddOpen] = useState(false);
  const blankAform = () => ({
    name: "", sex: "unknown", breed: "", tagId: "", dob: "",
    acquisitionDate: today(), acquisitionSource: "", currentStatus: "piglet", notes: "",
  });
  const [aform, setAform] = useState(blankAform);
  const [abusy, setAbusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      const [m, list] = await Promise.all([
        pigApi.herdMetrics(active.id),
        pigApi.listAnimals(active.id, { includeTerminal: false }),
      ]);
      setMetrics(m);
      setAnimals(list || []);
      setState("ready");
      if (farmSpaceService.can(active, "farm.pig.finance")) {
        setFinState("loading");
        pigApi.financeSummary(active.id)
          .then((d) => { setFinSummary(d); setFinState("ready"); })
          .catch(() => setFinState("error"));
      }
    } catch (err) {
      if (state !== "ready") { setReason(err?.reason || FARM_ERROR.FAILED); setState("error"); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const canManage  = space && farmSpaceService.can(space, "farm.pig.manage");
  const canFinance = space && farmSpaceService.can(space, "farm.pig.finance");

  const filtered = filter ? animals.filter((a) => a.current_status === filter) : animals;

  const addAnimal = async () => {
    if (!aform.name.trim()) return;
    setAbusy(true);
    try {
      const animal = await pigApi.createAnimal(space.id, {
        name: aform.name.trim(),
        sex: aform.sex,
        breed: aform.breed || null,
        tagId: aform.tagId || null,
        dob: aform.dob || null,
        acquisitionDate: aform.acquisitionDate || null,
        acquisitionSource: aform.acquisitionSource || null,
        currentStatus: aform.currentStatus,
        notes: aform.notes || null,
      });
      setAnimals((prev) => [animal, ...prev]);
      setAddOpen(false);
      setAform(blankAform());
      toast(tc({ en: "Animal added", hi: "पशु जोड़ा गया", bn: "প্রাণী যোগ হয়েছে" }), "success");
      pigApi.herdMetrics(space.id).then(setMetrics).catch(() => {});
    } catch (err) {
      toast(err.message || tc({ en: "Failed to add animal", hi: "पशु नहीं जोड़ा जा सका", bn: "প্রাণী যোগ করা যায়নি" }), "error");
    } finally {
      setAbusy(false);
    }
  };

  const bar = (
    <AppBar
      title={tc({ en: "Pig & Swine Herd", hi: "सूअर पशु पालन", bn: "শূকর পালন" })}
      onBack={pop}
      action={canManage && (
        <button
          onClick={() => setAddOpen(true)}
          style={{ background: T.primary, border: "none", borderRadius: 12, padding: "8px 13px",
            cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
            fontFamily: T.body, fontSize: 13, fontWeight: 600 }}>
          <Icon name="Plus" size={15} color="#fff" />
          {tc({ en: "Add", hi: "जोड़ें", bn: "যোগ" })}
        </button>
      )}
    />
  );

  if (state === "loading") return <>{bar}<div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  if (state === "error")   return <>{bar}<div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;

  const totalAnimals = Object.values(metrics?.status_counts || {}).reduce((s, n) => s + n, 0);

  return (
    <>
      {bar}

      {/* Metrics strip */}
      {metrics && (
        <div style={{ display: "flex", gap: 8, padding: "10px 16px 0" }}>
          <MetricTile
            value={totalAnimals}
            label={tc({ en: "Animals", hi: "पशु", bn: "প্রাণী" })}
            icon="PiggyBank" accent="primary" />
          <MetricTile
            value={metrics.month_avg_weight_kg != null && metrics.month_animals_weighed > 0
              ? `${Number(metrics.month_avg_weight_kg).toFixed(1)} kg`
              : "—"}
            label={tc({ en: "Avg weight", hi: "औसत वज़न", bn: "গড় ওজন" })}
            icon="Weight" accent="blue" />
          <MetricTile
            value={metrics.farrowing_expected_count ?? 0}
            label={tc({ en: "Farrowing", hi: "प्रसव", bn: "প্রসব" })}
            icon="Baby" accent="orange" />
        </div>
      )}

      {/* Health overdue alert */}
      {metrics?.health_overdue_count > 0 && (
        <div style={{ margin: "8px 16px 0", background: T.redSoft, borderRadius: T.rMd,
          padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="AlertTriangle" size={15} color={T.red} />
          <span style={{ fontSize: 12.5, color: T.red, fontWeight: 600, fontFamily: T.body }}>
            {tc({
              en: `${metrics.health_overdue_count} health event${metrics.health_overdue_count > 1 ? "s" : ""} overdue`,
              hi: `${metrics.health_overdue_count} स्वास्थ्य घटना अतिदेय`,
              bn: `${metrics.health_overdue_count}টি স্বাস্থ্য ঘটনার মেয়াদ পেরিয়েছে`,
            })}
          </span>
        </div>
      )}

      {/* Health due soon alert */}
      {metrics?.health_due_in_14_days > 0 && (
        <div style={{ margin: "8px 16px 0", background: "#fff3e8", borderRadius: T.rMd,
          padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="Bell" size={15} color={T.orange} />
          <span style={{ fontSize: 12.5, color: T.orange, fontWeight: 600, fontFamily: T.body }}>
            {tc({
              en: `${metrics.health_due_in_14_days} health event${metrics.health_due_in_14_days > 1 ? "s" : ""} due in 14 days`,
              hi: `14 दिन में ${metrics.health_due_in_14_days} स्वास्थ्य घटना देय`,
              bn: `14 দিনে ${metrics.health_due_in_14_days}টি স্বাস্থ্য ঘটনা দেয়`,
            })}
          </span>
        </div>
      )}

      {/* Farrowing expected alert */}
      {metrics?.farrowing_expected_count > 0 && (
        <div style={{ margin: "8px 16px 0", background: T.blueSoft, borderRadius: T.rMd,
          padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="Heart" size={15} color={T.blue} />
          <span style={{ fontSize: 12.5, color: T.blue, fontWeight: 600, fontFamily: T.body }}>
            {tc({
              en: `${metrics.farrowing_expected_count} sow${metrics.farrowing_expected_count > 1 ? "s" : ""} confirmed pregnant this month`,
              hi: `इस माह ${metrics.farrowing_expected_count} सुअरी गर्भवती`,
              bn: `এ মাসে ${metrics.farrowing_expected_count}টি শূকরী গর্ভবতী নিশ্চিত`,
            })}
          </span>
        </div>
      )}

      {/* Finance summary card */}
      {canFinance && (
        <div style={{ margin: "10px 16px 0" }}>
          <button
            onClick={() => push({ kind: "pigFinance" })}
            style={{ width: "100%", background: T.surface, border: `1px solid ${T.line}`,
              borderRadius: T.rMd, padding: "12px 14px", cursor: "pointer",
              textAlign: "left", display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, fontFamily: T.body,
                textTransform: "uppercase", letterSpacing: 0.8 }}>
                {tc({ en: "Finance · this month", hi: "वित्त · इस माह", bn: "অর্থ · এই মাস" })}
              </span>
              <Icon name="ChevronRight" size={15} color={T.inkFaint} />
            </div>
            {finState === "loading" && <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}><Spinner size={16} /></div>}
            {finState === "error"   && <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.body }}>{tc({ en: "Finance unavailable", hi: "वित्त उपलब्ध नहीं", bn: "অর্থ পাওয়া যাচ্ছে না" })}</div>}
            {finState === "ready" && finSummary && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: tc({ en: "Revenue", hi: "आय",        bn: "রাজস্ব"  }), value: `₹${Number(finSummary.total_revenue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: T.primary },
                  { label: tc({ en: "Costs",   hi: "लागत",      bn: "খরচ"     }), value: `₹${Number(finSummary.total_costs).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,   color: T.orange  },
                  { label: tc({ en: "Net P&L", hi: "शुद्ध लाभ", bn: "নিট লাভ" }), value: `₹${Number(finSummary.net_profit).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,   color: finSummary.net_profit >= 0 ? T.primary : T.red },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: T.surface2, borderRadius: T.rSm, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: T.inkFaint, fontWeight: 600, fontFamily: T.body, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: T.display }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </button>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 4px", overflowX: "auto" }}>
        {FILTER_TABS.map((ft) => (
          <Chip key={ft.id} active={filter === ft.id} onClick={() => setFilter(ft.id)}>
            {tc(ft.label)}
          </Chip>
        ))}
      </div>

      {/* Animal list */}
      <div style={{ padding: "6px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="PiggyBank"
            title={tc({ en: "No pigs", hi: "कोई सूअर नहीं", bn: "কোনো শূকর নেই" })}
            body={canManage
              ? tc({ en: "Tap + Add to register your first pig.", hi: "पहला सूअर जोड़ने के लिए + जोड़ें दबाएँ।", bn: "প্রথম শূকর নিবন্ধন করতে + যোগ চাপুন।" })
              : tc({ en: "The herd is empty.", hi: "झुंड खाली है।", bn: "পাল খালি।" })}
          />
        ) : (
          filtered.map((animal) => (
            <AnimalCard key={animal.id} animal={animal} tc={tc} onPress={() =>
              push({ kind: "pigAnimalDetail", props: { animalId: animal.id, spaceId: space.id } })
            } />
          ))
        )}
      </div>

      {/* Add animal sheet */}
      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={tc({ en: "Add Pig", hi: "सूअर जोड़ें", bn: "শূকর যোগ করুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label={tc({ en: "Name / ID", hi: "नाम / आईडी", bn: "নাম / আইডি" })}
            placeholder={tc({ en: "e.g. Kala", hi: "उदा. काला", bn: "যেমন কালা" })}
            value={aform.name}
            onChange={(v) => setAform((f) => ({ ...f, name: v }))} />
          <Dropdown
            label={tc({ en: "Sex", hi: "लिंग", bn: "লিঙ্গ" })}
            value={aform.sex}
            onChange={(v) => setAform((f) => ({ ...f, sex: v }))}
            options={[
              { value: "sow",     label: tc({ en: "Sow (adult female)",  hi: "सुअरी (वयस्क मादा)",  bn: "শূকরী (প্রাপ্তবয়স্ক মাদি)" }) },
              { value: "boar",    label: tc({ en: "Boar (adult male)",   hi: "सांड (वयस्क नर)",     bn: "বরাহ (প্রাপ্তবয়স্ক পুরুষ)" }) },
              { value: "gilt",    label: tc({ en: "Gilt (young female)", hi: "जवान सुअरी",           bn: "তরুণ শূকরী"                }) },
              { value: "barrow",  label: tc({ en: "Barrow (castrated)",  hi: "बधिया नर",             bn: "বন্ধ্যা নর"               }) },
              { value: "unknown", label: tc({ en: "Unknown",             hi: "अज्ञात",               bn: "অজানা"                    }) },
            ]} />
          <Dropdown
            label={tc({ en: "Breed (optional)", hi: "नस्ल (वैकल्पिक)", bn: "জাত (ঐচ্ছিক)" })}
            value={aform.breed}
            onChange={(v) => setAform((f) => ({ ...f, breed: v }))}
            options={[
              { value: "", label: tc({ en: "Unknown / Mixed", hi: "अज्ञात / मिश्रित", bn: "অজানা / মিশ্র" }) },
              ...BREEDS.map((b) => ({ value: b.value, label: tc(b.label) })),
            ]} />
          <Input
            label={tc({ en: "Tag / Ear number (optional)", hi: "टैग / कान नंबर (वैकल्पिक)", bn: "ট্যাগ / কান নম্বর (ঐচ্ছিক)" })}
            placeholder="e.g. 007"
            value={aform.tagId}
            onChange={(v) => setAform((f) => ({ ...f, tagId: v }))} />
          <Dropdown
            label={tc({ en: "Current status", hi: "वर्तमान स्थिति", bn: "বর্তমান অবস্থা" })}
            value={aform.currentStatus}
            onChange={(v) => setAform((f) => ({ ...f, currentStatus: v }))}
            options={[
              { value: "piglet",   label: tc({ en: "Piglet",   hi: "सूअर का बच्चा", bn: "শূকরছানা"   }) },
              { value: "grower",   label: tc({ en: "Grower",   hi: "बढ़ता",          bn: "বেড়ে ওঠা"   }) },
              { value: "finisher", label: tc({ en: "Finisher", hi: "फिनिशर",         bn: "ফিনিশার"    }) },
              { value: "breeder",  label: tc({ en: "Breeder",  hi: "प्रजनक",         bn: "প্রজনকারী"  }) },
            ]} />
          <Input
            label={tc({ en: "Date of birth (optional)", hi: "जन्म तिथि (वैकल्पिक)", bn: "জন্ম তারিখ (ঐচ্ছিক)" })}
            type="date"
            value={aform.dob}
            onChange={(v) => setAform((f) => ({ ...f, dob: v }))} />
          <Input
            label={tc({ en: "Acquisition date", hi: "प्राप्ति तिथि", bn: "অধিগ্রহণের তারিখ" })}
            type="date"
            value={aform.acquisitionDate}
            onChange={(v) => setAform((f) => ({ ...f, acquisitionDate: v }))} />
          <Input
            label={tc({ en: "Notes (optional)", hi: "टिप्पणी (वैकल्पिक)", bn: "মন্তব্য (ঐচ্ছিক)" })}
            placeholder={tc({ en: "Any notes about this animal", hi: "इस पशु के बारे में टिप्पणी", bn: "এই প্রাণী সম্পর্কে মন্তব্য" })}
            value={aform.notes}
            onChange={(v) => setAform((f) => ({ ...f, notes: v }))} />
          <Button full onClick={addAnimal} disabled={!aform.name.trim() || abusy}>
            {abusy
              ? tc({ en: "Adding…", hi: "जोड़ा जा रहा है…", bn: "যোগ হচ্ছে…" })
              : tc({ en: "Add Pig", hi: "सूअर जोड़ें", bn: "শূকর যোগ করুন" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
