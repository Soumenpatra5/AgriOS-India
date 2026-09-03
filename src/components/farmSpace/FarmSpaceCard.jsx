import { useState, useEffect } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { Card } from "../index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, onFarmSpaceChanged } from "../../services/farmSpace/farmSpaceService.js";
import { notificationService } from "../../services/notifications/notificationService.js";

/* The Farm Space entry point on Home.

   Renders nothing at all unless the farmer either belongs to a space or has an
   invitation waiting. Most AgriOS users work alone, and a permanent card
   advertising a collaboration feature they will never use is clutter on a
   screen that already has plenty. It appears the moment it becomes relevant.

   Failures are silent here for the same reason: Home must not show an error
   about a feature the user may not even use. The hub, which the user opens
   deliberately, is where a real explanation belongs. */

/* Home is where a farmer lands first, so it is the one place that announces a
   new invitation — the same seen-once pattern FarmSpaceTasks.jsx uses for new
   tasks, so returning to a screen that already showed one does not re-alert.

   The first call this session only records what already exists; it never
   dispatches — otherwise every already-pending invitation would notify on
   every fresh sign-in, not just ones that arrive from here on. */
const seen = new Set();
let announcedFirstLoad = false;
function announceNew(invitations, tc) {
  const canDispatch = notificationService.isEnabled?.();
  for (const i of invitations) {
    if (seen.has(i.id)) continue;
    seen.add(i.id);
    if (announcedFirstLoad && canDispatch) {
      notificationService.dispatch(
        tc({ en: "Farm Space invitation", hi: "फ़ार्म स्पेस निमंत्रण", bn: "ফার্ম স্পেস আমন্ত্রণ" }),
        tc({ en: `Invited to ${i.space_name}`, hi: `${i.space_name} में बुलाया गया`, bn: `${i.space_name}-এ ডাকা হয়েছে` }),
        `farm-invite-${i.id}`,
      );
    }
  }
  announcedFirstLoad = true;
}

export default function FarmSpaceCard() {
  const { push, tc } = useApp();
  const [space, setSpace] = useState(null);
  const [invites, setInvites] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const [spaces, invitations] = await Promise.all([
          farmSpaceService.spaces().catch(() => []),
          farmSpaceService.invitations().catch(() => []),
        ]);
        if (!alive) return;
        setInvites(invitations.length);
        announceNew(invitations, tc);
        setSpace(spaces.length ? (await farmSpaceService.active()) ?? spaces[0] : null);
      } catch { /* Home stays quiet — see the note above. */ }
      finally { if (alive) setReady(true); }
    };

    load();
    const off = onFarmSpaceChanged(load);
    return () => { alive = false; off(); };
  }, [tc]);

  if (!ready || (!space && !invites)) return null;

  /* An invitation is the more urgent of the two: it expires, and it is the
     only one that needs an answer. */
  if (invites && !space) {
    return (
      <div style={{ order: -9, padding: `12px 16px 0` }}>
        <Card pad={0}>
          <button onClick={() => push({ kind: "farmSpaceInvites" })}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "14px 12px",
              background: "none", border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center",
              background: T.orangeSoft, color: T.orange }}>
              <Icon name="MailOpen" size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>
                {tc({ en: invites > 1 ? `${invites} farm invitations` : "You've been invited to a farm",
                      hi: invites > 1 ? `${invites} फ़ार्म निमंत्रण` : "आपको एक फ़ार्म में बुलाया गया है",
                      bn: invites > 1 ? `${invites}টি খামার আমন্ত্রণ` : "আপনাকে একটি খামারে ডাকা হয়েছে" })}
              </div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>
                {tc({ en: "Tap to accept or decline", hi: "स्वीकारने या मना करने के लिए टैप करें", bn: "গ্রহণ বা প্রত্যাখ্যান করতে ট্যাপ করুন" })}
              </div>
            </div>
            <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ order: -9, padding: `12px 16px 0` }}>
      <Card pad={0}>
        <button onClick={() => push({ kind: "farmSpace" })}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "14px 12px",
            background: "none", border: "none", cursor: "pointer", fontFamily: T.body, textAlign: "left" }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center",
            background: T.primarySoft, color: T.primary }}>
            <Icon name="Users" size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: .5 }}>
              {tc({ en: "My Farm Space", hi: "मेरा फ़ार्म स्पेस", bn: "আমার ফার্ম স্পেস" })}
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, marginTop: 2 }}>{space.name}</div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>
              {tc(farmSpaceService.roleLabel(space.role))}
              {space.member_count ? ` · ${tc({
                en: `${space.member_count} member${space.member_count > 1 ? "s" : ""}`,
                hi: `${space.member_count} सदस्य`,
                bn: `${space.member_count} জন সদস্য`,
              })}` : ""}
            </div>
          </div>
          {invites > 0 && (
            <div style={{ background: T.orangeSoft, color: T.orange, borderRadius: 99, padding: "3px 8px",
              fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{invites}</div>
          )}
          <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
        </button>
      </Card>
    </div>
  );
}
