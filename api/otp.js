/* POST /api/otp — phone sign-in by WhatsApp, with SMS as the fallback.

   Action-routed like api/farm.js: one function, one place where rate limiting
   and validation are applied, so an action added later cannot skip them.

   This endpoint is UNAUTHENTICATED by definition — it is how you get a session
   — which makes it the most exposed surface in the app. Everything below is
   shaped by that:

   - The code is generated, stored and compared server-side. The browser is
     told an id and an expiry, never the code, and never whether the number is
     one it has seen before.
   - Rate limits are applied per phone AND per IP, before any provider call, so
     the cost of abuse is a database row rather than a message you paid for.
   - Responses do not distinguish "no account" from "account exists". Whether
     the number is registered is not something a stranger gets to learn by
     asking. */

import { getSql } from "./_lib/db.js";
import { HttpError } from "./_lib/http.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { toCanonical, toE164, forLog } from "./_lib/otp/phone.js";
import {
  createChallenge, verifyChallenge, issuanceState, markSent, markFailed, otpConfig,
} from "./_lib/otp/challenge.js";
import { sendWhatsAppOtp, whatsappConfigured } from "./_lib/otp/whatsapp.js";
import { mintCustomToken, resolveUidForPhone, customTokenConfigured } from "./_lib/otp/firebaseToken.js";

/* Vercel puts the caller's address here; the first entry is the client. Only
   ever hashed before it touches the database. */
function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : String(fwd || "")).split(",")[0].trim() || null;
}

/* Two windows, because they stop different things: the phone limit stops one
   number being spammed with messages, the IP limit stops one machine walking
   through many numbers. */
async function guard(req, phone) {
  const ip = clientIp(req);
  const perPhone = await rateLimit({ key: `otp:p:${phone}`, max: 5, windowMs: 3_600_000 });
  if (perPhone) throw new HttpError(429, "Too many code requests for this number. Please try again later.");

  if (ip) {
    const perIp = await rateLimit({ key: `otp:i:${ip}`, max: 20, windowMs: 3_600_000 });
    if (perIp) throw new HttpError(429, "Too many requests. Please try again later.");
  }
  return ip;
}

/* Issue and deliver. Shared by request and resend so a resend cannot bypass a
   rule the first request enforced. */
async function issue(sql, req, { phone, channel }) {
  const canonical = toCanonical(phone);
  if (!canonical) throw new HttpError(400, "Enter a valid 10-digit Indian mobile number.");

  const ip = await guard(req, canonical);

  const state = await issuanceState(sql, canonical);
  if (state.cooldownRemainingMs > 0) {
    throw new HttpError(429, `Please wait ${Math.ceil(state.cooldownRemainingMs / 1000)} seconds before asking again.`);
  }
  if (state.overHourlyCap) {
    throw new HttpError(429, "Too many code requests for this number. Please try again later.");
  }

  const challenge = await createChallenge(sql, { phone: canonical, channel, ip });

  if (channel === "whatsapp") {
    const sent = await sendWhatsAppOtp({ toE164: toE164(canonical), code: challenge.code });
    if (!sent.ok) {
      await markFailed(sql, challenge.id);
      console.log(`otp_send_failure channel=whatsapp reason=${sent.reason} phone=${forLog(canonical)}`);
      /* A specific, honest failure so the client can offer SMS rather than
         showing a farmer an internal error they cannot act on. */
      throw new HttpError(502, "We couldn't send your code on WhatsApp.");
    }
    await markSent(sql, challenge.id, sent.messageId);
    console.log(`otp_send_success channel=whatsapp phone=${forLog(canonical)}`);
  } else {
    /* SMS is not wired to a provider. Saying so plainly beats pretending to
       send and leaving someone waiting for a message that is not coming. */
    await markFailed(sql, challenge.id);
    throw new HttpError(503, "SMS codes aren't available yet. Please use WhatsApp.");
  }

  const cfg = otpConfig();
  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    resendInSeconds: Math.ceil(cfg.resendCooldownMs / 1000),
    channel,
  };
}

const ACTIONS = {
  /* What the client may ask for before it has any session at all. */
  "otp.request": ({ sql, req, payload }) => issue(sql, req, payload),
  "otp.resend":  ({ sql, req, payload }) => issue(sql, req, payload),

  async "otp.verify"({ sql, payload }) {
    const { phone } = await verifyChallenge(sql, payload);

    if (!customTokenConfigured()) {
      throw new HttpError(503, "Phone sign-in is not configured on this server.");
    }

    /* Resolve to the EXISTING account where there is one — a farmer who signed
       up with Google and now signs in by WhatsApp must land in the same
       AgriOS account, not a second one. */
    const { uid, isNew } = await resolveUidForPhone(sql, phone);
    const customToken = await mintCustomToken(uid, { phone_number: toE164(phone) });

    console.log(`firebase_session_success new=${isNew} phone=${forLog(phone)}`);
    /* isNew tells the client whether to collect a name, nothing more. It is
       returned only AFTER a correct code, so it leaks nothing to a stranger. */
    return { customToken, isNewAccount: isNew };
  },

  /* Lets the login screen offer the right choices instead of guessing. Static
     configuration only — no phone, no lookup, nothing to enumerate. */
  "otp.channels": () => ({
    whatsapp: whatsappConfigured(),
    sms: false,
    ttlSeconds: Math.round(otpConfig().ttlMs / 1000),
  }),
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: { message: "POST only" } });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { action, payload = {} } = body;

    const route = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
    if (!route) return res.status(400).json({ error: { message: "Unknown action" } });

    const sql = getSql();
    const data = await route({ sql, req, payload });
    return res.status(200).json({ data });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { message: err.message } });
    }
    /* Nothing internal reaches the caller: not the provider's reply, not the
       database's error, not a stack. */
    console.error("otp error:", err?.message);
    if (/DATABASE_URL is not set/.test(err?.message || "")) {
      return res.status(503).json({ error: { message: "Phone sign-in is not configured on this server." } });
    }
    return res.status(500).json({ error: { message: "Something went wrong. Please try again." } });
  }
}
