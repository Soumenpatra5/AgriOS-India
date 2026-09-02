import { useState, useEffect, useCallback } from "react";
import { T } from "../../theme/ThemeProvider.jsx";
import Icon from "../../components/Icon.jsx";
import { AppBar, Card, Button, EmptyState, ErrorState, Spinner } from "../../components/index.js";
import { useApp } from "../../store/AppStore.jsx";
import { farmSpaceService, FARM_ERROR } from "../../services/farmSpace/farmSpaceService.js";
import { farmErrorText } from "./FarmSpaceHub.jsx";

/* Invitations addressed to this user.

   The server matches these on the invitee's own phone number, not on
   possession of an invitation id — so this list can only ever contain
   invitations genuinely meant for the signed-in person, and accepting one
   someone else was sent is refused even if its id is known. */

export default function FarmSpaceInvites() {
  const { pop, tc, toast } = useApp();
  const [invites, setInvites] = useState([]);
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      setInvites(await farmSpaceService.invitations({ fresh: true }));
      setState("ready");
    } catch (err) {
      setReason(err?.reason || FARM_ERROR.FAILED);
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (invite, accept) => {
    setBusyId(invite.id);
    try {
      if (accept) {
        await farmSpaceService.accept(invite.id);
        toast(tc({ en: `You've joined ${invite.space_name}.`,
                   hi: `आप ${invite.space_name} में शामिल हो गए।`,
                   bn: `আপনি ${invite.space_name}-এ যোগ দিয়েছেন।` }), "success");
        pop();
      } else {
        await farmSpaceService.decline(invite.id);
        setInvites((list) => list.filter((i) => i.id !== invite.id));
      }
    } catch (err) {
      toast(farmErrorText(err?.reason, tc), "error");
    } finally {
      setBusyId(null);
    }
  };

  const title = tc({ en: "Invitations", hi: "निमंत्रण", bn: "আমন্ত্রণ" });

  if (state === "loading") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 60, display: "grid", placeItems: "center" }}><Spinner /></div></>;
  }
  if (state === "error") {
    return <><AppBar title={title} onBack={pop} />
      <div style={{ padding: 20 }}><ErrorState message={farmErrorText(reason, tc)} onRetry={load} /></div></>;
  }

  return (
    <>
      <AppBar title={title} onBack={pop} />
      <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {!invites.length ? (
          <EmptyState icon="MailOpen"
            title={tc({ en: "No invitations", hi: "कोई निमंत्रण नहीं", bn: "কোনও আমন্ত্রণ নেই" })}
            message={tc({ en: "When someone invites you to their Farm Space, it will appear here. Invitations are sent to your registered phone number.",
                          hi: "जब कोई आपको अपने फ़ार्म स्पेस में बुलाएगा, वह यहाँ दिखेगा। निमंत्रण आपके पंजीकृत मोबाइल नंबर पर आते हैं।",
                          bn: "কেউ আপনাকে তাদের ফার্ম স্পেসে ডাকলে এখানে দেখা যাবে। আমন্ত্রণ আপনার নিবন্ধিত মোবাইল নম্বরে আসে।" })} />
        ) : invites.map((i) => (
          <Card key={i.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center",
                background: T.primarySoft, color: T.primary }}>
                <Icon name="Sprout" size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{i.space_name}</div>
                <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 1 }}>
                  {tc({ en: "Invited as", hi: "इस भूमिका में", bn: "যে ভূমিকায়" })} {tc(farmSpaceService.roleLabel(i.role))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 9 }}>
              <div style={{ flex: 1 }}>
                <Button full disabled={busyId === i.id} onClick={() => act(i, true)}>
                  {tc({ en: "Accept", hi: "स्वीकारें", bn: "গ্রহণ করুন" })}
                </Button>
              </div>
              <div style={{ flex: 1 }}>
                <Button full variant="soft" disabled={busyId === i.id} onClick={() => act(i, false)}>
                  {tc({ en: "Decline", hi: "अस्वीकारें", bn: "প্রত্যাখ্যান" })}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
