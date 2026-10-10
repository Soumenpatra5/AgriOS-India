import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import {
  AppBar,
  Card,
  Button,
  Input,
  SearchBar,
  Dropdown,
  EmptyState,
  ErrorState,
  Spinner,
  BottomSheet,
  Dialog,
} from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmSpaceApi } from "../../services/farmSpace/farmSpaceApi.js";
import { useFarmPoll } from "../../hooks/useFarmPoll.js";
import { formatPresence } from "../../services/farmSpace/presenceUtils.js";
import { shareText } from "../../utils/share.js";
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

const ROLE_FILTER_TABS = [
  { id: "all", label: { en: "All", hi: "सभी", bn: "সব" } },
  { id: "manager", label: { en: "Managers", hi: "प्रबंधक", bn: "ম্যানেজার" } },
  { id: "supervisor", label: { en: "Supervisors", hi: "पर्यवेक्षक", bn: "সুপারভাইজার" } },
  { id: "worker", label: { en: "Workers", hi: "कर्मचारी", bn: "কর্মী" } },
];

function formatJoinedDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export default function FarmSpaceTeam() {
  const { pop, tc, toast } = useApp();
  const [space, setSpace] = useState(null);
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [idInput, setIdInput] = useState("");
  const [found, setFound] = useState(null);       // { id, name, agrios_user_id } once looked up
  const [lookupError, setLookupError] = useState("");
  const [looking, setLooking] = useState(false);
  const [role, setRole] = useState("worker");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [memberDetails, setMemberDetails] = useState(null);

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

  /* Re-render every 30s to advance relative presence labels like "Active 5m ago" */
  const [, setPresenceTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setPresenceTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const poll = useCallback(async () => {
    if (!space?.id) return;
    try {
      const fresh = await farmSpaceService.members(space.id, { fresh: true });
      setMembers(fresh);
      if (memberDetails) {
        const updated = fresh.find((m) => m.user_id === memberDetails.user_id);
        if (updated) setMemberDetails(updated);
      }
    } catch {
      /* Silent: polling failure must not crash or flicker active screen */
    }
  }, [space?.id, memberDetails]);

  useFarmPoll(poll, { intervalMs: 15000, enabled: state === "ready" && !!space?.id });

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
      setMemberDetails((prev) => (prev && prev.user_id === m.user_id ? { ...prev, role: next } : prev));
      toast(tc({ en: "Role updated.", hi: "भूमिका अपडेट की गई।", bn: "ভূমিকা আপডেট হয়েছে।" }), "success");
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
      if (memberDetails && memberDetails.user_id === m.user_id) {
        setMemberDetails(null);
      }
      const who = farmSpaceService.displayName(m) || tc({ en: "Member", hi: "सदस्य", bn: "সদস্য" });
      toast(tc({ en: `${who} removed.`, hi: `${who} हटाया गया।`, bn: `${who} সরানো হয়েছে।` }));
    } catch (err) {
      toast(err?.status === 409 ? err.message : farmErrorText(err?.reason, tc), "error");
    }
  };

  /* Filter roster without mutating original members state */
  const filteredMembers = members.filter((m) => {
    if (roleFilter !== "all" && m.role !== roleFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const name = (m.name || "").toLowerCase();
    const id = (m.agrios_user_id || "").toLowerCase();
    const phone = (m.phone || "").toLowerCase();
    return name.includes(q) || id.includes(q) || phone.includes(q);
  });

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

        {/* ── Header: Member count + Invite action ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>
            {filteredMembers.length !== members.length
              ? tc({
                  en: `${filteredMembers.length} of ${members.length} member${members.length === 1 ? "" : "s"}`,
                  hi: `${members.length} में से ${filteredMembers.length} सदस्य`,
                  bn: `${members.length}-এর মধ্যে ${filteredMembers.length} জন সদস্য`,
                })
              : tc({
                  en: `${members.length} member${members.length === 1 ? "" : "s"}`,
                  hi: `${members.length} सदस्य`,
                  bn: `${members.length} জন সদস্য`,
                })}
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <Icon name="UserPlus" size={15} /> {tc({ en: "Invite", hi: "बुलाएँ", bn: "ডাকুন" })}
            </Button>
          )}
        </div>

        {/* ── Search & Role Filters ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={tc({
              en: "Search by name, ID or phone…",
              hi: "नाम, आईडी या फ़ोन से खोजें…",
              bn: "নাম, আইডি বা ফোন দিয়ে খুঁজুন…",
            })}
          />

          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {ROLE_FILTER_TABS.map((tab) => {
              const isSelected = roleFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    fontSize: 12.5,
                    fontWeight: isSelected ? 600 : 500,
                    fontFamily: T.body,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    border: isSelected ? "none" : `1px solid ${T.lineSoft}`,
                    background: isSelected ? T.primary : T.surface2,
                    color: isSelected ? "#fff" : T.inkSoft,
                    transition: "all .15s ease",
                  }}>
                  {tc(tab.label)}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Member Roster ── */}
        <Card pad={0}>
          {filteredMembers.length === 0 ? (
            <EmptyState
              icon="Users"
              title={tc({ en: "No members found", hi: "कोई सदस्य नहीं मिला", bn: "কোনও সদস্য পাওয়া যায়নি" })}
              body={tc({
                en: "Try adjusting your search or role filter.",
                hi: "अपनी खोज या भूमिका फ़िल्टर बदलकर देखें।",
                bn: "অনুসন্ধান বা ভূমিকা ফিল্টার পরিবর্তন করে দেখুন।",
              })}
              action={(searchQuery || roleFilter !== "all") ? tc({ en: "Clear filters", hi: "फ़िल्टर साफ़ करें", bn: "ফিল্টার সাফ করুন" }) : undefined}
              onAction={() => { setSearchQuery(""); setRoleFilter("all"); }}
            />
          ) : (
            filteredMembers.map((m, i) => {
              /* A missing name falls back to phone, then to the permanent
                 AgriOS User ID — never a generic "Member" that makes every
                 nameless member read as the same person. Phone is only
                 repeated on the second line when a real name is already
                 showing on the first, so nothing displays twice. */
              const name = farmSpaceService.displayName(m) || tc({ en: "Member", hi: "सदस्य", bn: "সদস্য" });
              const isOwner = m.role === "owner";
              return (
                <div
                  key={m.user_id}
                  onClick={() => setMemberDetails(m)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 12px",
                    borderTop: i ? `1px solid ${T.lineSoft}` : "none",
                    cursor: "pointer",
                    transition: "background .15s ease",
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setMemberDetails(m);
                    }
                  }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    background: isOwner ? "#fef3c7" : T.surface2,
                    color: isOwner ? "#b45309" : T.inkSoft,
                    fontWeight: 700,
                    fontFamily: T.display,
                  }}>
                    {name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>
                        {name}
                      </span>
                      {(() => {
                        const presence = formatPresence(m.last_seen_at, tc);
                        return (
                          <span
                            data-testid={`presence-badge-${m.user_id}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "1px 6px",
                              borderRadius: 10,
                              background: presence.badgeBg,
                              color: presence.badgeFg,
                            }}
                          >
                            <span
                              data-testid={`presence-dot-${m.user_id}`}
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: presence.dotColor,
                              }}
                            />
                            {presence.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>
                      {tc(farmSpaceService.roleLabel(m.role))}
                      {m.name && m.phone ? ` · ${m.phone}` : ""}
                    </div>
                  </div>

                  <Icon name="ChevronRight" size={16} style={{ color: T.inkFaint }} />

                  {canManage && !isOwner && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmRemove(m);
                      }}
                      aria-label={tc({ en: "Remove member", hi: "सदस्य हटाएँ", bn: "সদস্য সরান" })}
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4, display: "flex" }}>
                      <Icon name="UserMinus" size={16} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </Card>

        {/* ── Pending invitations (only managers/owners can see or manage) ── */}
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
                <button
                  type="button"
                  onClick={() => setConfirmCancel(i)}
                  aria-label={tc({ en: "Cancel invitation", hi: "निमंत्रण रद्द करें", bn: "আমন্ত্রণ বাতিল করুন" })}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, padding: 4, display: "flex" }}>
                  <Icon name="UserX" size={16} />
                </button>
              </div>
            ))}
          </Card>
        )}

        {/* ── Quick role change card for managers/owners ── */}
        {canManage && filteredMembers.some((m) => m.role !== "owner") && (
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>
              {tc({ en: "Change a role", hi: "भूमिका बदलें", bn: "ভূমিকা বদলান" })}
            </div>
            {filteredMembers.filter((m) => m.role !== "owner").map((m) => (
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

      {/* ── Member Details BottomSheet ── */}
      <BottomSheet
        open={!!memberDetails}
        onClose={() => setMemberDetails(null)}
        title={tc({ en: "Member details", hi: "सदस्य विवरण", bn: "সদস্যের বিবরণ" })}>
        {memberDetails && (() => {
          const name = farmSpaceService.displayName(memberDetails) || tc({ en: "Member", hi: "सदस्य", bn: "সদস্য" });
          const isOwner = memberDetails.role === "owner";
          const joinedDateStr = formatJoinedDate(memberDetails.joined_at);
          const agriosId = memberDetails.agrios_user_id || "—";
          const phoneStr = memberDetails.phone ? `+91 ${memberDetails.phone}` : "—";
          const roleLabel = tc(farmSpaceService.roleLabel(memberDetails.role));

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Profile Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  background: isOwner ? "#fef3c7" : T.primarySoft,
                  color: isOwner ? "#b45309" : T.primary,
                  fontWeight: 700,
                  fontSize: 20,
                  fontFamily: T.display,
                }}>
                  {name.trim().charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>
                    {name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{
                      display: "inline-block",
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: isOwner ? "#fef3c7" : memberDetails.role === "manager" ? "#dbeafe" : memberDetails.role === "supervisor" ? "#ede9fe" : "#dcfce7",
                      color: isOwner ? "#b45309" : memberDetails.role === "manager" ? "#1d4ed8" : memberDetails.role === "supervisor" ? "#6d28d9" : "#15803d",
                    }}>
                      {roleLabel}
                    </span>
                    {(() => {
                      const presence = formatPresence(memberDetails.last_seen_at, tc);
                      return (
                        <span
                          data-testid="member-details-presence-badge"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11.5,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: presence.badgeBg,
                            color: presence.badgeFg,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: presence.dotColor,
                            }}
                          />
                          {presence.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Information Card */}
              <Card pad={0}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {/* AgriOS ID */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.lineSoft}` }}>
                    <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                      {tc({ en: "AgriOS ID", hi: "AgriOS आईडी", bn: "AgriOS আইডি" })}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, fontFamily: "monospace" }}>
                        {agriosId}
                      </span>
                      {memberDetails.agrios_user_id && (
                        <button
                          type="button"
                          onClick={async () => {
                            await shareText(memberDetails.agrios_user_id, "AgriOS ID");
                            toast(tc({ en: "Copied ID", hi: "आईडी कॉपी की गई", bn: "আইডি কপি হয়েছে" }), "success");
                          }}
                          aria-label={tc({ en: "Copy ID", hi: "आईडी कॉपी करें", bn: "আইডি কপি করুন" })}
                          style={{ background: "none", border: "none", cursor: "pointer", color: T.inkFaint, display: "flex", padding: 2 }}>
                          <Icon name="Copy" size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Role */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.lineSoft}` }}>
                    <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                      {tc({ en: "Role", hi: "भूमिका", bn: "ভূমিকা" })}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                      {roleLabel}
                    </div>
                  </div>

                  {/* Phone */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.lineSoft}` }}>
                    <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                      {tc({ en: "Contact / Phone", hi: "संपर्क / फ़ोन", bn: "যোগাযোগ / ফোন" })}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                      {phoneStr}
                    </div>
                  </div>

                  {/* Joined Date */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.lineSoft}` }}>
                    <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                      {tc({ en: "Joined date", hi: "जुड़ने की तिथि", bn: "যোগদানের তারিখ" })}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                      {joinedDateStr}
                    </div>
                  </div>

                  {/* Last active / Presence */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.lineSoft}` }}>
                    <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                      {tc({ en: "Last active", hi: "पिछली सक्रियता", bn: "শেষ সক্রিয়" })}
                    </div>
                    {(() => {
                      const presence = formatPresence(memberDetails.last_seen_at, tc);
                      return (
                        <div
                          data-testid="member-details-last-seen"
                          style={{ fontSize: 13.5, fontWeight: 600, color: presence.badgeFg, display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: presence.dotColor }} />
                          {presence.label}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Membership Status */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
                    <div style={{ fontSize: 12.5, color: T.inkSoft }}>
                      {tc({ en: "Membership status", hi: "सदस्यता स्थिति", bn: "সদস্যপদ অবস্থা" })}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#15803d" }}>
                      {tc({ en: "Active", hi: "सक्रिय", bn: "সক্রিয়" })}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Management Controls */}
              {canManage && !isOwner && (
                <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>
                    {tc({ en: "Manage member", hi: "सदस्य प्रबंधन", bn: "সদস্য পরিচালনা" })}
                  </div>
                  <Dropdown
                    label={tc({ en: "Change role", hi: "भूमिका बदलें", bn: "ভূমিকা বদলান" })}
                    value={memberDetails.role}
                    onChange={(nextRole) => changeRole(memberDetails, nextRole)}
                    options={ROLE_OPTIONS(tc, space.role)}
                  />
                  <Button
                    full
                    variant="outline"
                    style={{ color: T.red, borderColor: T.red, marginTop: 4 }}
                    onClick={() => {
                      const m = memberDetails;
                      setMemberDetails(null);
                      setConfirmRemove(m);
                    }}>
                    <Icon name="UserMinus" size={16} />
                    {tc({ en: "Remove member", hi: "सदस्य हटाएँ", bn: "সদস্য সরান" })}
                  </Button>
                </Card>
              )}

              {isOwner && (
                <div style={{
                  fontSize: 12,
                  color: T.inkSoft,
                  background: T.surface2,
                  padding: "10px 12px",
                  borderRadius: 10,
                  lineHeight: 1.5,
                }}>
                  {tc({
                    en: "Farm Owner. Ownership cannot be changed or removed here — transfer ownership from Farm Settings.",
                    hi: "फ़ार्म मालिक। यहाँ स्वामित्व नहीं बदला या हटाया जा सकता — फ़ार्म सेटिंग्स से स्वामित्व हस्तांतरित करें।",
                    bn: "খামারের মালিক। এখানে মালিকানা পরিবর্তন বা সরানো যাবে না — ফার্ম সেটিংস থেকে মালিকানা হস্তান্তর করুন।",
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </BottomSheet>

      {/* ── Invite BottomSheet ── */}
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
                    {found.name || tc({ en: "AgriOS member", hi: "AgriOS सदस्य", bn: "AgriOS सदस्य" })}
                  </div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{found.agrios_user_id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setFound(null); setIdInput(""); }}
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
