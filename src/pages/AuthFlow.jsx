import { useState, lazy, Suspense } from "react";
import { Spinner } from "../components/index.js";

/* Lazy so the Firebase Auth SDK (~140kB) loads only when the login screen is
   actually reached — returning, already-signed-in users never pay for it. */
const Login = lazy(() => import("./Login.jsx"));
const OtpVerify = lazy(() => import("./OtpVerify.jsx"));

export default function AuthFlow() {
  const [phone, setPhone] = useState(null);

  return (
    <Suspense fallback={<div style={{ display: "grid", placeItems: "center", height: "100vh" }}><Spinner /></div>}>
      {phone
        ? <OtpVerify phone={phone} onBack={() => setPhone(null)} />
        : <Login onNext={(ph) => setPhone(ph)} />}
    </Suspense>
  );
}
