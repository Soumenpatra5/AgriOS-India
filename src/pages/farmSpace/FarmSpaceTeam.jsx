import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, Input, Dropdown, ErrorState, Spinner, BottomSheet, Dialog } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmSpaceApi } from "../../services/farmSpace/farmSpaceApi.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

/* The team inside one Farm Space.

   Every action here is offered only when the member's role allows it, and
   every one is re-checked server-side — the role dropdown refuses to offer a
   role at or above the actor's own, and the server refuses it again if the
   request is made anyway. */

const ROLE_OPTIONS = (tc, actorRole) => {
  /* Owner is never in this list: ownership moves by transfer, not by promotion,
     or a manager could mint a second owner and lock the original out. */
  const all = [
    { id: "manager",    label: { en: "Manager",    hi: "प्रबंधक",    bn: "ম্যানেজার" } },
    { id: "supervisor", label: { en: "Supervisor", hi: "पर्यवेक्षक", bn: "সুপারভাইজার" } },
    { id: "worker",     label: { en: "Worker",     hi: "कर्मचारी",   bn: "কর্মী" } },
  ];
  const rank = { owner: 3, manager: 2, supervisor: 1, worker: 0 };
  return all
    .filter((r) => actorRole === "owner" || rank[r.id] < (rank[actorRole] ?? 0))
    .map((r) => ({ value: r.id, label: tc(r.label) }));
};

export default function FarmSpaceTeam() {
  const { pop, tc, toast } = useApp();
  const [space, setSpace] = useState(null);
  const [members, setMembers] = useState([]);
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("worker");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const active = await farmSpaceService.active();
      if (!active) { setState("error"); setReason(FARM_ERROR.NOT_FOUND); return; }
      setSpace(active);
      setMembers(await farmSpaceApi.listMembers(active.id));
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const canManage = farmSpaceService.can(space, "farm.members.manage");

  const invite = async () => {
    if (!phone.trim() || busy) return;
    setBusy(true);
    try {
      await farmSpaceApi.invite(space.id, { phone: phone.trim(), role });
      toast(tc({ en: "Invitation sent.", hi: "निमंत्रण भेजा गया।", bn: "আমন্ত্রণ পাঠানো হয়েছে।" }), "success");
      setInviteOpen(false); setPhone(""); setRole("worker");
    } catch (err) {
      /* The server's message is written for a farmer — "that person is already
         a member", "a phone number is required" — so it is shown as-is rather
         than flattened into a generic failure. */
      toast(err?.status === 400 || err?.status === 409 ? err.message : farmErrorText(err?.reason, tc), "error");
    } finally { setBusy(false); }
  };

  const changeRole = async (m, next) => {
    try {
      await farmSpaceApi.setMemberRole(space.id, m.user_id, next);
      setMembers((list) => list.map((x) => (x.user_id === m.user_id ? { ...x, role: next } : x)));
    } catch (err) {
      toast(err?.status === 403 || err?.status === 409 ? err.message : farmErrorText(err?.reason, tc), "error");
    }
  };

  const remove = async () => {
    const m = confirmRemove;
    setConfirmRemove(null);
    try {
      await farmSpaceApi.removeMember(space.id, m.user_id);
      setMembers((list) => list.filter((x) => x.user_id !== m.user_id));
      toast(tc({ en: `${m.name || "Member"} removed.`, hi: `${m.name || "सदस्य"} हटाया गया।`, bn: `${m.name || "সদস্য"} সরানো হয়েছে।` }));
    } catch (err) {
      toast(err?.status === 409 ? err.message : farmErrorText(err?.reason, tc), "error");
    }
  };

  const title = tc({ en: "Team", hi: "टीम", bn: "দল" });

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
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>
            {tc({ en: `${members.length} member${members.length === 1 ? "" : "s"}`,
                  hi: `${members.length} सदस्य`, bn: `${members.length} জন সদস্য` })}
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <Icon name="UserPlus" size={15} /> {tc({ en: "Invite", hi: "बुलाएँ", bn: "ডাকুন" })}
            </Button>
          )}
        </div>

        <Card pad={0}>
          {members.map((m, i) => (
            <div key={m.user_id}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 12px",
                borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center",
                background: T.surface2, color: T.inkSoft, fontWeight: 700, fontFamily: T.display }}>
                {(m.name || "?").trim().charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>
                  {m.name || tc({ en: "Member", hi: "सदस्य", bn: "সদস্য" })}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>
                  {tc(farmSpaceService.roleLabel(m.role))}
                  {m.phone ? ` · ${m.phone}` : ""}
                </div>
              </div>

              {canManage && m.role !== "owner" && (
                <button onClick={() => setConfirmRemove(m)}
                  aria-label={tc({ en: "Remove member", hi: "सदस्य हटाएँ", bn: "সদস্য সরান" })}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4, display: "flex" }}>
                  <Icon name="UserMinus" size={16} />
                </button>
              )}
            </div>
          ))}
        </Card>

        {canManage && members.some((m) => m.role !== "owner") && (
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>
              {tc({ en: "Change a role", hi: "भूमिका बदलें", bn: "ভূমিকা বদলান" })}
            </div>
            {members.filter((m) => m.role !== "owner").map((m) => (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: T.ink }}>
                  {m.name || m.phone || tc({ en: "Member", hi: "सदस्य", bn: "সদস্য" })}
                </div>
                <div style={{ width: 150 }}>
                  <Dropdown value={m.role} onChange={(v) => changeRole(m, v)}
                    options={ROLE_OPTIONS(tc, space.role)} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <BottomSheet open={inviteOpen} onClose={() => setInviteOpen(false)}
        title={tc({ en: "Invite a member", hi: "सदस्य बुलाएँ", bn: "সদস্য ডাকুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label={tc({ en: "Mobile number", hi: "मोबाइल नंबर", bn: "মোবাইল নম্বর" })}
            placeholder="98765 43210" type="tel" inputMode="numeric" prefix="+91"
            value={phone} onChange={setPhone} maxLength={13} />
          <Dropdown label={tc({ en: "Role", hi: "भूमिका", bn: "ভূমিকা" })}
            value={role} onChange={setRole} options={ROLE_OPTIONS(tc, space.role)} />
          <div style={{ fontSize: 11.5, color: T.inkFaint, lineHeight: 1.55 }}>
            {tc({ en: "They'll see this invitation when they sign in to AgriOS with that number. They will only ever see this farm's shared work — never your personal data.",
                  hi: "उस नंबर से AgriOS में साइन इन करने पर उन्हें यह निमंत्रण दिखेगा। उन्हें केवल इस फ़ार्म का साझा काम दिखेगा — आपका निजी डेटा कभी नहीं।",
                  bn: "সেই নম্বরে AgriOS-এ সাইন ইন করলে তাঁরা এই আমন্ত্রণ দেখবেন। তাঁরা কেবল এই খামারের ভাগ করা কাজ দেখবেন — আপনার ব্যক্তিগত তথ্য কখনও নয়।" })}
          </div>
          <Button full onClick={invite} disabled={busy || !phone.trim()}>
            {busy ? tc({ en: "Sending…", hi: "भेजा जा रहा है…", bn: "পাঠানো হচ্ছে…" })
                  : tc({ en: "Send invitation", hi: "निमंत्रण भेजें", bn: "আমন্ত্রণ পাঠান" })}
          </Button>
        </div>
      </BottomSheet>

      <Dialog open={!!confirmRemove} onClose={() => setConfirmRemove(null)}
        title={tc({ en: "Remove from Farm Space?", hi: "फ़ार्म स्पेस से हटाएँ?", bn: "ফার্ম স্পেস থেকে সরাবেন?" })}
        body={tc({ en: "They will lose access to this farm's tasks, attendance and announcements straight away. Their past work is kept.",
                   hi: "उनकी इस फ़ार्म के कार्य, उपस्थिति और घोषणाओं तक पहुँच तुरंत खत्म हो जाएगी। उनका पिछला काम सुरक्षित रहेगा।",
                   bn: "এই খামারের কাজ, উপস্থিতি ও ঘোষণায় তাঁদের প্রবেশ সঙ্গে সঙ্গে বন্ধ হবে। তাঁদের আগের কাজ রক্ষিত থাকবে।" })}
        icon="UserMinus" danger
        confirmLabel={tc({ en: "Remove", hi: "हटाएँ", bn: "সরান" })}
        cancelLabel={tc({ en: "Cancel", hi: "रद्द", bn: "বাতিল" })}
        onConfirm={remove} />
    </>
  );
}
