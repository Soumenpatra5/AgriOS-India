/* Phone number normalisation — one canonical form, one boundary conversion.

   AgriOS stores Indian mobile numbers as TEN DIGITS with no country code.
   That is not an arbitrary choice to revisit: users.phone is written that way
   by ensureUser, AppStore mirrors it that way into localStorage, and Farm
   Space invitations match an invitee against users.phone as a string. Change
   the stored form and every pending invitation silently stops binding.

   E.164 (+91XXXXXXXXXX) is what messaging providers want, so it is produced
   at the provider boundary and nowhere else. Keeping the conversion in one
   direction, in one file, is what stops the two formats drifting apart. */

/* Indian mobile numbers are ten digits starting 6-9. Anything else is either
   a landline, a typo, or someone probing — all of which should be refused
   before a message is paid for. */
const MOBILE = /^[6-9]\d{9}$/;

/* Accepts what a person might actually type — "+91 98765 43210",
   "098765-43210", "919876543210" — and returns the canonical ten digits, or
   null if it is not a valid Indian mobile.

   Deliberately takes the LAST ten digits after stripping non-digits, so a
   country code or a leading zero falls away without a special case for each. */
export function toCanonical(raw) {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return MOBILE.test(ten) ? ten : null;
}

/* The provider boundary, and the only place +91 is added. */
export function toE164(canonical) {
  const ten = toCanonical(canonical);
  return ten ? `+91${ten}` : null;
}

/* For display and for messages: "98765 43210" reads as a phone number,
   9876543210 reads as a serial number. */
export function forDisplay(canonical) {
  const ten = toCanonical(canonical);
  return ten ? `${ten.slice(0, 5)} ${ten.slice(5)}` : "";
}

/* Logging. The whole number in a log line is a privacy leak that outlives the
   incident it was written for; the last four is enough to correlate a support
   call with a request. */
export function forLog(canonical) {
  const ten = toCanonical(canonical);
  return ten ? `••••••${ten.slice(-4)}` : "••••";
}
