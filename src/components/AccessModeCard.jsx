import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "./Icon.jsx";
import { Card, Chip, BottomSheet, Button } from "./index.js";
import { useApp } from "../store/AppStore.jsx";
import { roleService } from "../services/rbac/roleService.js";
import { ROLES, ROLE_META } from "../services/rbac/permissions.js";

/* Device-local access-role switcher (M7). Owner can drop the device into a
   restricted role (hiding salaries/documents/finance/settings); elevating back
   needs the owner PIN. Default role is Owner, so this is invisible-by-effect
   until someone actually restricts the device. */
export default function AccessModeCard() {
  const { role, setRole, tc, toast } = useApp();
  const [sheet, setSheet] = useState(null); // { kind: "elevate", target } | { kind: "setpin" }
  const [pin, setPin] = useState("");
  const hasPin = roleService.hasPin();
  const close = () => { setSheet(null); setPin(""); };

  const choose = (target) => {
    if (target === role) return;
    if (roleService.switchNeedsPin(target)) { setSheet({ kind: "elevate", target }); setPin(""); return; }
    setRole(target);
    toast(tc({ en: `Now in ${ROLE_META[target].label.en} mode`, hi: `अब ${ROLE_META[target].label.hi} मोड में`, bn: `এখন ${ROLE_META[target].label.bn} মোডে` }), "success");
  };

  const submit = async () => {
    if (sheet?.kind === "setpin") {
      if (pin.length < 4) { toast(tc({ en: "PIN must be at least 4 digits", hi: "पिन कम से कम 4 अंकों का", bn: "পিন কমপক্ষে ৪ সংখ্যা" }), "info"); return; }
      await roleService.setPin(pin); close();
      toast(tc({ en: "Owner PIN saved", hi: "मालिक पिन सहेजा गया", bn: "মালিক পিন সংরক্ষিত" }), "success");
    } else if (sheet?.kind === "elevate") {
      if (await roleService.verifyPin(pin)) {
        setRole(sheet.target); close();
        toast(tc({ en: "Unlocked", hi: "अनलॉक हो गया", bn: "আনলক হয়েছে" }), "success");
      } else { setPin(""); toast(tc({ en: "Wrong PIN", hi: "गलत पिन", bn: "ভুল পিন" }), "info"); }
    }
  };

  return (
    <>
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="ShieldCheck" size={18} style={{ color: T.primary }} />
          <div style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>{tc({ en: "Access mode", hi: "एक्सेस मोड", bn: "অ্যাক্সেস মোড" })}</div>
        </div>
        <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>
          {tc({ en: "Hand the device to a worker in a restricted mode — salaries, documents, finances and settings stay hidden. Elevating needs the owner PIN.",
            hi: "सीमित मोड में डिवाइस कर्मचारी को दें — वेतन, दस्तावेज़, वित्त और सेटिंग्स छिपी रहती हैं। ऊपर जाने के लिए मालिक पिन चाहिए।",
            bn: "সীমিত মোডে কর্মীকে ডিভাইস দিন — বেতন, নথি, অর্থ ও সেটিংস লুকানো থাকে। উপরে যেতে মালিক পিন লাগে।" })}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ROLES.map((r) => {
            const locked = hasPin && ROLE_META[r].rank > ROLE_META[role].rank;
            return (
              <Chip key={r} active={role === r} onClick={() => choose(r)}>
                {tc(ROLE_META[r].label)}{locked ? " 🔒" : ""}
              </Chip>
            );
          })}
        </div>
        <button onClick={() => { setSheet({ kind: "setpin" }); setPin(""); }}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: T.primary, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: T.body, padding: 0 }}>
          {hasPin
            ? tc({ en: "Change owner PIN", hi: "मालिक पिन बदलें", bn: "মালিক পিন পরিবর্তন" })
            : tc({ en: "Set an owner PIN", hi: "मालिक पिन सेट करें", bn: "মালিক পিন সেট করুন" })}
        </button>
      </Card>

      <BottomSheet open={!!sheet} onClose={close}
        title={sheet?.kind === "setpin"
          ? tc({ en: "Set owner PIN", hi: "मालिक पिन सेट करें", bn: "মালিক পিন সেট করুন" })
          : tc({ en: "Enter owner PIN", hi: "मालिक पिन भरें", bn: "মালিক পিন লিখুন" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0 8px" }}>
          <input type="password" inputMode="numeric" autoFocus value={pin} maxLength={8}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="••••"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, fontSize: 20, letterSpacing: 6, textAlign: "center",
              border: `1px solid ${T.line}`, background: T.surface2, color: T.ink, outline: "none", boxSizing: "border-box", fontFamily: T.body }} />
          <Button full onClick={submit}>{tc({ en: "Confirm", hi: "पुष्टि करें", bn: "নিশ্চিত করুন" })}</Button>
        </div>
      </BottomSheet>
    </>
  );
}
