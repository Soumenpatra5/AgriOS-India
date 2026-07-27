import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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

let confirmationResult = null;

/* ── Phone OTP ───────────────────────────────────────────────────────────── */

export function setupRecaptcha() {}

export async function sendOtp(phone) {
  const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
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
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signUpWithEmail(email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function checkEmailExists(email) {
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    return methods.length > 0;
  } catch {
    return false;
  }
}

/* ── Social providers ────────────────────────────────────────────────────── */

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return result.user;
}

export async function signInWithFacebook() {
  const result = await signInWithPopup(auth, new FacebookAuthProvider());
  return result.user;
}

export async function signInWithApple() {
  const result = await signInWithPopup(auth, new OAuthProvider("apple.com"));
  return result.user;
}

export async function signInWithTwitter() {
  const result = await signInWithPopup(auth, new TwitterAuthProvider());
  return result.user;
}

/* ── Common ──────────────────────────────────────────────────────────────── */

export function onAuthChange(cb) {
  if (!fbEnabled) return () => {};
  return onAuthStateChanged(auth, cb);
}

export async function getIdToken() {
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
}

export function logout() {
  if (!fbEnabled) return Promise.resolve();
  return signOut(auth);
}
