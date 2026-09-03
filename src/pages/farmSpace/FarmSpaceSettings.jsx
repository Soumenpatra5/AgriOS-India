import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar, Card, Button, Input, Dropdown, ErrorState, Spinner, Dialog,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmSpaceApi } from "../../services/farmSpace/farmSpaceApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

/* Farm Space settings — owner only.

   Three of the actions here cannot be undone from inside the app, so they are
   kept apart from the everyday fields, given plain-language confirmations that
   say what actually happens, and typed out rather than tapped where the
   consequence is largest. The server checks role === "owner" on each of them
   regardless of what this screen chooses to draw. */

export default function FarmSpaceSettings() {
  const { pop, push, tc, toast } = useApp();
  const [space, setSpace] = useState(null);
  const [members, setMembers] = useState([]);
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);

  const [form, setForm] = useState({ name: "", description: "", location: "" });
  const [saving, setSaving] = useState(false);

  const [transferTo, setTransferTo] = useState("");
  const [confirm, setConfirm] = useState(null);   // "archive" | "transfer"
  const [deleteText, setDeleteText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const active = await farmSpaceService.active();
      if (!active) { setReason(FARM_ERROR.NOT_FOUND); setState("error"); return; }
      setSpace(active);
      setForm({
        name: active.name || "",
        description: active.description || "",
        location: active.location || "",
      });
      setMembers(await farmSpaceApi.listMembers(active.id).catch(() => []));
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* The server's own messages here are written for a farmer — "Transfer
     ownership instead of changing the owner's role" — so they are shown as-is
     rather than flattened into a generic failure. */
  const say = (err) => toast(
    [400, 403, 409].includes(err?.status) ? err.message : farmErrorText(err?.reason, tc),
    "error",
  );

  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await farmSpaceApi.updateSpace(space.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
      });
      await farmSpaceService.spaces({ fresh: true });
      toast(tc({ en: "Saved.", hi: "सहेजा गया।", bn: "সংরক্ষিত হয়েছে।" }), "success");
    } catch (err) { say(err); } finally { setSaving(false); }
  };

  const archive = async () => {
    setConfirm(null);
    try {
      await farmSpaceApi.archiveSpace(space.id);
      await farmSpaceService.spaces({ fresh: true });
      toast(tc({ en: "Farm Space archived.", hi: "फ़ार्म स्पेस संग्रहित।", bn: "ফার্ম স্পেস আর্কাইভ হয়েছে।" }));
      pop();
    } catch (err) { say(err); }
  };

  const transfer = async () => {
    setConfirm(null);
    try {
      await farmSpaceApi.transferOwnership(space.id, transferTo);
      await farmSpaceService.spaces({ fresh: true });
      const who = members.find((m) => m.user_id === transferTo);
      toast(tc({ en: `${who?.name || "They"} is now the owner. You are a manager.`,
                 hi: `${who?.name || "वे"} अब मालिक हैं। आप प्रबंधक हैं।`,
                 bn: `${who?.name || "তিনি"} এখন মালিক। আপনি ম্যানেজার।` }), "success");
      pop();
    } catch (err) { say(err); }
  };

  const destroy = async () => {
    setDeleteOpen(false);
    try {
      await farmSpaceApi.deleteSpace(space.id);
      farmSpaceService.setActive(null);
      await farmSpaceService.spaces({ fresh: true });
      toast(tc({ en: "Farm Space deleted.", hi: "फ़ार्म स्पेस हटा दिया गया।", bn: "ফার্ম স্পেস মুছে ফেলা হয়েছে।" }));
      pop(); pop();
    } catch (err) { say(err); }
  };

  const title = tc({ en: "Farm Space settings", hi: "फ़ार्म स्पेस सेटिंग्स", bn: "ফার্ম স্পেস সেটিংস" });

  if (state === "loading") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }
  if (state === "error") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState body={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  }

  const isOwner = space.role === "owner";
  const others = members.filter((m) => m.user_id !== space.user_id);
  const dirty = form.name.trim() !== (space.name || "")
    || form.description.trim() !== (space.description || "")
    || form.location.trim() !== (space.location || "");

  /* Typing the farm's name is the one confirmation that cannot be dismissed by
     a mis-tap, which is right for the only action that removes the farm from
     everyone at once. */
  const deleteConfirmed = deleteText.trim() === (space.name || "").trim();

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── details ── */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Input label={tc({ en: "Farm name", hi: "फ़ार्म का नाम", bn: "খামারের নাম" })}
            value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} maxLength={80} />
          <Input label={tc({ en: "Location", hi: "स्थान", bn: "অবস্থান" })}
            placeholder={tc({ en: "Village or district", hi: "गाँव या ज़िला", bn: "গ্রাম বা জেলা" })}
            value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} maxLength={200} />
          <Input label={tc({ en: "Description", hi: "विवरण", bn: "বিবরণ" })}
            placeholder={tc({ en: "What this farm does", hi: "यह फ़ार्म क्या करता है", bn: "এই খামার কী করে" })}
            value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} maxLength={500} />
          <Button full onClick={save} disabled={saving || !dirty || !form.name.trim()}>
            {saving ? tc({ en: "Saving…", hi: "सहेजा जा रहा है…", bn: "সংরক্ষণ হচ্ছে…" })
                    : tc({ en: "Save changes", hi: "बदलाव सहेजें", bn: "পরিবর্তন সংরক্ষণ" })}
          </Button>
        </Card>

        {/* ── members shortcut: the roster lives on one screen, not two ── */}
        <Card pad={0}>
          <button onClick={() => push({ kind: "farmSpaceTeam" })}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 12px",
              background: "none", border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: "grid",
              placeItems: "center", background: T.primarySoft, color: T.primary }}>
              <Icon name="Users" size={17} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>
                {tc({ en: "Members & roles", hi: "सदस्य और भूमिकाएँ", bn: "সদস্য ও ভূমিকা" })}
              </div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>
                {tc({ en: `${members.length} member${members.length === 1 ? "" : "s"} · invite, change roles, remove`,
                      hi: `${members.length} सदस्य · बुलाएँ, भूमिका बदलें, हटाएँ`,
                      bn: `${members.length} জন · ডাকুন, ভূমিকা বদলান, সরান` })}
              </div>
            </div>
            <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
          </button>
        </Card>

        {/* ── the irreversible half ── */}
        {isOwner && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase",
              letterSpacing: .5, marginTop: 4 }}>
              {tc({ en: "Careful", hi: "सावधानी", bn: "সতর্কতা" })}
            </div>

            {/* transfer */}
            <Card style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
                  {tc({ en: "Transfer ownership", hi: "स्वामित्व हस्तांतरित करें", bn: "মালিকানা হস্তান্তর" })}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2, lineHeight: 1.5 }}>
                  {tc({ en: "They become the owner and you become a manager. You stay in the farm.",
                        hi: "वे मालिक बनेंगे और आप प्रबंधक। आप फ़ार्म में बने रहेंगे।",
                        bn: "তিনি মালিক হবেন, আপনি ম্যানেজার। আপনি খামারেই থাকবেন।" })}
                </div>
              </div>
              {!others.length ? (
                <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                  {tc({ en: "Invite someone first — there is nobody to hand the farm to.",
                        hi: "पहले किसी को बुलाएँ — फ़ार्म देने के लिए कोई नहीं है।",
                        bn: "আগে কাউকে ডাকুন — খামার দেওয়ার মতো কেউ নেই।" })}
                </div>
              ) : (
                <>
                  <Dropdown value={transferTo} onChange={setTransferTo}
                    options={[{ value: "", label: tc({ en: "Choose a member", hi: "सदस्य चुनें", bn: "সদস্য বাছুন" }) },
                      ...others.map((m) => ({ value: m.user_id, label: m.name || m.phone || "—" }))]} />
                  <Button full variant="soft" disabled={!transferTo}
                    onClick={() => setConfirm("transfer")}>
                    {tc({ en: "Transfer", hi: "हस्तांतरित करें", bn: "হস্তান্তর করুন" })}
                  </Button>
                </>
              )}
            </Card>

            {/* archive */}
            <Card style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
                  {tc({ en: "Archive Farm Space", hi: "फ़ार्म स्पेस संग्रहित करें", bn: "ফার্ম স্পেস আর্কাইভ করুন" })}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2, lineHeight: 1.5 }}>
                  {tc({ en: "Everything is kept and stays visible, but nobody can add tasks, attendance or messages.",
                        hi: "सब कुछ सुरक्षित और दिखता रहेगा, पर कोई कार्य, उपस्थिति या संदेश नहीं जोड़ सकेगा।",
                        bn: "সব কিছু থাকবে ও দেখা যাবে, কিন্তু কেউ কাজ, উপস্থিতি বা বার্তা যোগ করতে পারবে না।" })}
                </div>
              </div>
              <Button full variant="soft" onClick={() => setConfirm("archive")}>
                {tc({ en: "Archive", hi: "संग्रहित करें", bn: "আর্কাইভ করুন" })}
              </Button>
            </Card>

            {/* delete */}
            <Card style={{ display: "flex", flexDirection: "column", gap: 11, borderColor: T.redSoft }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.red }}>
                  {tc({ en: "Delete Farm Space", hi: "फ़ार्म स्पेस हटाएँ", bn: "ফার্ম স্পেস মুছুন" })}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2, lineHeight: 1.5 }}>
                  {tc({ en: "It disappears for every member, along with its tasks, attendance, announcements and chat. This cannot be undone from the app.",
                        hi: "यह हर सदस्य के लिए गायब हो जाएगा — इसके कार्य, उपस्थिति, घोषणाएँ और चैट सहित। ऐप से इसे वापस नहीं लाया जा सकता।",
                        bn: "এটি প্রত্যেক সদস্যের জন্য অদৃশ্য হবে — কাজ, উপস্থিতি, ঘোষণা ও চ্যাট সহ। অ্যাপ থেকে ফেরানো যাবে না।" })}
                </div>
              </div>
              <Button full variant="soft" onClick={() => { setDeleteText(""); setDeleteOpen(true); }}>
                <span style={{ color: T.red }}>{tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}</span>
              </Button>
            </Card>
          </>
        )}
      </div>

      <Dialog open={confirm === "archive"} onClose={() => setConfirm(null)}
        title={tc({ en: "Archive this Farm Space?", hi: "यह फ़ार्म स्पेस संग्रहित करें?", bn: "এই ফার্ম স্পেস আর্কাইভ করবেন?" })}
        body={tc({ en: "Members keep access to everything already there, but no new work can be added.",
                   hi: "सदस्य पुरानी सब चीज़ें देख सकेंगे, पर नया कुछ नहीं जोड़ा जा सकेगा।",
                   bn: "সদস্যরা আগের সব দেখতে পাবেন, কিন্তু নতুন কিছু যোগ করা যাবে না।" })}
        icon="Archive"
        confirmLabel={tc({ en: "Archive", hi: "संग्रहित करें", bn: "আর্কাইভ" })}
        cancelLabel={tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" })}
        onConfirm={archive} />

      <Dialog open={confirm === "transfer"} onClose={() => setConfirm(null)}
        title={tc({ en: "Hand over this farm?", hi: "यह फ़ार्म सौंप दें?", bn: "এই খামার হস্তান্তর করবেন?" })}
        body={tc({ en: `${members.find((m) => m.user_id === transferTo)?.name || "This member"} becomes the owner. You become a manager and keep access — but you cannot take ownership back yourself.`,
                   hi: `${members.find((m) => m.user_id === transferTo)?.name || "यह सदस्य"} मालिक बनेंगे। आप प्रबंधक बनेंगे और पहुँच बनी रहेगी — पर आप स्वयं स्वामित्व वापस नहीं ले सकेंगे।`,
                   bn: `${members.find((m) => m.user_id === transferTo)?.name || "এই সদস্য"} মালিক হবেন। আপনি ম্যানেজার হবেন ও প্রবেশাধিকার থাকবে — কিন্তু নিজে মালিকানা ফেরত নিতে পারবেন না।` })}
        icon="ArrowRightLeft"
        confirmLabel={tc({ en: "Transfer", hi: "हस्तांतरित करें", bn: "হস্তান্তর" })}
        cancelLabel={tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" })}
        onConfirm={transfer} />

      {/* Delete asks for the farm's name rather than a tap — it is the only
          action that takes the farm away from everyone at once.

          The buttons live in the body rather than being Dialog's own: Dialog
          renders no buttons at all when onConfirm is absent (not even Cancel),
          and its confirm button has no disabled state, so a name-gated
          confirmation cannot be expressed with them. */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}
        title={tc({ en: "Delete this Farm Space?", hi: "यह फ़ार्म स्पेस हटाएँ?", bn: "এই ফার্ম স্পেস মুছবেন?" })}
        icon="Trash2" danger
        body={
          <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
            <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55 }}>
              {tc({ en: "Every member loses this farm and everything in it — tasks, attendance, announcements and chat. Type the farm's name to confirm.",
                    hi: "हर सदस्य यह फ़ार्म और इसमें सब कुछ खो देगा — कार्य, उपस्थिति, घोषणाएँ और चैट। पुष्टि के लिए फ़ार्म का नाम लिखें।",
                    bn: "প্রত্যেক সদস্য এই খামার ও এর সব কিছু হারাবেন — কাজ, উপস্থিতি, ঘোষণা ও চ্যাট। নিশ্চিত করতে খামারের নাম লিখুন।" })}
            </div>
            <Input placeholder={space.name} value={deleteText} onChange={setDeleteText} maxLength={80} />
            {deleteText && !deleteConfirmed && (
              <div style={{ fontSize: 11.5, color: T.red }}>
                {tc({ en: "That doesn't match the farm's name.", hi: "यह फ़ार्म के नाम से मेल नहीं खाता।", bn: "এটি খামারের নামের সঙ্গে মিলছে না।" })}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <div style={{ flex: 1 }}>
                <Button full variant="outline" onClick={() => setDeleteOpen(false)}>
                  {tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" })}
                </Button>
              </div>
              <div style={{ flex: 1 }}>
                <Button full variant="danger" disabled={!deleteConfirmed} onClick={destroy}>
                  {tc({ en: "Delete", hi: "हटाएँ", bn: "মুছুন" })}
                </Button>
              </div>
            </div>
          </div>
        } />
    </>
  );
}
