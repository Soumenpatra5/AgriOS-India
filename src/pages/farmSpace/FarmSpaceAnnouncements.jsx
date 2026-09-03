import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, Input, Dropdown, EmptyState, ErrorState, Spinner, BottomSheet } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmSpaceApi } from "../../services/farmSpace/farmSpaceApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

/* Farm announcements — notices every member of the space reads.

   Read by every role, written by managers and above. The kind is not
   decoration: an emergency notice and a meeting reminder want to be told apart
   at a glance by someone holding a phone in a field. */

const KINDS = {
  notice:      { icon: "Megaphone",   a: "primary", label: { en: "Notice",      hi: "सूचना",       bn: "বিজ্ঞপ্তি" } },
  meeting:     { icon: "Users",       a: "blue",    label: { en: "Meeting",     hi: "बैठक",        bn: "সভা" } },
  vaccination: { icon: "Syringe",     a: "blue",    label: { en: "Vaccination", hi: "टीकाकरण",     bn: "টিকাকরণ" } },
  weather:     { icon: "CloudRain",   a: "orange",  label: { en: "Weather",     hi: "मौसम",        bn: "আবহাওয়া" } },
  emergency:   { icon: "AlertCircle", a: "red",     label: { en: "Emergency",   hi: "आपातकाल",     bn: "জরুরি" } },
};
const TONE = {
  primary: [T.primary, T.primarySoft], blue: [T.blue, T.blueSoft],
  orange: [T.orange, T.orangeSoft], red: [T.red, T.redSoft],
};

export default function FarmSpaceAnnouncements() {
  const { pop, tc, toast } = useApp();
  const [space, setSpace] = useState(null);
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ message: "", kind: "notice" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);

      const cached = farmSpaceService.peekAnnouncements(active.id);
      let paintedFromCache = false;
      if (cached) {
        setItems(cached);
        setState("ready");
        paintedFromCache = true;
      } else {
        setState("loading");
      }

      try {
        setItems(await farmSpaceService.announcements(active.id, { fresh: true }));
        setState("ready");
      } catch (err) {
        /* A cache that is truthy but genuinely empty must not let a failing
           background refresh hide behind it silently — see FarmSpaceTasks.jsx
           for the full reasoning. */
        if (!paintedFromCache) throw err;
        toast(farmErrorText(err?.reason, tc), "error");
      }
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, [tc, toast]);

  useEffect(() => { load(); }, [load]);

  const canPost = farmSpaceService.can(space, "farm.announcement.create");

  const post = async () => {
    if (!form.message.trim() || busy) return;
    setBusy(true);
    try {
      const created = await farmSpaceApi.createAnnouncement(space.id, {
        message: form.message.trim(), kind: form.kind,
      });
      setItems((l) => [created, ...l]);
      farmSpaceService.prependAnnouncement(space.id, created);
      setOpen(false); setForm({ message: "", kind: "notice" });
    } catch (err) {
      toast(err?.status === 400 ? err.message : farmErrorText(err?.reason, tc), "error");
    } finally { setBusy(false); }
  };

  const remove = async (id) => {
    try {
      await farmSpaceApi.removeAnnouncement(space.id, id);
      setItems((l) => l.filter((a) => a.id !== id));
      farmSpaceService.removeAnnouncementFromCache(space.id, id);
    } catch (err) {
      toast(err?.status === 403 ? err.message : farmErrorText(err?.reason, tc), "error");
    }
  };

  const title = tc({ en: "Announcements", hi: "घोषणाएँ", bn: "ঘোষণা" });

  if (state === "loading") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }
  if (state === "error") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  }

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>

        {canPost && (
          <Button full onClick={() => setOpen(true)}>
            <Icon name="Plus" size={16} /> {tc({ en: "New announcement", hi: "नई घोषणा", bn: "নতুন ঘোষণা" })}
          </Button>
        )}

        {!items.length ? (
          <EmptyState icon="Megaphone"
            title={tc({ en: "No announcements", hi: "कोई घोषणा नहीं", bn: "কোনও ঘোষণা নেই" })}
            body={canPost
              ? tc({ en: "Post a notice and everyone in this Farm Space will see it.",
                     hi: "सूचना डालें और इस फ़ार्म स्पेस के सभी लोग देखेंगे।",
                     bn: "একটি বিজ্ঞপ্তি দিন, এই ফার্ম স্পেসের সবাই দেখবে।" })
              : tc({ en: "Notices from your farm will appear here.",
                     hi: "आपके फ़ार्म की सूचनाएँ यहाँ दिखेंगी।",
                     bn: "আপনার খামারের বিজ্ঞপ্তি এখানে দেখা যাবে।" })} />
        ) : items.map((a) => {
          const meta = KINDS[a.kind] || KINDS.notice;
          const [fg, bg] = TONE[meta.a] || TONE.primary;
          return (
            <Card key={a.id} style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid",
                placeItems: "center", background: bg, color: fg }}>
                <Icon name={meta.icon} size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: fg, textTransform: "uppercase", letterSpacing: .4 }}>
                    {tc(meta.label)}
                  </span>
                  <span style={{ fontSize: 11, color: T.inkFaint }}>
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ fontSize: 13.5, color: T.ink, marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {a.message}
                </div>
                {a.author_name && (
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4 }}>— {a.author_name}</div>
                )}
              </div>
              {canPost && (
                <button onClick={() => remove(a.id)}
                  aria-label={tc({ en: "Remove announcement", hi: "घोषणा हटाएँ", bn: "ঘোষণা মুছুন" })}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint,
                    padding: 4, display: "flex", alignSelf: "flex-start" }}>
                  <Icon name="Trash2" size={15} />
                </button>
              )}
            </Card>
          );
        })}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)}
        title={tc({ en: "New announcement", hi: "नई घोषणा", bn: "নতুন ঘোষণা" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Dropdown label={tc({ en: "Type", hi: "प्रकार", bn: "ধরন" })}
            value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
            options={Object.entries(KINDS).map(([id, k]) => ({ value: id, label: tc(k.label) }))} />
          <Input label={tc({ en: "Message", hi: "संदेश", bn: "বার্তা" })}
            placeholder={tc({ en: "e.g. Vaccination on Friday at 9am", hi: "उदा. शुक्रवार सुबह 9 बजे टीकाकरण", bn: "যেমন শুক্রবার সকাল ৯টায় টিকাকরণ" })}
            value={form.message} onChange={(v) => setForm((f) => ({ ...f, message: v }))} maxLength={2000} />
          <div style={{ fontSize: 11.5, color: T.inkFaint, lineHeight: 1.55 }}>
            {tc({ en: "Everyone in this Farm Space will see this. Nobody outside it will.",
                  hi: "इस फ़ार्म स्पेस के सभी लोग यह देखेंगे। बाहर कोई नहीं।",
                  bn: "এই ফার্ম স্পেসের সবাই এটি দেখবে। বাইরের কেউ নয়।" })}
          </div>
          <Button full onClick={post} disabled={busy || !form.message.trim()}>
            {busy ? tc({ en: "Posting…", hi: "भेजा जा रहा है…", bn: "পাঠানো হচ্ছে…" })
                  : tc({ en: "Post", hi: "भेजें", bn: "পাঠান" })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
