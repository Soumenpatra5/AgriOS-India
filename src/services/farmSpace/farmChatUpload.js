/* Client-side half of Farm Chat attachment uploads. The file goes straight
   from the browser to Vercel Blob — this app's server (api/blob-upload.js)
   only ever decides WHETHER that upload may happen, never touches the bytes
   (see the WHY DIRECT-TO-BLOB comment there).

   Kept out of farmSpaceApi.js on purpose: this does not speak that module's
   {action, spaceId, payload} envelope, it speaks the shape @vercel/blob's
   own upload() dictates. authFetch is not used either, for the same reason
   authFetch itself is not: upload() wants a plain headers object, not a
   fetch() call this module makes itself. */

import { upload } from "@vercel/blob/client";

/* Mirrors api/blob-upload.js's KIND_RULES so the client can refuse an
   oversized file before spending any upload bandwidth on it — the server
   re-checks the same limit regardless, this is only for a faster no. */
export const ATTACHMENT_KIND_RULES = {
  image:    { accept: "image/jpeg,image/png,image/webp,image/heic,image/heif", maxBytes: 10 * 1024 * 1024 },
  video:    { accept: "video/mp4,video/quicktime,video/webm", maxBytes: 50 * 1024 * 1024 },
  audio:    { accept: "audio/webm,audio/mp4,audio/ogg,audio/wav,audio/mpeg,audio/aac", maxBytes: 15 * 1024 * 1024 },
  document: { accept: ".pdf,.doc,.docx,.xls,.xlsx", maxBytes: 15 * 1024 * 1024 },
};

export function attachmentKindForFile(file) {
  const type = file?.type || "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "document";
}

/* A Blob pathname is a URL segment, not a filesystem path — stripped down to
   safe characters rather than percent-encoded, so the object stays readable
   in Vercel's own dashboard. The server adds its own random suffix on top
   (addRandomSuffix, forced in api/blob-upload.js regardless of this), so
   collisions here are a non-issue, not something this needs to solve. */
function sanitizeFilename(name) {
  const base = String(name || "file").trim().replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120);
  return base || "file";
}

/* Throws with a `.reason` a caller can branch on, the same convention
   farmSpaceApi.js's FARM_ERROR uses — "signed-out", "too-large", or the
   server's own rejection reaching through as a plain message. */
export async function uploadChatAttachment(spaceId, file, kind, { onProgress } = {}) {
  const rules = ATTACHMENT_KIND_RULES[kind];
  if (!rules) throw new Error(`Unsupported attachment kind: ${kind}`);
  if (file.size > rules.maxBytes) {
    const err = new Error("This file is too large to send.");
    err.reason = "too-large";
    throw err;
  }

  const { getIdToken } = await import("../firebase/auth.js");
  const token = await getIdToken();
  if (!token) {
    const err = new Error("You appear to be signed out.");
    err.reason = "signed-out";
    throw err;
  }

  const pathname = `farm-chat/${spaceId}/${Date.now()}-${sanitizeFilename(file.name)}`;

  let blob;
  try {
    blob = await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/blob-upload",
      clientPayload: JSON.stringify({ spaceId, kind }),
      headers: { Authorization: `Bearer ${token}` },
      onUploadProgress: onProgress ? ({ percentage }) => onProgress(percentage) : undefined,
    });
  } catch (err) {
    /* upload() throws a generic Error whose message is whatever
       blob-upload.js's onBeforeGenerateToken rejected with (or a network
       failure) — passed through as-is rather than replaced, since it is
       already farmer-relevant ("Upload could not be authorized" etc). */
    const wrapped = new Error(err?.message || "Upload failed.");
    wrapped.reason = "offline";
    throw wrapped;
  }

  return {
    kind,
    url: blob.url,
    name: String(file.name || "").slice(0, 200),
    size: file.size,
    type: file.type || "",
  };
}
