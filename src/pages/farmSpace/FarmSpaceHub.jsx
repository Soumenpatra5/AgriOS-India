import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, EmptyState, ErrorState, Spinner, IconTile } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, onFarmSpaceChanged, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";

/* My Farm Space — the hub.

   The one collaborative surface in AgriOS. Everything reached from here is
   shared with the other members of THIS space and nothing else in the app is:
   the farmer's profile, AI history, payments and personal documents stay
   private, which is why this lives behind its own entry point rather than
   being folded into the ERP.

   Each menu item is gated on the member's role, but the hiding is a courtesy.
   The server re-checks every permission on every request, so a member who
   forces a screen open reaches an empty list and a 403, not someone else's
   data. */

const MENU = [
  { kind: "farmSpaceTeam",     perm: "farm.members.view",   icon: "Users",       a: "primary",
    label: { en: "Team",          hi: "टीम",            bn: "দল" },
    desc:  { en: "Members & roles", hi: "सदस्य और भूमिकाएँ", bn: "সদস্য ও ভূমিকা" } },
  { kind: "farmSpaceTasks",    perm: "farm.tasks.view",     icon: "ClipboardList", a: "blue",
    label: { en: "Tasks",         hi: "कार्य",           bn: "কাজ" },
    desc:  { en: "Assign & track",  hi: "सौंपें और देखें",   bn: "বরাদ্দ ও ট্র্যাক" } },
  { kind: "farmSpaceAttendance", perm: "farm.attendance.view", icon: "CalendarCheck", a: "primary",
    label: { en: "Attendance",    hi: "उपस्थिति",        bn: "উপস্থিতি" },
    desc:  { en: "Who is working today", hi: "आज कौन काम पर है", bn: "আজ কে কাজে আছে" } },
  { kind: "farmSpaceAnnouncements", perm: "farm.view",      icon: "Megaphone",   a: "orange",
    label: { en: "Announcements", hi: "घोषणाएँ",         bn: "ঘোষণা" },
    desc:  { en: "Notices for the farm", hi: "फ़ार्म की सूचनाएँ", bn: "খামারের বিজ্ঞপ্তি" } },
  { kind: "farmSpaceChat",     perm: "farm.chat.view",      icon: "MessageCircle", a: "blue",
    label: { en: "Farm chat",     hi: "फ़ार्म चैट",       bn: "খামার চ্যাট" },
    desc:  { en: "Talk to the team", hi: "टीम से बात करें", bn: "দলের সঙ্গে কথা" } },
  { kind: "farmSpaceDmInbox",  perm: "farm.chat.view",      icon: "MessageCircle", a: "primary",
    label: { en: "Direct messages", hi: "सीधे संदेश",     bn: "সরাসরি বার্তা" },
    desc:  { en: "Message one teammate privately", hi: "किसी एक साथी को निजी संदेश", bn: "একজন সহকর্মীকে ব্যক্তিগত বার্তা" } },
  { kind: "farmSpaceActivity", perm: "farm.view",           icon: "Activity",    a: "primary",
    label: { en: "Activity",      hi: "गतिविधि",         bn: "কার্যকলাপ" },
    desc:  { en: "What happened recently", hi: "हाल में क्या हुआ", bn: "সম্প্রতি যা হয়েছে" } },
  { kind: "farmSpaceSettings", perm: "farm.settings.manage", icon: "Settings",   a: "faint",
    label: { en: "Farm Space settings", hi: "फ़ार्म स्पेस सेटिंग्स", bn: "ফার্ম স্পেস সেটিংস" },
    desc:  { en: "Name, members, ownership", hi: "नाम, सदस्य, स्वामित्व", bn: "নাম, সদস্য, মালিকানা" } },
];

/* One place to turn an API failure into something a farmer can act on. A
   generic "something went wrong" would be useless here, because the likely
   causes — signed out, not configured, no signal — each need a different
   response from the user. */
export function farmErrorText(reason, tc) {
  switch (reason) {
    case FARM_ERROR.UNCONFIGURED:
      return tc({ en: "Farm Space isn't switched on for this app yet.",
                  hi: "इस ऐप में फ़ार्म स्पेस अभी चालू नहीं है।",
                  bn: "এই অ্যাপে ফার্ম স্পেস এখনও চালু হয়নি।" });
    case FARM_ERROR.SIGNED_OUT:
      return tc({ en: "Please sign in again to use Farm Space.",
                  hi: "फ़ार्म स्पेस के लिए फिर से साइन इन करें।",
                  bn: "ফার্ম স্পেস ব্যবহার করতে আবার সাইন ইন করুন।" });
    case FARM_ERROR.OFFLINE:
      return tc({ en: "Farm Space needs a connection — your team's work is shared, so it can't be read offline.",
                  hi: "फ़ार्म स्पेस के लिए कनेक्शन चाहिए — टीम का काम साझा होता है, इसलिए ऑफ़लाइन नहीं दिखता।",
                  bn: "ফার্ম স্পেসের জন্য সংযোগ দরকার — দলের কাজ ভাগ করা, তাই অফলাইনে দেখা যায় না।" });
    case FARM_ERROR.NOT_FOUND:
      return tc({ en: "You're no longer a member of this Farm Space.",
                  hi: "अब आप इस फ़ार्म स्पेस के सदस्य नहीं हैं।",
                  bn: "আপনি আর এই ফার্ম স্পেসের সদস্য নন।" });
    case FARM_ERROR.ARCHIVED:
      return tc({ en: "This Farm Space has been archived.",
                  hi: "यह फ़ार्म स्पेस संग्रहित कर दिया गया है।",
                  bn: "এই ফার্ম স্পেস আর্কাইভ করা হয়েছে।" });
    default:
      return tc({ en: "Could not load Farm Space. Please try again.",
                  hi: "फ़ार्म स्पेस लोड नहीं हो सका। फिर कोशिश करें।",
                  bn: "ফার্ম স্পেস লোড করা যায়নি। আবার চেষ্টা করুন।" });
  }
}

export default function FarmSpaceHub({ asTab = false }) {
  const { pop, push, tc } = useApp();
  const [space, setSpace] = useState(null);
  const [state, setState] = useState("loading");   // loading | ready | error | none
  const [reason, setReason] = useState(null);

  /* Resolves an already-fetched spaces list to what the hub should show,
     without deciding what to DO about ambiguity — that is load()'s call,
     because it depends on whether this list is the trusted server answer or
     just what a cache happened to remember. */
  const resolve = useCallback(async (spaces) => {
    if (!spaces.length) return { kind: "none" };
    const active = await farmSpaceService.active();
    return active ? { kind: "ready", space: active } : { kind: "ambiguous" };
  }, []);

  /* Cache-first: if the hub (or the picker, or the Home card) already fetched
     the space list this session, paint it immediately — a farmer switching
     from Tasks back to the hub should not wait on a network round trip to see
     something they were just looking at seconds ago. A background request
     still confirms it against the server, silently, so the screen catches up
     if something changed elsewhere; only the FIRST load of the session (no
     cache yet) is allowed to show a spinner or an error. */
  const load = useCallback(async () => {
    const cached = farmSpaceService.peekSpaces();
    let paintedFromCache = false;

    if (cached) {
      const result = await resolve(cached);
      if (result.kind === "ready") {
        setSpace(result.space); setState("ready"); paintedFromCache = true;
      } else if (result.kind === "none") {
        setState("none"); paintedFromCache = true;
      }
      /* "ambiguous" (more than one space, none chosen) is not painted from a
         cache — whether to send the farmer to the picker is decided from the
         server's current truth below, never from a list that might be stale. */
    }
    if (!paintedFromCache) setState("loading");

    try {
      const spaces = await farmSpaceService.spaces({ fresh: true });
      const result = await resolve(spaces);
      if (result.kind === "ready") { setSpace(result.space); setState("ready"); }
      else if (result.kind === "none") { setState("none"); }
      else { push({ kind: "farmSpacePicker" }); setState("none"); }
    } catch (err) {
      /* A failed background refresh must not tear down a screen that was
         already showing something correct a moment ago. */
      if (!paintedFromCache) {
        setReason(err?.reason || FARM_ERROR.FAILED);
        setState("error");
      }
    }
  }, [push, resolve]);

  useEffect(() => { load(); }, [load]);

  const title = tc({ en: "My Farm Space", hi: "मेरा फ़ार्म स्पेस", bn: "আমার ফার্ম স্পেস" });
  /* As the tab root there is nothing beneath this screen to return to, so the
     back arrow is omitted and the heading takes the larger tab-root style the
     other four tabs use. */
  const bar = asTab
    ? <AppBar title={title} large />
    : <AppBar title={title} onBack={pop} />;

  if (state === "loading") {
    return <>{bar}
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }

  if (state === "error") {
    return <>{bar}
      <div style={{ padding: 20 }}>
        <ErrorState body={farmErrorText(reason, tc)}
          onRetry={reason === FARM_ERROR.UNCONFIGURED ? undefined : load} />
      </div></>;
  }

  if (state === "none" || !space) {
    return <>{bar}
      <div style={{ padding: 20 }}>
        <EmptyState icon="Users"
          title={tc({ en: "No Farm Space yet", hi: "अभी कोई फ़ार्म स्पेस नहीं", bn: "এখনও কোনও ফার্ম স্পেস নেই" })}
          body={tc({ en: "Create one to work with your team — tasks, attendance and announcements shared with the people you invite. Your personal data stays private.",
                        hi: "टीम के साथ काम करने के लिए एक बनाएँ — कार्य, उपस्थिति और घोषणाएँ उन लोगों के साथ साझा जिन्हें आप बुलाते हैं। आपका निजी डेटा निजी रहता है।",
                        bn: "দলের সঙ্গে কাজ করতে একটি তৈরি করুন — কাজ, উপস্থিতি ও ঘোষণা আপনি যাদের ডাকবেন তাদের সঙ্গে ভাগ করা। আপনার ব্যক্তিগত তথ্য ব্যক্তিগতই থাকে।" })} />
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <Button full onClick={() => push({ kind: "farmSpaceCreate" })}>
            {tc({ en: "Create a Farm Space", hi: "फ़ार्म स्पेस बनाएँ", bn: "ফার্ম স্পেস তৈরি করুন" })}
          </Button>
          <Button full variant="soft" onClick={() => push({ kind: "farmSpaceInvites" })}>
            {tc({ en: "I have an invitation", hi: "मेरे पास निमंत्रण है", bn: "আমার একটি আমন্ত্রণ আছে" })}
          </Button>
        </div>
      </div></>;
  }

  const roleLabel = tc(farmSpaceService.roleLabel(space.role));
  const visible = MENU.filter((m) => farmSpaceService.can(space, m.perm));

  return (
    <>
      {bar}
      <div style={{ padding: `4px 16px 24px`, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* which space, and who you are inside it — the two facts that decide
            what everything below means */}
        <Card elevated style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, display: "grid", placeItems: "center",
            background: T.primarySoft, color: T.primary }}>
            <Icon name="Sprout" size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 700, color: T.ink }}>{space.name}</div>
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 1 }}>
              {roleLabel}
              {space.member_count ? ` · ${tc({
                en: `${space.member_count} member${space.member_count > 1 ? "s" : ""}`,
                hi: `${space.member_count} सदस्य`,
                bn: `${space.member_count} জন সদস্য`,
              })}` : ""}
            </div>
          </div>
          <SwitchSpace />
        </Card>

        <PendingInviteBanner />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visible.map((m) => (
            <Card key={m.kind} pad={0}>
              <button
                onClick={() => push({ kind: m.kind })}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "13px 12px",
                  background: "none", border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
                <IconTile name={m.icon} accent={m.a} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{tc(m.label)}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{tc(m.desc)}</div>
                </div>
                <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
              </button>
            </Card>
          ))}
        </div>

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({ en: "Only what you see here is shared with your team. Your profile, AI history, payments and personal documents stay private.",
                hi: "यहाँ जो दिख रहा है वही टीम के साथ साझा है। आपकी प्रोफ़ाइल, AI इतिहास, भुगतान और निजी दस्तावेज़ निजी रहते हैं।",
                bn: "এখানে যা দেখছেন কেবল তাই দলের সঙ্গে ভাগ করা। আপনার প্রোফাইল, AI ইতিহাস, পেমেন্ট ও ব্যক্তিগত নথি ব্যক্তিগতই থাকে।" })}
        </div>
      </div>
    </>
  );
}

/* Only worth drawing for someone who actually belongs to more than one space —
   most farmers have one, and a switcher would just be a control that does
   nothing. */
function SwitchSpace() {
  const { push, tc } = useApp();
  const [many, setMany] = useState(false);

  useEffect(() => {
    let alive = true;
    farmSpaceService.spaces().then((s) => { if (alive) setMany(s.length > 1); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!many) return null;
  return (
    <button onClick={() => push({ kind: "farmSpacePicker" })}
      aria-label={tc({ en: "Switch Farm Space", hi: "फ़ार्म स्पेस बदलें", bn: "ফার্ম স্পেস বদলান" })}
      style={{ background: T.surface2, border: "none", borderRadius: 11, padding: "8px 10px", cursor: "pointer",
        color: T.primary, fontSize: 12.5, fontWeight: 600, fontFamily: T.body, flexShrink: 0 }}>
      {tc({ en: "Switch", hi: "बदलें", bn: "বদলান" })}
    </button>
  );
}

/* Reaching a pending invitation used to depend on having NO Farm Space yet —
   the empty state above offers it, but someone who already belongs to one
   and receives a second invitation had no way in at all. This is the fix:
   shown whenever there is something waiting, regardless of what else the hub
   is showing. */
function PendingInviteBanner() {
  const { push, tc } = useApp();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => farmSpaceService.invitations().then((i) => { if (alive) setCount(i.length); }).catch(() => {});
    load();
    const off = onFarmSpaceChanged(load);
    return () => { alive = false; off(); };
  }, []);

  if (!count) return null;
  return (
    <Card pad={0}>
      <button onClick={() => push({ kind: "farmSpaceInvites" })}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "13px 12px",
          background: "none", border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
        <IconTile name="MailOpen" accent="orange" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>
            {tc({ en: count > 1 ? `${count} farm invitations` : "You've been invited to a farm",
                  hi: count > 1 ? `${count} फ़ार्म निमंत्रण` : "आपको एक फ़ार्म में बुलाया गया है",
                  bn: count > 1 ? `${count}টি খামার আমন্ত্রণ` : "আপনাকে একটি খামারে ডাকা হয়েছে" })}
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>
            {tc({ en: "Tap to accept or decline", hi: "स्वीकारने या मना करने के लिए टैप करें", bn: "গ্রহণ বা প্রত্যাখ্যান করতে ট্যাপ করুন" })}
          </div>
        </div>
        <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
      </button>
    </Card>
  );
}
