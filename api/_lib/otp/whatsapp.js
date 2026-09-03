/* WhatsApp delivery via Meta's Cloud API.

   The official Business Platform, not an automation library — sending through
   an unofficial client gets the number banned and, for an authentication
   message, would be handing someone's login code to an unsanctioned pipe.

   Everything here is server-side. WHATSAPP_ACCESS_TOKEN must never reach the
   browser: a VITE_ prefix would compile it into the bundle and hand every
   visitor the ability to send messages as your business.

   Meta requires authentication codes to go through a pre-approved template of
   category AUTHENTICATION. The template's body text is fixed at approval time
   and cannot be composed here — the code is passed as a parameter. That is why
   the template NAME is configuration rather than a string in this file. */

const GRAPH = "https://graph.facebook.com";

export function whatsappConfigured() {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
            && process.env.WHATSAPP_AUTH_TEMPLATE_NAME);
}

/* Meta's language codes are their own list ("en", "en_US", "hi", "bn"), not
   BCP-47, so it is configurable rather than derived from the app's locale. */
const templateLanguage = () => process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";
const apiVersion = () => process.env.WHATSAPP_API_VERSION || "v21.0";

/* Send one authentication code.

   Returns { ok, messageId } or { ok:false, reason } — never throws for a
   provider failure, because "WhatsApp did not work" is a normal outcome the
   caller answers by offering SMS, not an exception. */
export async function sendWhatsAppOtp({ toE164, code }) {
  if (!whatsappConfigured()) return { ok: false, reason: "not-configured" };

  const url = `${GRAPH}/${apiVersion()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  /* An AUTHENTICATION template takes the code twice: once in the body, and
     once as the copy-code button's payload. Meta rejects the send if the
     button component is missing for that template type. */
  const payload = {
    messaging_product: "whatsapp",
    to: toE164,
    type: "template",
    template: {
      name: process.env.WHATSAPP_AUTH_TEMPLATE_NAME,
      language: { code: templateLanguage() },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: code }],
        },
      ],
    },
  };

  /* A farmer staring at a spinner is worse than a farmer offered SMS, so the
     call is bounded well below any sensible page timeout. */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      /* Meta's message is logged for the operator and deliberately not
         returned: it can name the template, the business account and the
         token's scopes. */
      console.error("otp_provider_error", res.status, data?.error?.message || "unknown");
      return { ok: false, reason: res.status === 429 ? "rate-limited" : "provider-error" };
    }

    return { ok: true, messageId: data?.messages?.[0]?.id ?? null };
  } catch (err) {
    console.error("otp_provider_error", err?.name === "AbortError" ? "timeout" : err?.message);
    return { ok: false, reason: err?.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
