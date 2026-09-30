/* Client for /api/otp — phone sign-in by WhatsApp.

   Deliberately does NOT use authFetch: this is how a farmer gets a session, so
   there is no token to attach yet. It is the one API client in the app that
   talks to the server unauthenticated.

   The server decides everything that matters — whether the code was right, how
   many guesses are left, whether the number may ask again. This file only
   carries the answer back and gives each failure a name the screen can act on. */

export const OTP_ERROR = {
  UNCONFIGURED: "unconfigured",   // server has no provider or key (503)
  INVALID: "invalid",             // wrong, expired or already-used code (401)
  RATE_LIMITED: "rate-limited",   // cooldown, hourly cap, or out of attempts (429)
  BAD_INPUT: "bad-input",         // malformed number or code (400)
  PROVIDER: "provider",           // WhatsApp itself failed (502) — offer another way
  OFFLINE: "offline",             // request never left the device
  FAILED: "failed",
};

function reasonFor(status) {
  if (status === 503) return OTP_ERROR.UNCONFIGURED;
  if (status === 502) return OTP_ERROR.PROVIDER;
  if (status === 429) return OTP_ERROR.RATE_LIMITED;
  if (status === 401) return OTP_ERROR.INVALID;
  if (status === 400) return OTP_ERROR.BAD_INPUT;
  return OTP_ERROR.FAILED;
}

async function call(action, payload = {}) {
  let res;
  try {
    res = await fetch("/api/otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
  } catch {
    const err = new Error("You appear to be offline.");
    err.reason = OTP_ERROR.OFFLINE;
    throw err;
  }

  let body = null;
  let parsed = true;
  try { body = await res.json(); } catch { parsed = false; }

  if (!res.ok) {
    /* The server's messages are written for a farmer — "Incorrect code. 3
       attempts left." — so they are surfaced as-is rather than replaced. */
    const err = new Error(body?.error?.message || "Something went wrong.");
    err.status = res.status;
    err.reason = reasonFor(res.status);
    throw err;
  }

  /* A 200 that is not JSON did not come from this API — in dev the endpoint
     does not exist and the SPA fallback answers with index.html. Treating that
     as success would strand someone on a code that was never sent. */
  if (!parsed) {
    const err = new Error("Phone sign-in isn't available in this build.");
    err.reason = OTP_ERROR.UNCONFIGURED;
    throw err;
  }
  return body?.data;
}

export const otpApi = {
  /* Which delivery methods this deployment can actually offer. Static
     configuration — no number is sent, so nothing can be enumerated. */
  channels: async () => {
    if (import.meta.env.VITE_USE_AUTH_EMULATOR === "true") return { whatsapp: true, sms: true };
    return call("otp.channels");
  },

  request: async (phone, channel) => {
    if (import.meta.env.VITE_USE_AUTH_EMULATOR === "true") return { challengeId: "e2e-challenge", resendInSeconds: 0 };
    return call("otp.request", { phone, channel });
  },

  resend: async (phone, channel) => {
    if (import.meta.env.VITE_USE_AUTH_EMULATOR === "true") return { challengeId: "e2e-challenge", resendInSeconds: 0 };
    return call("otp.resend", { phone, channel });
  },

  /* Returns { customToken, isNewAccount }. The token is exchanged for a real
     Firebase session by the caller; it is never stored. */
  verify: async (challengeId, code) => {
    if (import.meta.env.VITE_USE_AUTH_EMULATOR === "true") {
      const b64 = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const customToken = `${b64({alg:"none",typ:"JWT"})}.${b64({
        iss: "https://securetoken.google.com/demo-agrios",
        aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
        iat: Math.floor(Date.now()/1000),
        exp: Math.floor(Date.now()/1000) + 3600,
        uid: "e2e-test-uid"
      })}.`;
      return { customToken, isNewAccount: false };
    }
    return call("otp.verify", { challengeId, code });
  },
};