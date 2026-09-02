/* Moving document bytes into the device file store.

   This was a cloud upload queue. It no longer is, because there is no cloud
   for documents: the Firebase Storage bucket was never provisioned, so every
   push failed at the network layer and the SDK — which treats a connection
   failure as retryable — backed off and retried for minutes at a time. The
   documents themselves were fine; they were on the device the whole way.

   Documents now go straight to the device file system (OPFS) on save, so
   nothing written today is ever queued. What is still queued is history:
   records created before the move carry their bytes inline as base64, which is
   a third larger than the file and has to be parsed on every read. This sweep
   moves those into the file store and drops the inline copy.

   The public shape is unchanged — isPending / uploadState / retryNow /
   processQueue / startAutoRetry — because the documents screens render from
   it. A "pending" record now means "still inline", and the work is local, so
   it no longer waits on a network.

   There is still no separate queue store. A record that says storage:"local"
   with a fileData blob IS the queue entry, which avoids a second copy of the
   file and a second thing that can drift out of sync with the first. */

import { repo } from "../erp/erpDb.js";
import * as fileStore from "./fileStore.js";

const docs = repo("documents", { stripForSync: ["fileData", "fileKey"] });

export const MAX_ATTEMPTS = 5;

/* Retained so a record that cannot be moved (corrupt base64, a file system
   that keeps refusing) stops being retried on every sweep. The work is local
   and fast, so the ladder is in seconds rather than the old minutes. */
const BACKOFF_SEC = [0, 5, 30, 120, 600];

export const UPLOAD_STATE = {
  QUEUED: "queued",
  UPLOADING: "uploading",
  UPLOADED: "uploaded",
  FAILED: "failed",
  NOT_APPLICABLE: "none",
};

/* Does this record still hold its bytes inline rather than in the file store? */
export function isPending(d) {
  if (!d || d.deletedAt) return false;
  if (d.fileKey) return false;
  if (d.storage === "cloud" || d.storage === "device" || d.storage === "none") return false;
  return !!(d.fileData || d.storage === "pending");
}

export function uploadState(d) {
  if (!isPending(d)) {
    return (d?.fileKey || d?.storage === "cloud") ? UPLOAD_STATE.UPLOADED : UPLOAD_STATE.NOT_APPLICABLE;
  }
  if ((d.uploadAttempts || 0) >= MAX_ATTEMPTS) return UPLOAD_STATE.FAILED;
  return UPLOAD_STATE.QUEUED;
}

/* Exported so the backoff ladder can be tested directly — it is pure, and the
   alternative is a test that waits ten minutes. */
export function dueNow(d, now) {
  const attempts = d.uploadAttempts || 0;
  if (attempts === 0) return true;
  if (attempts >= MAX_ATTEMPTS) return false;
  const waitMs = BACKOFF_SEC[Math.min(attempts, BACKOFF_SEC.length - 1)] * 1000;
  return now - new Date(d.lastAttemptAt || 0).getTime() >= waitMs;
}

export async function pending() {
  return (await docs.getAll()).filter(isPending);
}

export async function queueSummary() {
  const list = await pending();
  return {
    queued: list.filter((d) => uploadState(d) === UPLOAD_STATE.QUEUED).length,
    failed: list.filter((d) => uploadState(d) === UPLOAD_STATE.FAILED).length,
    total: list.length,
  };
}

/* base64 back to a Blob. The original File object does not survive a reload,
   so the inline copy is the only source for a historical record. */
async function blobOf(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

/* Move one record's inline bytes into the device file store. Returns true on
   success. Never throws: a failed attempt is recorded and retried later. */
export async function uploadOne(doc, { onProgress } = {}) {
  if (!isPending(doc) || !doc.fileData) return false;

  try {
    /* Nothing to move to if the browser will not give us a file system. The
       record stays inline and readable — worse on space, never broken. */
    if (!(await fileStore.available())) return false;

    const ext = (doc.fileName?.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
    const blob = await blobOf(doc.fileData);
    const fileKey = await fileStore.put(blob, ext);
    if (!fileKey) return false;

    onProgress?.(100);

    /* Drop the inline copy only once the file store has the bytes — keeping
       both would double the space, losing both would lose the document. */
    await docs.update(doc.id, {
      fileKey, storage: "device", fileData: "",
      uploadAttempts: 0, lastAttemptAt: "", uploadError: "",
    });
    return true;
  } catch (err) {
    await docs.update(doc.id, {
      uploadAttempts: (doc.uploadAttempts || 0) + 1,
      lastAttemptAt: new Date().toISOString(),
      uploadError: String(err?.message || err).slice(0, 200),
    });
    return false;
  }
}

let _running = false;

/* Sweep every record still holding its bytes inline. Serial on purpose: these
   are large blobs, and decoding several at once on a cheap phone is how the
   main thread starts dropping frames. */
export async function processQueue({ onProgress, force = false } = {}) {
  if (_running) return { skipped: "already-running" };
  if (!(await fileStore.available())) return { skipped: "no-file-store" };
  _running = true;
  try {
    const now = Date.now();
    const list = (await pending()).filter((d) => force || dueNow(d, now));
    let uploaded = 0, failed = 0;
    for (const d of list) {
      const ok = await uploadOne(d, { onProgress: (p) => onProgress?.(d.id, p) });
      ok ? uploaded++ : failed++;
    }
    return { uploaded, failed, considered: list.length };
  } finally {
    _running = false;
  }
}

/* Retry one document immediately, ignoring backoff and the attempt ceiling —
   this is the farmer explicitly asking, which should always be honoured. */
export async function retryNow(id) {
  const d = await docs.getById(id);
  if (!d) return false;
  await docs.update(id, { uploadAttempts: 0, uploadError: "" });
  return uploadOne({ ...d, uploadAttempts: 0 });
}

/* Run the sweep once at startup. The old build also ran it on the `online`
   event, which no longer means anything: moving bytes between two places on
   the same device does not need a network. Returns a teardown function. */
export function startAutoRetry() {
  if (typeof window === "undefined") return () => {};
  const initial = setTimeout(() => { processQueue().catch(() => {}); }, 4000);
  return () => clearTimeout(initial);
}
