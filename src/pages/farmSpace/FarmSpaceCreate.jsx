import { useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Card, Button, Input, IconTile } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";
import { OPTIONAL_MODULES_ORDER, CORE_MODULES_ORDER, MODULE_CATALOG } from "./moduleCatalog.js";

/* Creating a Farm Space.
   Users enter basic details and choose what operations they manage.
   Only selected optional modules (plus core modules) will be initialized. */

export default function FarmSpaceCreate() {
  const { pop, tc, toast } = useApp();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [selectedModules, setSelectedModules] = useState([]);
  const [busy, setBusy] = useState(false);

  const toggleModule = (id) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await farmSpaceService.create({
        name: name.trim(),
        location: location.trim() || undefined,
        orderedModuleIds: [...CORE_MODULES_ORDER, ...selectedModules],
      });
      toast(tc({ en: "Farm Space created.", hi: "फ़ार्म स्पेस बन गया।", bn: "ফার্ম স্পেস তৈরি হয়েছে।" }), "success");
      pop();
    } catch (err) {
      toast(farmErrorText(err?.reason, tc), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppBar title={tc({ en: "New Farm Space", hi: "नया फ़ार्म स्पेस", bn: "নতুন ফার্ম স্পেস" })} onBack={pop} />
      <div style={{ padding: "4px 16px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input
            label={tc({ en: "Farm name", hi: "फ़ार्म का नाम", bn: "খামারের নাম" })}
            placeholder={tc({ en: "e.g. AgriOS Farm", hi: "उदा. AgriOS फ़ार्म", bn: "যেমন AgriOS খামার" })}
            value={name}
            onChange={setName}
            maxLength={80}
          />
          <Input
            label={tc({ en: "Location (optional)", hi: "स्थान (वैकल्पिक)", bn: "অবস্থান (ঐচ্ছিক)" })}
            placeholder={tc({ en: "Village or district", hi: "गाँव या ज़िला", bn: "গ্রাম বা জেলা" })}
            value={location}
            onChange={setLocation}
            maxLength={200}
          />
        </Card>

        {/* What do you manage? */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 4 }}>
            {tc({ en: "What do you manage?", hi: "आप क्या प्रबंधित करते हैं?", bn: "আপনি কী পরিচালনা করেন?" })}
          </div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 12 }}>
            {tc({
              en: "Select the operational modules you need. You can always change these later.",
              hi: "अपनी आवश्यकतानुसार मॉड्यूल चुनें। इन्हें बाद में भी बदला जा सकता है।",
              bn: "আপনার প্রয়োজনীয় মডিউলগুলি নির্বাচন করুন। আপনি পরে এগুলি পরিবর্তন করতে পারেন।",
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {OPTIONAL_MODULES_ORDER.map((id) => {
              const def = MODULE_CATALOG[id];
              if (!def) return null;
              const isSelected = selectedModules.includes(id);

              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => toggleModule(id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1.5px solid ${isSelected ? T.primary : T.border}`,
                    background: isSelected ? T.primarySoft || "#f0fdf4" : T.surface,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <IconTile name={def.icon} accent={def.a} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tc(def.label)}
                    </div>
                    <div style={{ fontSize: 11, color: isSelected ? T.primary : T.inkFaint }}>
                      {isSelected ? "✓ Active" : "+ Add"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.6 }}>
          {tc({
            en: "You'll be the owner. Invite your team afterwards — they'll see the farm's tasks, attendance and announcements, and nothing from your personal account.",
            hi: "आप मालिक होंगे। बाद में टीम को बुलाएँ — उन्हें फ़ार्म के कार्य, उपस्थिति और घोषणाएँ दिखेंगी, आपके निजी खाते से कुछ नहीं।",
            bn: "আপনি মালিক হবেন। পরে দলকে ডাকুন — তারা খামারের কাজ, উপস্থিতি ও ঘোষণা দেখবে, আপনার ব্যক্তিগত অ্যাকাউন্টের কিছু নয়।",
          })}
        </div>

        <Button full onClick={submit} disabled={busy || !name.trim()}>
          {busy
            ? tc({ en: "Creating…", hi: "बन रहा है…", bn: "তৈরি হচ্ছে…" })
            : tc({ en: "Create Farm Space", hi: "फ़ार्म स्पेस बनाएँ", bn: "ফার্ম স্পেস তৈরি করুন" })}
        </Button>
      </div>
    </>
  );
}
