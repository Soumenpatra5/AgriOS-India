/* DPR Generator — the list of a farmer's project reports, and the entry point
   for starting a new one from a model template. */

import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, SectionHeader, EmptyState, BottomSheet, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import Restricted from "../../components/Restricted.jsx";
import { dprService, draftFrom, project as computeProject } from "../../services/business/dpr/dprService.js";
import { DPR_MODELS } from "../../services/business/dpr/dprConstants.js";
import { farmService } from "../../services/farm/farmService.js";
import { rupee, compact } from "../../utils/format.js";

const H_PAD = 16;

const MODEL_ICON = {
  dairy: "Rabbit", broiler: "Bird", goat: "Rabbit",
  fishery: "Fish", orchard: "Sprout", custom: "FileText",
};

export const VERDICT_STYLE = {
  strong:     { label: { en: "Strong",     hi: "मज़बूत",     bn: "শক্তিশালী" }, color: "primary" },
  viable:     { label: { en: "Viable",     hi: "व्यवहार्य",   bn: "কার্যকর"   }, color: "blue" },
  weak:       { label: { en: "Weak",       hi: "कमज़ोर",     bn: "দুর্বল"    }, color: "red" },
  incomplete: { label: { en: "Incomplete", hi: "अधूरा",      bn: "অসম্পূর্ণ" }, color: "yellow" },
};

export function VerdictChip({ level, tc }) {
  const v = VERDICT_STYLE[level] || VERDICT_STYLE.incomplete;
  return (
    <span style={{ padding: "3px 9px", borderRadius: T.pill, fontSize: 11, fontWeight: 700,
      background: T[`${v.color}Soft`], color: T[v.color] }}>
      {tc(v.label)}
    </span>
  );
}

export default function DprGenerator() {
  const { pop, push, tc, can, user, toast } = useApp();
  const [list, setList]       = useState(null);
  const [picking, setPicking] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => setList(await dprService.list()), []);
  useEffect(() => { load(); }, [load]);

  const startNew = async (modelId) => {
    setPicking(false);
    const farm = await farmService.getActive?.().catch(() => null);
    const created = await dprService.create(draftFrom(modelId, { farm, user }));
    push({ kind: "dprEditor", props: { id: created.id } });
  };

  const doDelete = async () => {
    const target = confirm;
    setConfirm(null);
    await dprService.remove(target.id);
    toast(tc({ en: "Report deleted", hi: "रिपोर्ट हटाई गई", bn: "রিপোর্ট মোছা হয়েছে" }), "info");
    load();
  };

  const title = tc({ en: "DPR Generator", hi: "डीपीआर जनरेटर", bn: "ডিপিআর জেনারেটর" });

  if (!can("finance.view")) return (<><AppBar title={title} onBack={pop} /><Restricted tc={tc} /></>);

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: `8px ${H_PAD}px 32px`, display: "flex", flexDirection: "column", gap: 14,
        animation: "ag-fade .25s var(--ag-ease)" }}>

        {/* What this is for */}
        <Card pad={14} style={{ background: T.primarySoft, border: "none" }}>
          <div style={{ display: "flex", gap: 11 }}>
            <Icon name="Landmark" size={20} color={T.primary} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.primary, marginBottom: 3 }}>
                {tc({ en: "Bank-ready project reports",
                      hi: "बैंक के लिए तैयार प्रोजेक्ट रिपोर्ट",
                      bn: "ব্যাঙ্কের জন্য প্রস্তুত প্রকল্প রিপোর্ট" })}
              </div>
              <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.5 }}>
                {tc({
                  en: "Build a Detailed Project Report for a term loan — cost of project, means of finance, repayment schedule and viability ratios. Print it or export to Excel.",
                  hi: "टर्म लोन के लिए विस्तृत परियोजना रिपोर्ट बनाएँ — परियोजना लागत, वित्त के स्रोत, चुकौती अनुसूची और व्यवहार्यता अनुपात। प्रिंट करें या Excel में निर्यात करें।",
                  bn: "টার্ম লোনের জন্য বিস্তারিত প্রকল্প রিপোর্ট তৈরি করুন — প্রকল্প ব্যয়, অর্থের উৎস, পরিশোধ সূচি ও কার্যকারিতা অনুপাত। প্রিন্ট করুন বা Excel-এ রপ্তানি করুন।",
                })}
              </div>
            </div>
          </div>
        </Card>

        <Button full icon="Plus" onClick={() => setPicking(true)}>
          {tc({ en: "New project report", hi: "नई प्रोजेक्ट रिपोर्ट", bn: "নতুন প্রকল্প রিপোর্ট" })}
        </Button>

        {list === null ? null : list.length === 0 ? (
          <EmptyState
            icon="FileText"
            title={tc({ en: "No project reports yet", hi: "अभी कोई रिपोर्ट नहीं", bn: "এখনও কোনও রিপোর্ট নেই" })}
            body={tc({
              en: "Start one from a template — dairy, poultry, goat, fish or orchard — then edit every figure to match your own costs.",
              hi: "एक टेम्पलेट से शुरू करें — डेयरी, पोल्ट्री, बकरी, मछली या बाग — फिर हर आँकड़ा अपनी लागत के अनुसार बदलें।",
              bn: "একটি টেমপ্লেট থেকে শুরু করুন — ডেয়ারি, পোলট্রি, ছাগল, মাছ বা বাগান — তারপর প্রতিটি সংখ্যা নিজের খরচ অনুযায়ী বদলান।",
            })}
          />
        ) : (
          <>
            <SectionHeader title={tc({ en: "Your reports", hi: "आपकी रिपोर्ट", bn: "আপনার রিপোর্ট" })} />
            {list.map((d) => {
              const c = computeProject(d);
              return (
                <Card key={d.id} pad={14} onClick={() => push({ kind: "dprEditor", props: { id: d.id } })}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: T.surface2,
                      display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Icon name={MODEL_ICON[d.modelId] || "FileText"} size={18} color={T.primary} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.project?.title || d.name}
                        </div>
                        <VerdictChip level={c.verdict.level} tc={tc} />
                      </div>
                      <div style={{ fontSize: 11.5, color: T.inkSoft }}>
                        {d.units} {d.unitLabel}{d.units === 1 ? "" : "s"} · {compact(c.totalCapital)} {tc({ en: "project cost", hi: "परियोजना लागत", bn: "প্রকল্প ব্যয়" })}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
                        {tc({ en: "Loan", hi: "ऋण", bn: "ঋণ" })} {rupee(c.means.loan)}
                        {typeof c.viability.avgDscr === "number" && ` · DSCR ${c.viability.avgDscr.toFixed(2)}`}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirm(d); }}
                      aria-label={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
                      style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: T.inkFaint }}>
                      <Icon name="Trash2" size={16} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </>
        )}
      </div>

      {/* Model picker */}
      <BottomSheet open={picking} onClose={() => setPicking(false)}
        title={tc({ en: "Choose a project type", hi: "परियोजना प्रकार चुनें", bn: "প্রকল্পের ধরন বাছুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DPR_MODELS.map((m) => (
            <Card key={m.id} pad={13} onClick={() => startNew(m.id)}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: T.primarySoft,
                  display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon name={MODEL_ICON[m.id] || "FileText"} size={17} color={T.primary} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{m.label}</div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft }}>{m.unitHint}</div>
                </div>
                <Icon name="ChevronRight" size={16} color={T.inkFaint} />
              </div>
            </Card>
          ))}
        </div>
      </BottomSheet>

      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        danger
        icon="Trash2"
        title={tc({ en: "Delete this report?", hi: "यह रिपोर्ट हटाएँ?", bn: "এই রিপোর্ট মুছবেন?" })}
        body={confirm?.project?.title || confirm?.name}
        confirmLabel={tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
        cancelLabel={tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" })}
        onConfirm={doDelete}
      />
    </>
  );
}
