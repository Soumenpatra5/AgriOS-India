import { useState, lazy, Suspense } from "react";
import { Spinner } from "../components/index.js";

/* Lazy so the Firebase Auth SDK (~140kB) loads only when the login screen is
   actually reached — returning, already-signed-in users never pay for it. */
const Login = lazy(() => import("./Login.jsx"));
const OtpVerify = lazy(() => import("./OtpVerify.jsx"));

/* The two-step phone sign-in. Login collects the number and asks the server to
   send a code; the challenge it gets back is what OtpVerify needs to check the
   answer. Held here rather than in either screen so going back and starting
   again cannot leave a stale challenge behind. */
export default function AuthFlow() {
  const [challenge, setChallenge] = useState(null);

  return (
    <Suspense fallback={<div style={{ display: "grid", placeItems: "center", height: "100vh" }}><Spinner /></div>}>
      {challenge
        ? <OtpVerify {...challenge} onBack={() => setChallenge(null)} />
        : <Login onNext={setChallenge} />}
    </Suspense>
  );
}
