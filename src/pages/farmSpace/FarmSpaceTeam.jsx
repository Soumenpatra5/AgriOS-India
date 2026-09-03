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
  const [pendingInvites, setPendingInvites] = useState([]);
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [idInput, setIdInput] = useState("");
  const [found, setFound] = useState(null);       // { id, name, agrios_user_id } once looked up
  const [lookupError, setLookupError] = useState("");
  const [looking, setLooking] = useState(false);
  const [role, setRole] = useState("worker");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const active = await farmSpaceService.active();
      if (!active) { setState("error"); setReason(FARM_ERROR.NOT_FOUND); return; }
      setSpace(active);
      setMembers(await farmSpaceService.members(active.id));
      if (farmSpaceService.can(active, "farm.members.manage")) {
        farmSpaceApi.pendingInvites(active.id).then(setPendingInvites).catch(() => setPendingInvites([]));
      }
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const canManage = farmSpaceService.can(space, "farm.members.manage");

  const resetInvite = () => {
    setInviteOpen(false); setIdInput(""); setFound(null); setLookupError(""); setRole("worker");
  };

  /* Step 1: confirm which account the id belongs to. Deliberately a separate
     tap from "send" — typing a wrong character in an id is easy, and this is
     the one screen in the app where a mistake means inviting a stranger into
     a farm's shared work rather than just showing the wrong data. */
  const findUser = async () => {
    if (!idInput.trim() || looking) return;
    setLooking(true); setLookupError(""); setFound(null);
    try {
      setFound(await farmSpaceApi.lookupUser(idInput.trim()));
    } catch (err) {
      setLookupError(err?.status === 400 || err?.status === 404 ? err.message : farmErrorText(err?.reason, tc));
    } finally { setLooking(false); }
  };

  const invite = async () => {
    if (!found || busy) return;
    setBusy(true);
    try {
      await farmSpaceApi.invite(space.id, { agriosUserId: found.agrios_user_id, role });
      toast(tc({ en: `Invitation sent to ${found.name || "them"}.`,
                 hi: `${found.name || "उन्हें"} को निमंत्रण भेजा गया।`,
                 bn: `${found.name || "তাঁকে"} আমন্ত্রণ পাঠানো হয়েছে।` }), "success");
      resetInvite();
      farmSpaceApi.pendingInvites(space.id).then(setPendingInvites).catch(() => {});
    } catch (err) {
      /* The server's message is written for a farmer — "that person is
         already a member", "that person already has a pending invitation" —
         so it is shown as-is rather than flattened into a generic failure. */
      toast(err?.status === 400 || err?.status === 409 || err?.status === 404 ? err.message : farmErrorText(err?.reason, tc), "error");
    } finally { setBusy(false); }
  };

  const cancelInvite = async () => {
    const invite_ = confirmCancel;
    setConfirmCancel(null);
    try {
      await farmSpaceApi.cancelInvitation(space.id, invite_.id);
      setPendingInvites((list) => list.filter((i) => i.id !== invite_.id));
      toast(tc({ en: "Invitation cancelled.", hi: "निमंत्रण रद्द किया गया।", bn: "আমন্ত্রণ বাতিল হয়েছে।" }));
    } catch (err) {
      toast(farmErrorText(err?.reason, tc), "error");
    }
  };

  const changeRole = async (m, next) => {
    try {
      await farmSpaceApi.setMemberRole(space.id, m.user_id, next);
      setMembers((list) => list.map((x) => (x.user_id === m.user_id ? { ...x, role: next } : x)));
      farmSpaceService.patchMember(space.id, m.user_id, { role: next });
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
      farmSpaceService.removeMemberFromCache(space.id, m.user_id);
      const who = farmSpaceService.displayName(m) || tc({ en: "Member", hi: "सदस्य", bn: "সদস্য" });
      toast(tc({ en: `${who} removed.`, hi: `${who} हटाया गया।`, bn: `${who} সরানো হয়েছে।` }));
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
          {members.map((m, i) => {
            /* A missing name falls back to phone, then to the permanent
               AgriOS User ID — never a generic "Member" that makes every
               nameless member read as the same person. Phone is only
               repeated on the second line when a real name is already
               showing on the first, so nothing displays twice. */
            const name = farmSpaceService.displayName(m) || tc({ en: "Member", hi: "सदस्य", bn: "সদস্য" });
            return (
            <div key={m.user_id}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 12px",
                borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center",
                background: T.surface2, color: T.inkSoft, fontWeight: 700, fontFamily: T.display }}>
                {name.trim().charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>
                  {name}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>
                  {tc(farmSpaceService.roleLabel(m.role))}
                  {m.name && m.phone ? ` · ${m.phone}` : ""}
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
            );
          })}
        </Card>

        {canManage && pendingInvites.length > 0 && (
          <Card pad={0}>
            <div style={{ padding: "12px 12px 4px", fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>
              {tc({ en: "Pending invitations", hi: "लंबित निमंत्रण", bn: "মুলতুবি আমন্ত্রণ" })}
            </div>
            {pendingInvites.map((i, idx) => (
              <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                borderTop: idx ? `1px solid ${T.lineSoft}` : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                    {i.invited_name || tc({ en: "Member", hi: "सदस्य", bn: "সদস্য" })}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1 }}>
                    {tc(farmSpaceService.roleLabel(i.role))} · {i.agrios_user_id}
                  </div>
                </div>
                <button onClick={() => setConfirmCancel(i)}
                  aria-label={tc({ en: "Cancel invitation", hi: "निमंत्रण रद्द करें", bn: "আমন্ত্রণ বাতিল করুন" })}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4, display: "flex" }}>
                  <Icon name="UserX" size={16} />
                </button>
              </div>
            ))}
          </Card>
        )}

        {canManage && members.some((m) => m.role !== "owner") && (
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>
              {tc({ en: "Change a role", hi: "भूमिका बदलें", bn: "ভূমিকা বদলান" })}
            </div>
            {members.filter((m) => m.role !== "owner").map((m) => (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: T.ink }}>
                  {farmSpaceService.displayName(m) || tc({ en: "Member", hi: "सदस्य", bn: "সদস্য" })}
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

      <BottomSheet open={inviteOpen} onClose={resetInvite}
        title={tc({ en: "Invite a member", hi: "सदस्य बुलाएँ", bn: "সদস্য ডাকুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!found ? (
            <>
              <Input label={tc({ en: "AgriOS User ID", hi: "AgriOS यूज़र आईडी", bn: "AgriOS ইউজার আইডি" })}
                placeholder="AGRI-8F42K7M9"
                value={idInput} onChange={(v) => { setIdInput(v); setLookupError(""); }} maxLength={20} />
              {lookupError && (
                <div style={{ fontSize: 12.5, color: T.red }}>{lookupError}</div>
              )}
              <div style={{ fontSize: 11.5, color: T.inkFaint, lineHeight: 1.55 }}>
                {tc({ en: "Ask them for their AgriOS User ID — it's on their Profile screen.",
                      hi: "उनसे उनकी AgriOS यूज़र आईडी माँगें — यह उनकी प्रोफ़ाइल स्क्रीन पर है।",
                      bn: "তাঁর AgriOS ইউজার আইডি জিজ্ঞাসা করুন — এটি তাঁর প্রোফাইল স্ক্রিনে আছে।" })}
              </div>
              <Button full onClick={findUser} disabled={looking || !idInput.trim()}>
                {looking ? tc({ en: "Finding…", hi: "खोजा जा रहा है…", bn: "খোঁজা হচ্ছে…" })
                         : tc({ en: "Find", hi: "खोजें", bn: "খুঁজুন" })}
              </Button>
            </>
          ) : (
            <>
              <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center",
                  background: T.primarySoft, color: T.primary, fontWeight: 700, fontFamily: T.display }}>
                  {(found.name || "?").trim().charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>
                    {found.name || tc({ en: "AgriOS member", hi: "AgriOS सदस्य", bn: "AgriOS সদস্য" })}
                  </div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{found.agrios_user_id}</div>
                </div>
                <button onClick={() => { setFound(null); setIdInput(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, fontSize: 12, fontWeight: 600, fontFamily: T.body }}>
                  {tc({ en: "Change", hi: "बदलें", bn: "বদলান" })}
                </button>
              </Card>
              <Dropdown label={tc({ en: "Role", hi: "भूमिका", bn: "ভূমিকা" })}
                value={role} onChange={setRole} options={ROLE_OPTIONS(tc, space.role)} />
              <div style={{ fontSize: 11.5, color: T.inkFaint, lineHeight: 1.55 }}>
                {tc({ en: "They will see this invitation next time they sign in. They will only ever see this farm's shared work — never your personal data.",
                      hi: "अगली बार साइन इन करने पर उन्हें यह निमंत्रण दिखेगा। उन्हें केवल इस फ़ार्म का साझा काम दिखेगा — आपका निजी डेटा कभी नहीं।",
                      bn: "পরের বার সাইন ইন করলে তাঁরা এই আমন্ত্রণ দেখবেন। তাঁরা কেবল এই খামারের ভাগ করা কাজ দেখবেন — আপনার ব্যক্তিগত তথ্য কখনও নয়।" })}
              </div>
              <Button full onClick={invite} disabled={busy}>
                {busy ? tc({ en: "Sending…", hi: "भेजा जा रहा है…", bn: "পাঠানো হচ্ছে…" })
                      : tc({ en: "Send invitation", hi: "निमंत्रण भेजें", bn: "আমন্ত্রণ পাঠান" })}
              </Button>
            </>
          )}
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

      <Dialog open={!!confirmCancel} onClose={() => setConfirmCancel(null)}
        title={tc({ en: "Cancel this invitation?", hi: "यह निमंत्रण रद्द करें?", bn: "এই আমন্ত্রণ বাতিল করবেন?" })}
        body={tc({ en: "They will no longer be able to accept it.",
                   hi: "अब वे इसे स्वीकार नहीं कर पाएँगे।",
                   bn: "তাঁরা আর এটি গ্রহণ করতে পারবেন না।" })}
        icon="UserX" danger
        confirmLabel={tc({ en: "Cancel invitation", hi: "निमंत्रण रद्द करें", bn: "আমন্ত্রণ বাতিল করুন" })}
        cancelLabel={tc({ en: "Keep it", hi: "रखें", bn: "রাখুন" })}
        onConfirm={cancelInvite} />
    </>
  );
}
