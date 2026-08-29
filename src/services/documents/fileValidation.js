/* File validation for document uploads (brief §3, §28).

   Order matters. Cheap, local checks run first so an oversized or wrong-typed
   file is rejected before anything is read into memory; the byte-signature
   check runs last because it is the only one that touches file contents.

   HONEST LIMIT: every check here runs on the device. It is a correctness and
   safety aid for the farmer, not a security boundary — a hostile client can
   skip it entirely. The real boundaries are storage.rules (owner-only paths,
   15 MB cap, enforced by Firebase) and the fact that nothing this app stores
   is ever executed or served as HTML. Server-side content inspection would
   need a Cloud Function, which the Vercel Hobby function cap rules out today. */

import {
  MAX_DOCUMENT_SIZE_BYTES, MAX_DOCUMENT_SIZE_MB, enabledTypes, typeForExt,
} from "./documentConfig.js";

export const REJECT = {
  EMPTY: "empty",
  TOO_LARGE: "too_large",
  BAD_EXTENSION: "bad_extension",
  BAD_MIME: "bad_mime",
  CONTENT_MISMATCH: "content_mismatch",
  UNREADABLE: "unreadable",
};

const extOf = (name) => {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
};

/* Read only the first bytes — enough for every signature we check, and it
   avoids pulling a 10 MB scan into memory just to look at its header.

   Blob.arrayBuffer() is the modern path and the one that works off the main
   thread; FileReader is kept as a fallback for older Android WebViews that
   predate it. */
async function readHead(file, bytes = 16) {
  const slice = file.slice(0, bytes);
  if (typeof slice.arrayBuffer === "function") {
    return new Uint8Array(await slice.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result));
    fr.onerror = () => reject(fr.error || new Error("unreadable"));
    fr.readAsArrayBuffer(slice);
  });
}

const startsWith = (head, sig) => sig.every((b, i) => head[i] === b);

/* WEBP is RIFF....WEBP — the container magic alone would also match .wav and
   .avi, so the format tag at offset 8 has to be checked too. */
const isWebp = (head) =>
  startsWith(head, [0x52, 0x49, 0x46, 0x46]) &&
  head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;

export function matchesSignature(head, type) {
  if (!type?.magic) return true;
  if (type.ext === "webp") return isWebp(head);
  return type.magic.some((sig) => startsWith(head, sig));
}

/* Returns { ok: true, type } or { ok: false, reason, ...context }. Never
   throws: an unreadable file is a rejection the UI can explain, not a crash. */
export async function validateFile(file) {
  if (!file) return { ok: false, reason: REJECT.EMPTY };
  if (!file.size) return { ok: false, reason: REJECT.EMPTY, name: file.name };

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      ok: false, reason: REJECT.TOO_LARGE, name: file.name,
      size: file.size, limitMb: MAX_DOCUMENT_SIZE_MB,
    };
  }

  const ext = extOf(file.name);
  const byExt = typeForExt(ext);
  if (!byExt) {
    return { ok: false, reason: REJECT.BAD_EXTENSION, name: file.name, ext };
  }

  /* The browser's reported type is another claim, but a mismatch against the
     extension is worth catching early — it is the common shape of a renamed
     file, and it costs nothing to check. An empty type (some Android pickers)
     is tolerated; the signature check below is what actually decides. */
  if (file.type && !enabledTypes().some((t) => t.mime === file.type)) {
    return { ok: false, reason: REJECT.BAD_MIME, name: file.name, mime: file.type };
  }

  let head;
  try {
    head = await readHead(file);
  } catch {
    return { ok: false, reason: REJECT.UNREADABLE, name: file.name };
  }
  if (!head.length) return { ok: false, reason: REJECT.EMPTY, name: file.name };

  /* The decisive check: does the file's own first bytes agree with what its
     name claims? This is what rejects an executable renamed to .pdf. */
  if (!matchesSignature(head, byExt)) {
    return { ok: false, reason: REJECT.CONTENT_MISMATCH, name: file.name, ext };
  }

  return {
    ok: true,
    type: byExt,
    /* Trust the signature over the browser's guess — an Android picker that
       reports "" or application/octet-stream should not become the stored
       mimeType, because preview selection keys on it later. */
    mimeType: byExt.mime,
    size: file.size,
    name: file.name,
  };
}

/* Same record twice in one subject's list — matched on name+size rather than a
   content hash, which would mean reading every stored file back to compare.
   Advisory: the UI warns, it does not block (a farmer may legitimately have
   two scans of the same size). */
export function findDuplicate(existing, file) {
  if (!file) return null;
  return (existing || []).find(
    (d) => !d.deletedAt && d.fileName === file.name && Number(d.size) === Number(file.size),
  ) || null;
}
