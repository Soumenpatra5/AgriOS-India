import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  TwitterAuthProvider,
  onAuthStateChanged,
  signOut,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { auth, fbEnabled } from "./config.js";

if (fbEnabled) setPersistence(auth, browserLocalPersistence).catch(() => {});

/* Firebase is optional — the app runs offline-first without it, so config.js
   leaves `auth` null when VITE_FB_API_KEY is absent. Every call below needs
   it, and passing a null auth into the SDK produced

     TypeError: Cannot read properties of null (reading 'app')

   which reached the farmer as an unactionable string and told nobody that the
   build simply has no Firebase config. Fail with a real code instead. */
function requireAuth() {
  if (!fbEnabled || !auth) {
    const err = new Error("Firebase is not configured for this build");
    err.code = "auth/not-configured";
    throw err;
  }
  return auth;
}

let confirmationResult = null;

/* ── Phone OTP ───────────────────────────────────────────────────────────── */

export function setupRecaptcha() {}

export async function sendOtp(phone) {
  const verifier = new RecaptchaVerifier(requireAuth(), "recaptcha-container", {
    size: "invisible",
  });
  try {
    confirmationResult = await signInWithPhoneNumber(
      auth,
      "+91" + phone,
      verifier,
    );
    return { sent: true };
  } catch (err) {
    verifier.clear();
    throw err;
  }
}

export async function verifyOtp(code) {
  if (!confirmationResult) throw new Error("Call sendOtp first");
  const result = await confirmationResult.confirm(code);
  return result.user;
}

/* ── Email / Password ────────────────────────────────────────────────────── */

export async function signInWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(requireAuth(), email, password);
  return result.user;
}

export async function signUpWithEmail(email, password) {
  const result = await createUserWithEmailAndPassword(requireAuth(), email, password);
  return result.user;
}

export async function checkEmailExists(email) {
  try {
    const methods = await fetchSignInMethodsForEmail(requireAuth(), email);
    return methods.length > 0;
  } catch {
    return false;
  }
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(requireAuth(), email);
}

/* ── Custom token (WhatsApp OTP) ──────────────────────────────────────────── */

/* Exchange a server-minted custom token for a real Firebase session.

   The WhatsApp code is verified by our own backend, which then mints a Firebase
   custom token for the account that phone belongs to. Signing in with it here
   is what makes the rest of the app work unchanged: onAuthStateChanged fires,
   getIdToken() starts returning, and every protected endpoint — including the
   Farm Space gate — sees an ordinary Firebase user.

   The token is used once and never stored; the session that replaces it is
   what persists. */
export async function signInWithToken(customToken) {
  const result = await signInWithCustomToken(requireAuth(), customToken);
  return result.user;
}

/* ── Social providers ────────────────────────────────────────────────────── */

export async function signInWithGoogle() {
  const result = await signInWithPopup(requireAuth(), new GoogleAuthProvider());
  return result.user;
}

export async function signInWithFacebook() {
  const result = await signInWithPopup(requireAuth(), new FacebookAuthProvider());
  return result.user;
}

export async function signInWithApple() {
  const result = await signInWithPopup(requireAuth(), new OAuthProvider("apple.com"));
  return result.user;
}

export async function signInWithTwitter() {
  const result = await signInWithPopup(requireAuth(), new TwitterAuthProvider());
  return result.user;
}

/* ── Common ──────────────────────────────────────────────────────────────── */

export function onAuthChange(cb) {
  if (!fbEnabled) return () => {};
  return onAuthStateChanged(auth, cb);
}

export async function getIdToken() {
  /* Called on the API path, not only from the login screen — returning null
     when Firebase is absent lets callers fall back to an unauthenticated
     request instead of crashing on a null auth. */
  if (!fbEnabled || !auth) return null;
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
}

export function logout() {
  if (!fbEnabled) return Promise.resolve();
  return signOut(auth);
}
