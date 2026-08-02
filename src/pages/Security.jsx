import { useState } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { AppBar, Card, Dialog } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { resetPassword } from "../services/firebase/auth.js";

const PROVIDER_LABELS = {
  "google.com": "Google", "facebook.com": "Facebook", "apple.com": "Apple", "twitter.com": "Twitter",
  google: "Google", facebook: "Facebook", apple: "Apple", twitter: "Twitter", phone: "Phone", password: "Email & password",
};

function Row({ icon, label, sub, onClick, danger, children }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 12px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: danger ? T.redSoft : T.surface2, color: danger ? T.red : T.inkSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 500, color: danger ? T.red : T.ink }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, color: T.inkSoft }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export default function Security() {
  const { pop, tc, toast, user, logout } = useApp();
  const [confirm, setConfirm] = useState(false);
  const isPassword = user?.provider === "password";
  const providerLabel = PROVIDER_LABELS[user?.provider] || tc({ en: "Unknown", hi: "अज्ञात", bn: "অজানা" });

  const changePassword = async () => {
    if (!user?.email) { toast(tc({ en: "No email on this account", hi: "इस खाते पर कोई ईमेल नहीं", bn: "এই অ্যাকাউন্টে কোনো ইমেইল নেই" }), "info"); return; }
    try { await resetPassword(user.email); toast(tc({ en: "Password reset link sent to your email", hi: "पासवर्ड रीसेट लिंक आपके ईमेल पर भेजा गया", bn: "পাসওয়ার্ড রিসেট লিঙ্ক আপনার ইমেইলে পাঠানো হয়েছে" }), "success"); }
    catch { toast(tc({ en: "Couldn't send reset link", hi: "रीसेट लिंक नहीं भेजा जा सका", bn: "রিসেট লিঙ্ক পাঠানো যায়নি" }), "error"); }
  };

  return (
    <>
      <AppBar title={tc({ en: "Security", hi: "सुरक्षा", bn: "নিরাপত্তা" })} onBack={pop} />
      <div style={{ padding: "4px 16px 28px", display: "flex", flexDirection: "column", gap: 16, animation: "ag-fade .25s var(--ag-ease)" }}>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .4, marginBottom: 10, padding: "0 2px" }}>{tc({ en: "Sign-in", hi: "साइन-इन", bn: "সাইন-ইন" })}</div>
          <Card pad={6}>
            <Row icon="Shield" label={tc({ en: "Signed in with", hi: "साइन इन के साथ", bn: "সাইন ইন করা" })} sub={providerLabel}>
              <Icon name="BadgeCheck" size={18} style={{ color: T.primary }} />
            </Row>
            {(user?.email || user?.phone) && (
              <div style={{ borderTop: `1px solid ${T.lineSoft}` }}>
                <Row icon="User" label={user?.email || `+91 ${user?.phone}`} sub={tc({ en: "Your account", hi: "आपका खाता", bn: "আপনার অ্যাকাউন্ট" })} />
              </div>
            )}
          </Card>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .4, marginBottom: 10, padding: "0 2px" }}>{tc({ en: "Password", hi: "पासवर्ड", bn: "পাসওয়ার্ড" })}</div>
          <Card pad={6}>
            {isPassword ? (
              <Row icon="Lock" label={tc({ en: "Change password", hi: "पासवर्ड बदलें", bn: "পাসওয়ার্ড বদলান" })} sub={tc({ en: "We'll email you a reset link", hi: "हम आपको रीसेट लिंक ईमेल करेंगे", bn: "আমরা আপনাকে রিসেট লিঙ্ক ইমেইল করব" })} onClick={changePassword}>
                <Icon name="ChevronRight" size={18} style={{ color: T.inkFaint }} />
              </Row>
            ) : (
              <Row icon="Lock" label={tc({ en: "Managed by your provider", hi: "आपके प्रदाता द्वारा प्रबंधित", bn: "আপনার প্রদানকারী দ্বারা পরিচালিত" })} sub={tc({ en: "Password is set with " + providerLabel, hi: providerLabel + " के साथ पासवर्ड", bn: providerLabel + " দিয়ে পাসওয়ার্ড" })} />
            )}
          </Card>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: .4, marginBottom: 10, padding: "0 2px" }}>{tc({ en: "Session", hi: "सत्र", bn: "সেশন" })}</div>
          <Card pad={6}>
            <Row icon="LogOut" label={tc({ en: "Log out of this device", hi: "इस डिवाइस से लॉग आउट करें", bn: "এই ডিভাইস থেকে লগ আউট" })} onClick={() => setConfirm(true)} danger>
              <Icon name="ChevronRight" size={18} style={{ color: T.red }} />
            </Row>
          </Card>
        </div>

        <div style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", lineHeight: 1.6 }}>
          {tc({ en: "AgriOS never asks for your password or OTP outside the sign-in screen.", hi: "AgriOS साइन-इन स्क्रीन के बाहर कभी आपका पासवर्ड या OTP नहीं माँगता।", bn: "AgriOS সাইন-ইন স্ক্রিনের বাইরে কখনও আপনার পাসওয়ার্ড বা OTP চায় না।" })}
        </div>
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title={tc({ en: "Log out?", hi: "लॉग आउट करें?", bn: "লগ আউট করবেন?" })}
        body={tc({ en: "You'll need to sign in again.", hi: "आपको फिर से साइन इन करना होगा।", bn: "আপনাকে আবার সাইন ইন করতে হবে।" })} icon="LogOut" danger
        confirmLabel={tc({ en: "Log out", hi: "लॉग आउट", bn: "লগ আউট" })} cancelLabel={tc({ en: "Cancel", hi: "रद्द करें", bn: "বাতিল" })} onConfirm={logout} />
    </>
  );
}
