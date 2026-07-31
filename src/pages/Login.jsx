import { useState, useEffect } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import Icon from "../components/Icon.jsx";
import { useApp } from "../store/AppStore.jsx";
import {
  setupRecaptcha,
  sendOtp,
  signInWithGoogle,
  signInWithApple,
  signInWithFacebook,
  signInWithTwitter,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
} from "../services/firebase/auth.js";

const ERR = {
  "auth/invalid-credential":   { en: "Incorrect email or password", hi: "गलत ईमेल या पासवर्ड", bn: "ভুল ইমেইল বা পাসওয়ার্ড" },
  "auth/wrong-password":       { en: "Incorrect password", hi: "गलत पासवर्ड", bn: "ভুল পাসওয়ার্ড" },
  "auth/user-not-found":       { en: "No account found — please sign up", hi: "कोई खाता नहीं मिला — साइन अप करें", bn: "কোনো অ্যাকাউন্ট পাওয়া যায়নি — সাইন আপ করুন" },
  "auth/email-already-in-use": { en: "Account already exists — please log in", hi: "खाता पहले से मौजूद है — लॉग इन करें", bn: "অ্যাকাউন্ট ইতিমধ্যে আছে — লগ ইন করুন" },
  "auth/invalid-email":        { en: "Invalid email address", hi: "अमान्य ईमेल पता", bn: "অবৈধ ইমেইল ঠিকানা" },
  "auth/weak-password":        { en: "Password must be at least 6 characters", hi: "पासवर्ड कम से कम 6 अक्षर का होना चाहिए", bn: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে" },
  "auth/too-many-requests":    { en: "Too many attempts — please wait and try again", hi: "बहुत अधिक प्रयास — कृपया प्रतीक्षा करें", bn: "অনেক বেশি চেষ্টা — অনুগ্রহ করে অপেক্ষা করুন" },
  "auth/network-request-failed": { en: "Network error — check your connection", hi: "नेटवर्क त्रुटि — कनेक्शन जाँचें", bn: "নেটওয়ার্ক ত্রুটি — সংযোগ পরীক্ষা করুন" },
  "auth/popup-blocked":        { en: "Popup blocked — allow popups and try again", hi: "पॉपअप अवरुद्ध — पॉपअप अनुमति दें", bn: "পপআপ ব্লক — পপআপ অনুমতি দিন" },
  "auth/account-exists-with-different-credential": { en: "Account exists with a different sign-in method", hi: "खाता पहले से अलग तरीके से जुड़ा है", bn: "অ্যাকাউন্ট অন্য সাইন-ইন পদ্ধতিতে আছে" },
};

function authError(err, tc) {
  const msg = ERR[err?.code];
  if (msg) return tc(msg);
  return tc({ en: `Login failed (${err?.code || "unknown"})`, hi: `लॉगिन विफल (${err?.code || "अज्ञात"})`, bn: `লগইন ব্যর্থ (${err?.code || "অজানা"})` });
}

export default function Login() {
  const { login, t, tc } = useApp();
  const [step, setStep] = useState("main");
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { setupRecaptcha("recaptcha-container"); }, []);

  const fbLogin = (fbUser) => {
    login({
      uid: fbUser.uid, name: fbUser.displayName || "",
      email: fbUser.email || "", phone: fbUser.phoneNumber?.replace("+91", "") || "",
      photo: fbUser.photoURL || "", provider: fbUser.providerData?.[0]?.providerId || "", joined: Date.now(),
    });
  };

  const handleSocial = async (id, fn) => {
    setError(""); setSocialLoading(id);
    try {
      const fbUser = await fn();
      fbLogin(fbUser);
    } catch (err) {
      if (err?.code !== "auth/popup-closed-by-user") setError(authError(err, tc));
    } finally { setSocialLoading(null); }
  };

  const handleEmailSubmit = async () => {
    if (step === "main") { setStep("email"); setError(""); return; }
    if (!email.includes("@") || password.length < 6) return;
    setError(""); setLoading(true);
    try {
      const fbUser = mode === "signup"
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);
      fbLogin(fbUser);
    } catch (err) {
      // If login fails with invalid-credential, suggest signing up
      if (mode === "login" && (err?.code === "auth/invalid-credential" || err?.code === "auth/user-not-found")) {
        setError(tc({ en: "Incorrect email or password. If you're new, switch to Sign Up.", hi: "गलत ईमेल या पासवर्ड। अगर आप नए हैं, तो साइन अप पर जाएँ।", bn: "ভুল ইমেইল বা পাসওয়ার্ড। আপনি নতুন হলে সাইন আপ-এ যান।" }));
      } else if (mode === "signup" && err?.code === "auth/email-already-in-use") {
        setError(tc({ en: "Account already exists — switch to Log In.", hi: "खाता पहले से मौजूद है — लॉग इन पर जाएँ।", bn: "অ্যাকাউন্ট ইতিমধ্যে আছে — লগ ইন-এ যান।" }));
      } else {
        setError(authError(err, tc));
      }
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    setError(""); setNotice("");
    if (!email.includes("@")) {
      setError(tc({ en: "Enter your email above first, then tap Forgot password.", hi: "पहले ऊपर अपना ईमेल भरें, फिर पासवर्ड भूल गए पर टैप करें।", bn: "আগে উপরে আপনার ইমেইল লিখুন, তারপর পাসওয়ার্ড ভুলে গেছেন-এ ট্যাপ করুন।" }));
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setNotice(tc({ en: "Password reset link sent — check your email.", hi: "पासवर्ड रीसेट लिंक भेजा गया — अपना ईमेल देखें।", bn: "পাসওয়ার্ড রিসেট লিঙ্ক পাঠানো হয়েছে — আপনার ইমেইল দেখুন।" }));
    } catch (err) {
      setError(authError(err, tc));
    } finally { setLoading(false); }
  };

  const disabled = !!socialLoading || loading;

  const btnStyle = {
    width: "100%", display: "flex", alignItems: "center", gap: 12,
    padding: "13px 16px", borderRadius: 12, cursor: "pointer",
    fontFamily: "inherit", fontSize: 15, fontWeight: 500,
    background: "#f5f5f5", border: "1px solid #e5e5e5", color: "#1a1a1a",
    transition: "background 0.15s",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, background: "#1a1a1a" }}>
      <div id="recaptcha-container" />

      <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 20,
        padding: "32px 28px", position: "relative" }}>

        {step === "main" && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 10px", color: "#1a1a1a",
              textAlign: "center", fontFamily: "inherit" }}>
              {tc({ en: "Log in or sign up", hi: "लॉग इन या साइन अप करें", bn: "লগ ইন বা সাইন আপ করুন" })}
            </h1>
            <p style={{ fontSize: 14, color: "#6b6b6b", margin: "0 0 28px", textAlign: "center", lineHeight: 1.5 }}>
              {tc({ en: "Smart farming tools, market prices, AI advice, and more.", hi: "स्मार्ट खेती उपकरण, बाज़ार भाव, AI सलाह, और भी बहुत कुछ।", bn: "স্মার্ট কৃষি সরঞ্জাম, বাজার দর, AI পরামর্শ, এবং আরও অনেক কিছু।" })}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => handleSocial("google", signInWithGoogle)} disabled={disabled}
                style={{ ...btnStyle, opacity: disabled && socialLoading !== "google" ? 0.5 : 1 }}>
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                {socialLoading === "google" ? tc({ en: "Signing in…", hi: "साइन इन हो रहा है…", bn: "সাইন ইন হচ্ছে…" }) : tc({ en: "Continue with Google", hi: "Google से जारी रखें", bn: "Google দিয়ে চালিয়ে যান" })}
              </button>

              <button onClick={() => handleSocial("apple", signInWithApple)} disabled={disabled}
                style={{ ...btnStyle, opacity: disabled && socialLoading !== "apple" ? 0.5 : 1 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1a1a1a"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.51-3.23 0-1.44.64-2.2.45-3.06-.4C3.79 16.17 4.36 9.53 8.7 9.28c1.23.06 2.08.72 2.8.75.99-.2 1.94-.78 3-.66 1.28.15 2.24.69 2.87 1.7-2.63 1.58-2.01 5.05.36 6.02-.5 1.32-.93 2.61-1.68 3.19zM12.03 9.22c-.13-2.62 2.08-4.88 4.47-5.08.32 2.95-2.67 5.16-4.47 5.08z"/></svg>
                {socialLoading === "apple" ? tc({ en: "Signing in…", hi: "साइन इन हो रहा है…", bn: "সাইন ইন হচ্ছে…" }) : tc({ en: "Continue with Apple", hi: "Apple से जारी रखें", bn: "Apple দিয়ে চালিয়ে যান" })}
              </button>

              <button onClick={() => setStep("phone")} disabled={disabled} style={btnStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                {tc({ en: "Continue with phone", hi: "फ़ोन से जारी रखें", bn: "ফোন দিয়ে চালিয়ে যান" })}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "6px 0" }}>
                <div style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
                <span style={{ fontSize: 12, color: "#999", fontWeight: 400 }}>{tc({ en: "OR", hi: "या", bn: "অথবা" })}</span>
                <div style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
              </div>

              <input value={email} onChange={(e) => { setEmail(e.target.value.trim()); setError(""); }}
                placeholder={tc({ en: "Email address", hi: "ईमेल पता", bn: "ইমেইল ঠিকানা" })} type="email"
                style={{ width: "100%", padding: "13px 16px", borderRadius: 12, fontSize: 15,
                  border: "1px solid #e5e5e5", background: "#f5f5f5", color: "#1a1a1a",
                  fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                onFocus={(e) => e.target.style.borderColor = "#10a37f"}
                onBlur={(e) => e.target.style.borderColor = "#e5e5e5"} />

              <button onClick={handleEmailSubmit} disabled={!email.includes("@")}
                style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "none",
                  background: "#1a1a1a", color: "#fff", fontSize: 15, fontWeight: 600,
                  fontFamily: "inherit", cursor: "pointer",
                  opacity: email.includes("@") ? 1 : 0.35 }}>
                {t("continue")}
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => handleSocial("facebook", signInWithFacebook)} disabled={disabled}
                  style={{ ...btnStyle, flex: 1, justifyContent: "center", padding: "12px 0" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  {tc({ en: "Facebook", hi: "Facebook", bn: "Facebook" })}
                </button>
                <button onClick={() => handleSocial("twitter", signInWithTwitter)} disabled={disabled}
                  style={{ ...btnStyle, flex: 1, justifyContent: "center", padding: "12px 0" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1a1a1a"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  {tc({ en: "X", hi: "X", bn: "X" })}
                </button>
              </div>
            </div>
          </>
        )}

        {step === "email" && (
          <>
            <button onClick={() => { setStep("main"); setError(""); setMode("login"); }}
              style={{ position: "absolute", top: 16, left: 16, background: "none", border: "none",
                cursor: "pointer", fontSize: 20, color: "#999", padding: 4 }}>←</button>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px", color: "#1a1a1a",
              textAlign: "center", fontFamily: "inherit" }}>
              {mode === "signup"
                ? tc({ en: "Create account", hi: "खाता बनाएँ", bn: "অ্যাকাউন্ট তৈরি করুন" })
                : tc({ en: "Email login", hi: "ईमेल लॉगिन", bn: "ইমেইল লগইন" })}
            </h1>

            {/* Login / Sign Up toggle */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 22 }}>
              {["login", "signup"].map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(""); setNotice(""); }}
                  style={{ padding: "6px 18px", borderRadius: 99, border: `1.5px solid ${mode === m ? "#1a1a1a" : "#e5e5e5"}`,
                    background: mode === m ? "#1a1a1a" : "#fff", color: mode === m ? "#fff" : "#6b6b6b",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {m === "login"
                    ? tc({ en: "Log In", hi: "लॉग इन", bn: "লগ ইন" })
                    : tc({ en: "Sign Up", hi: "साइन अप", bn: "সাইন আপ" })}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input value={email} onChange={(e) => { setEmail(e.target.value.trim()); setError(""); }}
                placeholder={tc({ en: "Email address", hi: "ईमेल पता", bn: "ইমেইল ঠিকানা" })} type="email" autoFocus
                style={{ width: "100%", padding: "13px 16px", borderRadius: 12, fontSize: 15,
                  border: "1px solid #e5e5e5", background: "#f5f5f5", color: "#1a1a1a",
                  fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                onFocus={(e) => e.target.style.borderColor = "#10a37f"}
                onBlur={(e) => e.target.style.borderColor = "#e5e5e5"} />

              <div style={{ position: "relative", width: "100%" }}>
                <input value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder={mode === "signup"
                    ? tc({ en: "Create password (min 6 characters)", hi: "पासवर्ड बनाएँ (कम से कम 6 अक्षर)", bn: "পাসওয়ার্ড তৈরি করুন (কমপক্ষে ৬ অক্ষর)" })
                    : tc({ en: "Password", hi: "पासवर्ड", bn: "পাসওয়ার্ড" })} type={showPassword ? "text" : "password"}
                  style={{ width: "100%", padding: "13px 44px 13px 16px", borderRadius: 12, fontSize: 15,
                    border: "1px solid #e5e5e5", background: "#f5f5f5", color: "#1a1a1a",
                    fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                  onFocus={(e) => e.target.style.borderColor = "#10a37f"}
                  onBlur={(e) => e.target.style.borderColor = "#e5e5e5"} />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword
                    ? tc({ en: "Hide password", hi: "पासवर्ड छिपाएँ", bn: "পাসওয়ার্ড লুকান" })
                    : tc({ en: "Show password", hi: "पासवर्ड दिखाएँ", bn: "পাসওয়ার্ড দেখান" })}
                  style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                    width: 34, height: 34, display: "grid", placeItems: "center", padding: 0,
                    background: "transparent", border: "none", cursor: "pointer", color: "#8a8a8a" }}>
                  <Icon name={showPassword ? "EyeOff" : "Eye"} size={19} />
                </button>
              </div>

              <button onClick={handleEmailSubmit}
                disabled={!email.includes("@") || password.length < 6 || loading}
                style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "none",
                  background: "#1a1a1a", color: "#fff", fontSize: 15, fontWeight: 600,
                  fontFamily: "inherit", cursor: "pointer",
                  opacity: email.includes("@") && password.length >= 6 && !loading ? 1 : 0.35 }}>
                {loading
                  ? tc({ en: "Please wait…", hi: "कृपया प्रतीक्षा करें…", bn: "অনুগ্রহ করে অপেক্ষা করুন…" })
                  : mode === "signup"
                    ? tc({ en: "Create Account", hi: "खाता बनाएँ", bn: "অ্যাকাউন্ট তৈরি করুন" })
                    : tc({ en: "Log In", hi: "लॉग इन करें", bn: "লগ ইন করুন" })}
              </button>

              {mode === "login" && (
                <button type="button" onClick={handleReset} disabled={loading}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4,
                    color: "#10a37f", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit",
                    alignSelf: "center" }}>
                  {tc({ en: "Forgot password?", hi: "पासवर्ड भूल गए?", bn: "পাসওয়ার্ড ভুলে গেছেন?" })}
                </button>
              )}

              {notice && (
                <div style={{ padding: "10px 12px", borderRadius: 10, background: "#e7f6ef",
                  color: "#0d7a4f", fontSize: 13, fontFamily: "inherit", textAlign: "center" }}>
                  {notice}
                </div>
              )}
            </div>
          </>
        )}

        {step === "phone" && (
          <>
            <button onClick={() => { setStep("main"); setError(""); }}
              style={{ position: "absolute", top: 16, left: 16, background: "none", border: "none",
                cursor: "pointer", fontSize: 20, color: "#999", padding: 4 }}>←</button>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 28px", color: "#1a1a1a",
              textAlign: "center", fontFamily: "inherit" }}>{tc({ en: "Phone login", hi: "फ़ोन लॉगिन", bn: "ফোন লগইন" })}</h1>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ padding: "13px 14px", borderRadius: 12, border: "1px solid #e5e5e5",
                  background: "#f5f5f5", color: "#6b6b6b", fontSize: 15, fontFamily: "inherit", flexShrink: 0 }}>
                  +91
                </div>
                <input placeholder={tc({ en: "Mobile number", hi: "मोबाइल नंबर", bn: "মোবাইল নম্বর" })} autoFocus
                  style={{ flex: 1, padding: "13px 16px", borderRadius: 12, fontSize: 15,
                    border: "1px solid #e5e5e5", background: "#f5f5f5", color: "#1a1a1a",
                    fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                  onFocus={(e) => e.target.style.borderColor = "#10a37f"}
                  onBlur={(e) => e.target.style.borderColor = "#e5e5e5"} />
              </div>

              <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fff8ed",
                fontSize: 13, color: "#b25e00", textAlign: "center" }}>
                {tc({ en: "Phone login requires Firebase Blaze plan — use Google or Email instead", hi: "फ़ोन लॉगिन के लिए Firebase Blaze प्लान चाहिए — Google या ईमेल से लॉगिन करें", bn: "ফোন লগইনের জন্য Firebase Blaze প্ল্যান দরকার — Google বা ইমেইল ব্যবহার করুন" })}
              </div>
            </div>
          </>
        )}

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14,
            padding: "12px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
            <Icon name="AlertCircle" size={16} style={{ color: "#dc2626", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#dc2626" }}>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
