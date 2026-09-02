import { useState } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import { AppBar, Card, Button, Input } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService } from "../../services/farmSpace/farmSpaceService.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

/* Creating a Farm Space.

   Deliberately a separate thing from creating a farm in the ERP. A farm record
   describes land the user manages; a Farm Space is a group of people who work
   on it together. Merging them would mean every farm a solo farmer creates
   quietly becomes a shared workspace, so the two stay distinct and may be
   linked later. */

export default function FarmSpaceCreate() {
  const { pop, tc, toast } = useApp();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await farmSpaceService.create({ name: name.trim(), location: location.trim() || undefined });
      toast(tc({ en: "Farm Space created.", hi: "फ़ार्म स्पेस बन गया।", bn: "ফার্ম স্পেস তৈরি হয়েছে।" }), "success");
      pop();
    } catch (err) {
      /* Keep the form intact so a name typed on a weak connection is not lost
         to a failed request. */
      toast(farmErrorText(err?.reason, tc), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppBar title={tc({ en: "New Farm Space", hi: "नया फ़ार्म स्पेस", bn: "নতুন ফার্ম স্পেস" })} onBack={pop} />
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label={tc({ en: "Farm name", hi: "फ़ार्म का नाम", bn: "খামারের নাম" })}
            placeholder={tc({ en: "e.g. AgriOS Farm", hi: "उदा. AgriOS फ़ार्म", bn: "যেমন AgriOS খামার" })}
            value={name} onChange={setName} maxLength={80} />
          <Input label={tc({ en: "Location (optional)", hi: "स्थान (वैकल्पिक)", bn: "অবস্থান (ঐচ্ছিক)" })}
            placeholder={tc({ en: "Village or district", hi: "गाँव या ज़िला", bn: "গ্রাম বা জেলা" })}
            value={location} onChange={setLocation} maxLength={200} />
        </Card>

        <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.6 }}>
          {tc({ en: "You'll be the owner. Invite your team afterwards — they'll see the farm's tasks, attendance and announcements, and nothing from your personal account.",
                hi: "आप मालिक होंगे। बाद में टीम को बुलाएँ — उन्हें फ़ार्म के कार्य, उपस्थिति और घोषणाएँ दिखेंगी, आपके निजी खाते से कुछ नहीं।",
                bn: "আপনি মালিক হবেন। পরে দলকে ডাকুন — তারা খামারের কাজ, উপস্থিতি ও ঘোষণা দেখবে, আপনার ব্যক্তিগত অ্যাকাউন্টের কিছু নয়।" })}
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
