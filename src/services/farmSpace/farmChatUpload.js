/* Client-side half of Farm Chat attachment uploads. The file goes straight
   from the browser to Vercel Blob — this app's server (api/blob-upload.js)
   only ever decides WHETHER that upload may happen, never touches the bytes
   (see the WHY DIRECT-TO-BLOB comment there).

   Kept out of farmSpaceApi.js on purpose: this does not speak that module's
   {action, spaceId, payload} envelope, it speaks the shape @vercel/blob's
   own upload() dictates. authFetch is not used either, for the same reason
   authFetch itself is not: upload() wants a plain headers object, not a
   fetch() call this module makes itself. */

/* Imported on demand, not statically: @vercel/blob/client is a Node-
   flavored SDK that bundles to ~113KB with stream shims, and a static
   import made it part of the chat screen's own chunk — every farmer who
   opened chat downloaded it whether or not they ever attached a file. Now
   only the first actual upload pays for it (in parallel with the token
   fetch it needs anyway). */
const loadBlobClient = () => import("@vercel/blob/client");

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

/* Downscales and re-encodes a photo before it ever reaches upload() — this
   app is built for rural connections, and a farmer's camera photo (often
   4000px+, several MB) has no reason to travel over a slow link at full
   resolution to be shown as a chat thumbnail. Best-effort in the strictest
   sense: any failure here (an old browser missing an API, a corrupt file)
   falls back to sending the original file untouched, because a compression
   bug must never be the reason a photo fails to send. */
const COMPRESS_MAX_DIMENSION = 1600;
const COMPRESS_QUALITY = 0.82;
const COMPRESS_SKIP_UNDER_BYTES = 300 * 1024;
/* HEIC/HEIF (the default on iPhone) cannot be reliably decoded through the
   Canvas 2D API outside Safari — attempting to would risk a blank or
   corrupted image being sent instead of the real photo, which is worse than
   sending the original at full size. Passed through unmodified. */
const COMPRESS_SKIP_TYPES = new Set(["image/heic", "image/heif"]);

/* createImageBitmap/OffscreenCanvas/canvas.toBlob are exactly the kind of
   API that can silently NEVER settle on a broken or partial implementation
   (a specific Android WebView build shipping the constructor but not a
   working convertToBlob, say) — no error, no rejection, just a promise that
   never resolves. Without this race, that hang would propagate straight
   into uploadChatAttachment's own promise, which is what actually happened
   in production: a photo sat as "uploading" forever with no toast and no
   way to retry, because nothing ever got the chance to fail. A `finally`
   cannot save this — the hang is INSIDE the try block's await, before
   `finally` would ever run. */
const COMPRESS_TIMEOUT_MS = 6000;

async function compressImage(file) {
  if (COMPRESS_SKIP_TYPES.has(file.type) || file.size < COMPRESS_SKIP_UNDER_BYTES) return file;
  if (typeof createImageBitmap !== "function") return file;

  return Promise.race([
    compressImageUnbounded(file),
    new Promise((resolve) => setTimeout(() => resolve(file), COMPRESS_TIMEOUT_MS)),
  ]);
}

async function compressImageUnbounded(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, COMPRESS_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    let blob;
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality: COMPRESS_QUALITY });
    } else if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
      blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))), "image/jpeg", COMPRESS_QUALITY);
      });
    } else {
      return file;
    }

    /* A source that was already a small, efficiently-encoded JPEG can end up
       re-encoding larger — in that case the original wins. */
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
  }
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
export async function uploadChatAttachment(spaceId, rawFile, kind, { onProgress } = {}) {
  const rules = ATTACHMENT_KIND_RULES[kind];
  if (!rules) throw new Error(`Unsupported attachment kind: ${kind}`);

  /* Compressed before the size check, not after — a 12 MB camera photo that
     compresses down to 2 MB should send, not get rejected for what it used
     to weigh. */
  const file = kind === "image" ? await compressImage(rawFile) : rawFile;
  if (file.size > rules.maxBytes) {
    const err = new Error("This file is too large to send.");
    err.reason = "too-large";
    throw err;
  }

  /* The SDK download runs concurrently with token retrieval — neither waits
     on the other, so the dynamic import adds no latency beyond its own
     first-time fetch. */
  const [{ upload }, token] = await Promise.all([
    loadBlobClient(),
    import("../firebase/auth.js").then((m) => m.getIdToken()),
  ]);
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
