/* Attachment validation shared between Farm Chat's group channel (chat.js)
   and 1:1 direct messages (dm.js) — both send the same shaped attachments
   through the same client-upload endpoint (api/blob-upload.js), so there is
   exactly one place that decides what an attachment is allowed to look
   like, rather than two copies that can quietly drift apart. */

export const MAX_ATTACHMENTS = 4;

/* Every kind api/blob-upload.js will issue a token for, plus "location" —
   the one attachment kind that never touches Blob at all (it is just
   coordinates), so it is validated here instead of there. */
const ATTACHMENT_KINDS = ["image", "video", "audio", "document", "location"];

/* A real attachment's url must be a Vercel Blob URL — not because the
   client is trusted to say so, but because this is the shape the upload
   endpoint's own response takes, and accepting anything else would let a
   message body point at an arbitrary third-party URL under the "attachment"
   label. The store id varies by project/environment, so only the fixed
   `.public.blob.vercel-storage.com` suffix is pinned. */
const BLOB_URL_RE = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/.+/i;

/* Every other kind is a real file that already landed on Blob before this
   call was made (the client uploads first, sends second) — this just checks
   the shape of what came back, it never issues a token. */
export function validateAttachments(rawList) {
  const list = Array.isArray(rawList) ? rawList.slice(0, MAX_ATTACHMENTS) : [];
  const attachments = [];
  for (const a of list) {
    const kind = String(a?.kind ?? "").trim();
    if (!ATTACHMENT_KINDS.includes(kind)) return { error: "unsupported attachment kind" };

    if (kind === "location") {
      const lat = Number(a?.lat);
      const lng = Number(a?.lng);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        return { error: "invalid location" };
      }
      attachments.push({ kind, lat, lng, label: String(a?.label ?? "").slice(0, 200) || null });
      continue;
    }

    const url = String(a?.url ?? "");
    if (!BLOB_URL_RE.test(url)) return { error: "invalid attachment url" };
    const attachment = {
      kind, url,
      name: String(a?.name ?? "").slice(0, 200),
      size: Number(a?.size) || 0,
      type: String(a?.type ?? "").slice(0, 100),
    };
    if (kind === "audio" && a?.duration != null) attachment.duration = Math.max(0, Number(a.duration) || 0);
    attachments.push(attachment);
  }
  return { attachments };
}
