/* Document module configuration — one place for every limit and format so no
   UI component hardcodes them (brief §4).

   The size ceiling is deliberately below the 15 MB cap in storage.rules: the
   rules are the real, server-side enforcement and must always be the stricter
   backstop, while this value is what the app validates and explains to the
   farmer before a byte leaves the device. */

const envNum = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const MAX_DOCUMENT_SIZE_MB = envNum(import.meta.env?.VITE_MAX_DOCUMENT_SIZE_MB, 10);
export const MAX_DOCUMENT_SIZE_BYTES = MAX_DOCUMENT_SIZE_MB * 1024 * 1024;

/* A file kept on the device as base64 grows by ~33%, and every byte sits in
   IndexedDB. Offline capture stays well under the upload ceiling so a farmer
   on a cheap phone cannot fill their storage with one photo of a land deed. */
export const MAX_OFFLINE_INLINE_MB = envNum(import.meta.env?.VITE_MAX_OFFLINE_INLINE_MB, 4);
export const MAX_OFFLINE_INLINE_BYTES = MAX_OFFLINE_INLINE_MB * 1024 * 1024;

/* How long to wait for a cloud upload before giving up and keeping the file on
   the device instead.

   This exists because the Firebase SDK retries a failing resumable upload on
   its own for about two minutes. On a weak rural connection that means the
   farmer watches a progress bar sit at 0% with no explanation and no way out.
   Better to stop early and store locally: the document is safe either way, and
   the next attempt can push it to the cloud. */
export const UPLOAD_TIMEOUT_MS = envNum(import.meta.env?.VITE_DOC_UPLOAD_TIMEOUT_MS, 45000);

/* How long a deleted document's file is kept before it is destroyed for good.

   Deletes are soft, so the record can be restored — which is only meaningful
   while its file still exists. The window is the gap between "I deleted the
   wrong thing" and "stop paying to store something nobody wants": long enough
   for a farmer to notice a mistake, short enough that deleted scans do not
   accumulate in their storage forever. Set to 0 to destroy the file as soon as
   the record is deleted; restore would then bring back metadata only. */
export const DELETED_RETENTION_DAYS = envNum(import.meta.env?.VITE_DOC_RETENTION_DAYS, 30);

/* Days before expiry that a document starts being reported as "expiring soon".
   Kept here rather than in the alert code so the reminder ladder is one edit. */
export const EXPIRY_WINDOW_DAYS = envNum(import.meta.env?.VITE_DOC_EXPIRY_WINDOW_DAYS, 30);
export const EXPIRY_REMINDER_DAYS = [30, 15, 7, 1];

/* Accepted formats.

   `magic` is the file's real leading bytes. An extension is a claim by the
   person uploading; these bytes are the file itself, which is what makes
   "an .exe renamed to .pdf" detectable on the device (brief §3, §28).
   `null` means the format has no single stable signature to check.

   enabled:false entries are the extension points from the brief (DOC/XLS…).
   They are described here so adding one is a flag flip plus a preview
   decision — not a hunt through the codebase. They are NOT accepted today:
   Office files are zip containers that can carry macros, and nothing in this
   app can inspect them safely. */
export const FILE_TYPES = [
  { ext: "pdf",  mime: "application/pdf", magic: [[0x25, 0x50, 0x44, 0x46]], preview: "pdf",   enabled: true },
  { ext: "jpg",  mime: "image/jpeg",      magic: [[0xff, 0xd8, 0xff]],       preview: "image", enabled: true },
  { ext: "jpeg", mime: "image/jpeg",      magic: [[0xff, 0xd8, 0xff]],       preview: "image", enabled: true },
  { ext: "png",  mime: "image/png",       magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]], preview: "image", enabled: true },
  { ext: "webp", mime: "image/webp",      magic: [[0x52, 0x49, 0x46, 0x46]], preview: "image", enabled: true },

  { ext: "doc",  mime: "application/msword", magic: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], preview: "none", enabled: false },
  { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: [[0x50, 0x4b, 0x03, 0x04]], preview: "none", enabled: false },
  { ext: "xls",  mime: "application/vnd.ms-excel", magic: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], preview: "none", enabled: false },
  { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: [[0x50, 0x4b, 0x03, 0x04]], preview: "none", enabled: false },
];

export const enabledTypes = () => FILE_TYPES.filter((t) => t.enabled);

/* For the file picker's accept attribute. Advisory only — the OS dialog uses
   it as a filter, never as a guarantee, so validation still runs on the pick. */
export const acceptAttr = () =>
  [...new Set(enabledTypes().flatMap((t) => [t.mime, `.${t.ext}`]))].join(",");

export const typeForExt = (ext) =>
  enabledTypes().find((t) => t.ext === String(ext || "").toLowerCase()) || null;

export const previewKind = (mimeType) => {
  const t = enabledTypes().find((x) => x.mime === mimeType);
  return t ? t.preview : "none";
};
