import { useState, useEffect, useRef } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { Button, OtpInput } from "../components/index.js";
import { useApp } from "../store/AppStore.jsx";
import { signInWithToken } from "../services/firebase/auth.js";
import { otpApi, OTP_ERROR } from "../services/auth/otpApi.js";

/* Entering the code sent by WhatsApp.

   The screen knows almost nothing: it holds a challenge id and posts a code.
   Whether that code is right, how many guesses remain and whether a resend is
   allowed are all decided by the server — the browser is never in a position
   to talk itself into a session.

   On success the server returns a Firebase custom token, which is exchanged
   here for a real session. From that moment the app is in exactly the state it
   would be in after a Google sign-in, so nothing downstream needs to know a
   code was ever involved. */

const display = (p) => (p ? `${String(p).slice(0, 5)} ${String(p).slice(5)}` : "");

export default function OtpVerify({ phone, challengeId, channel, resendInSeconds = 45, onBack }) {
  const { login, tc } = useApp();
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState(challengeId);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [left, setLeft] = useState(resendInSeconds);

  /* A live countdown, so "resend" is visibly unavailable rather than silently
     refused by the server a second later. */
  const tick = useRef(null);
  useEffect(() => {
    clearInterval(tick.current);
    if (left <= 0) return undefined;
    tick.current = setInterval(() => setLeft((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(tick.current);
  }, [left]);

  const ok = code.length === 6 && !loading;

  const verify = async () => {
    if (!ok) return;
    setError(""); setNotice(""); setLoading(true);
    try {
      const { customToken, isNewAccount } = await otpApi.verify(challenge, code);

      /* Exchange the one-time token for a real Firebase session. Everything
         after this — onAuthStateChanged, getIdToken, the Farm Space gate — is
         the app's ordinary signed-in path. */
      const fbUser = await signInWithToken(customToken);
      login({ phone, uid: fbUser.uid, name: fbUser.displayName || "", joined: Date.now(), isNewAccount });
    } catch (err) {
      /* Only OUR api's messages are shown as written — they carry a reason and
         are phrased for a farmer, including how many attempts are left.

         A Firebase SDK error has neither. Showing its message put
         "Invalid assertion format. 3 dot separated segments required.
         (auth/invalid-custom-token)" in front of someone trying to log in,
         which tells them nothing and leaks how sign-in is wired. Anything
         without a reason becomes a plain sentence instead. */
      const ours = !!err?.reason;
      setError(ours
        ? err.message
        : tc({ en: "We couldn't sign you in. Please try again.",
               hi: "हम आपको साइन इन नहीं कर सके। कृपया फिर कोशिश करें।",
               bn: "আমরা আপনাকে সাইন ইন করাতে পারিনি। আবার চেষ্টা করুন।" }));
      if (!ours) console.error("[otp] sign-in failed", err?.code || err?.message);
      if (err?.reason !== OTP_ERROR.BAD_INPUT) setCode("");
    } finally {
      setLoading(false);
    }
  };

  const resend = async (via) => {
    if (resending || (left > 0 && via === channel)) return;
    setError(""); setNotice(""); setResending(true);
    try {
      const res = await otpApi.resend(phone, via);
      /* A resend issues a NEW challenge and invalidates the old one, so the
         id must be replaced or the next verify would target a dead code. */
      setChallenge(res.challengeId);
      setLeft(res.resendInSeconds ?? 45);
      setCode("");
      setNotice(via === "whatsapp"
        ? tc({ en: "New code sent on WhatsApp.", hi: "WhatsApp पर नया कोड भेजा गया।", bn: "WhatsApp-এ নতুন কোড পাঠানো হয়েছে।" })
        : tc({ en: "New code sent by SMS.", hi: "SMS से नया कोड भेजा गया।", bn: "SMS-এ নতুন কোড পাঠানো হয়েছে।" }));
    } catch (err) {
      setError(err?.reason
        ? err.message
        : tc({ en: "Could not resend the code.", hi: "कोड फिर नहीं भेजा जा सका।", bn: "কোড আবার পাঠানো যায়নি।" }));
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "44px 22px 24px" }}>
      <button onClick={onBack} aria-label={tc({ en: "Back", hi: "वापस", bn: "ফিরে যান" })}
        style={{ position: "absolute", top: 16, left: 16, background: "none", border: "none",
          cursor: "pointer", fontSize: 20, color: T.inkFaint, padding: 4 }}>←</button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 380, margin: "0 auto", width: "100%" }}>
        <div style={{ width: 54, height: 54, borderRadius: 17, margin: "0 auto 18px", display: "grid",
          placeItems: "center", background: T.primarySoft, color: T.primary }}>
          <Icon name={channel === "sms" ? "MessageSquare" : "MessageCircle"} size={25} />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px", color: T.ink, textAlign: "center", fontFamily: "inherit" }}>
          {tc({ en: "Enter the code", hi: "कोड दर्ज करें", bn: "কোড লিখুন" })}
        </h1>
        <p style={{ fontSize: 13.5, color: T.inkSoft, textAlign: "center", margin: "0 0 24px", lineHeight: 1.55 }}>
          {channel === "sms"
            ? tc({ en: "We sent a 6-digit code by SMS to", hi: "हमने SMS से 6 अंकों का कोड भेजा", bn: "আমরা SMS-এ ৬ সংখ্যার কোড পাঠিয়েছি" })
            : tc({ en: "We sent a 6-digit code on WhatsApp to", hi: "हमने WhatsApp पर 6 अंकों का कोड भेजा", bn: "আমরা WhatsApp-এ ৬ সংখ্যার কোড পাঠিয়েছি" })}
          <br />
          <strong style={{ color: T.ink }}>+91 {display(phone)}</strong>
        </p>

        <OtpInput length={6} value={code} onChange={(v) => { setCode(v); setError(""); }} />

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16,
            padding: "12px 14px", borderRadius: 10, background: T.redSoft, border: `1px solid ${T.red}` }}>
            <Icon name="AlertCircle" size={16} style={{ color: T.red, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: T.red }}>{error}</span>
          </div>
        )}
        {notice && !error && (
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: T.primarySoft,
            fontSize: 13, color: T.primary, textAlign: "center" }}>{notice}</div>
        )}

        <div style={{ marginTop: 20 }}>
          <Button full onClick={verify} disabled={!ok}>
            {loading ? tc({ en: "Verifying…", hi: "सत्यापन हो रहा है…", bn: "যাচাই হচ্ছে…" })
                     : tc({ en: "Verify", hi: "सत्यापित करें", bn: "যাচাই করুন" })}
          </Button>
        </div>

        <div style={{ marginTop: 18, textAlign: "center", fontSize: 13, color: T.inkSoft }}>
          {left > 0 ? (
            tc({ en: `You can ask for a new code in ${left}s`,
                 hi: `${left} सेकंड बाद नया कोड मांग सकते हैं`,
                 bn: `${left} সেকেন্ড পরে নতুন কোড চাইতে পারবেন` })
          ) : (
            <button onClick={() => resend(channel)} disabled={resending}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                color: T.primary, fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
              {resending ? tc({ en: "Sending…", hi: "भेजा जा रहा है…", bn: "পাঠানো হচ্ছে…" })
                         : tc({ en: "Send a new code", hi: "नया कोड भेजें", bn: "নতুন কোড পাঠান" })}
            </button>
          )}
        </div>

        {/* The fallback the brief asks for: when WhatsApp did not work, offer
            the other way rather than leaving someone stuck on a screen. */}
        {channel === "whatsapp" && error && (
          <div style={{ marginTop: 10, textAlign: "center" }}>
            <button onClick={() => resend("sms")} disabled={resending}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                color: T.inkSoft, fontSize: 12.5, fontFamily: "inherit", textDecoration: "underline" }}>
              {tc({ en: "Send by SMS instead", hi: "इसके बजाय SMS भेजें", bn: "বরং SMS পাঠান" })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
