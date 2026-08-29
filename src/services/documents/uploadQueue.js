/* Upload queue and retry for document files (brief §20, §21, §29).

   There is no separate queue store. A document whose file never reached the
   cloud already says so — storage:"local" means the bytes are on the device,
   storage:"pending" means the file was too big to hold inline and needs
   re-attaching — so the documents store IS the queue. That avoids a second
   copy of the file and a second thing that can drift out of sync with the
   first, which is exactly the duplication the brief warns against.

   The existing syncQueue is deliberately not reused: it carries Firestore
   metadata operations, and a base64 scan of someone's ID has no business
   passing through it.

   Retry is bounded and backed off. A file that cannot upload after several
   tries stops asking; the record is still complete and readable on the device,
   and the farmer can retry by hand from the document's detail screen. */

import { repo } from "../erp/erpDb.js";
import { storage as local } from "../../utils/storage.js";
import { UPLOAD_TIMEOUT_MS } from "./documentConfig.js";

const docs = repo("documents", { stripForSync: ["fileData"] });

export const MAX_ATTEMPTS = 5;

/* Backoff in minutes between attempts. A farmer who walks into signal should
   not wait long for the first retry; one who is genuinely offline should not
   have their battery drained by a tight loop. */
const BACKOFF_MIN = [0, 1, 5, 30, 120];

export const UPLOAD_STATE = {
  QUEUED: "queued",
  UPLOADING: "uploading",
  UPLOADED: "uploaded",
  FAILED: "failed",
  NOT_APPLICABLE: "none",
};

/* Does this record still owe the cloud a file? */
export function isPending(d) {
  if (!d || d.deletedAt) return false;
  if (d.storage === "cloud" || d.storage === "none") return false;
  return !!(d.fileData || d.storage === "pending");
}

export function uploadState(d) {
  if (!isPending(d)) return d?.storage === "cloud" ? UPLOAD_STATE.UPLOADED : UPLOAD_STATE.NOT_APPLICABLE;
  if ((d.uploadAttempts || 0) >= MAX_ATTEMPTS) return UPLOAD_STATE.FAILED;
  return UPLOAD_STATE.QUEUED;
}

/* Exported so the backoff ladder can be tested directly — it is pure, and the
   alternative is a test that waits two hours. */
export function dueNow(d, now) {
  const attempts = d.uploadAttempts || 0;
  if (attempts === 0) return true;
  if (attempts >= MAX_ATTEMPTS) return false;
  const waitMs = (BACKOFF_MIN[Math.min(attempts, BACKOFF_MIN.length - 1)]) * 60000;
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

const canReachCloud = () =>
  !!import.meta.env?.VITE_FB_API_KEY
  && typeof navigator !== "undefined" && navigator.onLine !== false
  && !!local.get("user")?.uid;

/* base64 back to a Blob, so a device-held file can be pushed later without
   the original File object (which does not survive a page reload). */
async function blobOf(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

/* Push one record's file to the cloud. Returns true on success. Never throws:
   a failed attempt is recorded on the record and retried later. */
export async function uploadOne(doc, { onProgress } = {}) {
  if (!isPending(doc) || !doc.fileData) return false;
  const uid = local.get("user")?.uid;
  if (!uid) return false;

  try {
    const { uploadFileResumable } = await import("../firebase/storage.js");
    const { storagePathFor } = await import("./documentService.js");
    const ext = (doc.fileName?.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
    const path = storagePathFor({
      ownerId: uid, subjectType: doc.subjectType, subjectId: doc.subjectId,
      category: doc.category, ext,
    });

    const blob = await blobOf(doc.fileData);
    const { promise, cancel } = uploadFileResumable(path, blob, onProgress);

    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { cancel(); reject(new Error("upload-timeout")); }, UPLOAD_TIMEOUT_MS);
    });
    let fileUrl;
    try { fileUrl = await Promise.race([promise, deadline]); }
    finally { clearTimeout(timer); }

    /* Drop the inline copy once the cloud has it — keeping both would double
       the space for no benefit. */
    await docs.update(doc.id, {
      fileUrl, storagePath: path, storage: "cloud", fileData: "",
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

/* Sweep every document that still owes the cloud a file. Serial on purpose:
   several large uploads at once on a rural connection make all of them slower
   and none of them finish. */
export async function processQueue({ onProgress, force = false } = {}) {
  if (_running) return { skipped: "already-running" };
  if (!canReachCloud()) return { skipped: "offline" };
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

/* Run the sweep when the device comes back online and once at startup.
   Returns a teardown function. */
export function startAutoRetry() {
  if (typeof window === "undefined") return () => {};
  const run = () => { processQueue().catch(() => {}); };
  window.addEventListener("online", run);
  const initial = setTimeout(run, 4000); // let the app finish booting first
  return () => { window.removeEventListener("online", run); clearTimeout(initial); };
}
