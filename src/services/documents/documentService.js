/* Unified document management — ONE service and ONE store for every document
   in the app.

   Before this there were two unrelated implementations: employee documents
   (IndexedDB + Firebase Storage + expiry + verification) and the farmer's
   Documents screen (a list of titles in localStorage, with no files at all).
   Both now live here, separated only by `subjectType`:

     owner    — the farmer's own records: land, KCC, insurance, soil card…
     employee — a worker's records: ID, bank proof, medical, agreements…

   STORAGE. Metadata always goes to IndexedDB and syncs like every other ERP
   record. The file itself goes to Firebase Storage under users/{uid}/… when a
   signed-in owner is online, and otherwise stays on the device as a base64
   data URL. `fileData` is in stripForSync, so a scan of someone's ID or bank
   passbook is never written into Firestore.

   ACCESS. The real boundary is storage.rules: objects live under the owner's
   uid and nobody else can read them. getDownloadURL() hands back a long-lived
   token URL rather than a short-lived signed one — expiring URLs need the
   Admin SDK on a server, which the deploy's function budget rules out today.
   That is a known, deliberate limit, not an oversight. */

import { repo } from "../erp/erpDb.js";
import { storage as local } from "../../utils/storage.js";
import { auditService } from "../employees/auditService.js";
import {
  EXPIRY_WINDOW_DAYS, MAX_OFFLINE_INLINE_BYTES, UPLOAD_TIMEOUT_MS,
  DELETED_RETENTION_DAYS, previewKind,
} from "./documentConfig.js";

/* fileData is a base64 blob: far past Firestore's 1 MB document limit, and
   sensitive besides. It stays in local IndexedDB and never leaves. */
const docs = repo("documents", { stripForSync: ["fileData"] });
const versions = repo("documentVersions", { stripForSync: ["fileData"] });

const today = () => new Date().toISOString().slice(0, 10);

/* ---------------------------------------------------------------- categories

   Every category the app has ever offered, in one list. The owner set came
   from the Documents screen, the employee set from the workforce module; the
   `group` is the scalable taxonomy from the brief so new categories slot in
   without another enum. `id` is the stored value and never changes. */
export const DOC_CATEGORIES = [
  { id: "land",       subject: "owner", versioned: true, group: "farm",         icon: "Map",           i18n: { en: "Land record", hi: "भूमि रिकॉर्ड", bn: "জমির রেকর্ড" } },
  { id: "kcc",        subject: "owner", group: "banking",      icon: "CreditCard",    i18n: { en: "Kisan Credit Card", hi: "किसान क्रेडिट कार्ड", bn: "কিষান ক্রেডিট কার্ড" } },
  { id: "insurance",  subject: "owner", versioned: true, group: "insurance",    icon: "ShieldCheck",   i18n: { en: "Crop insurance", hi: "फसल बीमा", bn: "ফসল বীমা" } },
  { id: "soil",       subject: "owner", group: "crop",         icon: "FlaskConical",  i18n: { en: "Soil health card", hi: "मृदा स्वास्थ्य कार्ड", bn: "মাটি স্বাস্থ্য কার্ড" } },
  { id: "bank",       subject: "owner", group: "banking",      icon: "Building2",     i18n: { en: "Bank passbook", hi: "बैंक पासबुक", bn: "ব্যাংক পাসবই" } },
  { id: "loan",       subject: "owner", versioned: true, group: "loan",         icon: "Landmark",      i18n: { en: "Loan document", hi: "ऋण दस्तावेज़", bn: "ঋণের নথি" } },
  { id: "lease",      subject: "owner", versioned: true, group: "contracts",    icon: "FileSignature", i18n: { en: "Lease agreement", hi: "पट्टा अनुबंध", bn: "ইজারা চুক্তি" } },
  { id: "subsidy",    subject: "owner", group: "government",   icon: "Building2",     i18n: { en: "Scheme / subsidy", hi: "योजना / सब्सिडी", bn: "প্রকল্প / ভর্তুকি" } },
  { id: "licence",    subject: "owner", group: "licences",     icon: "BadgeCheck",    i18n: { en: "Licence / permit", hi: "लाइसेंस / परमिट", bn: "লাইসেন্স / অনুমতি" } },
  { id: "tax",        subject: "owner", group: "tax",          icon: "Receipt",       i18n: { en: "Tax document", hi: "कर दस्तावेज़", bn: "কর সংক্রান্ত নথি" } },
  { id: "livestock",  subject: "owner", group: "livestock",    icon: "Rabbit",        i18n: { en: "Livestock record", hi: "पशुधन रिकॉर्ड", bn: "পশুসম্পদ রেকর্ড" } },

  { id: "profile_photo",   subject: "employee", group: "employee",     icon: "User",        i18n: { en: "Profile Photo", hi: "प्रोफ़ाइल फ़ोटो", bn: "প্রোফাইল ছবি" } },
  { id: "id_proof",        subject: "employee", group: "employee",     icon: "IdCard",      i18n: { en: "Identity Proof", hi: "पहचान प्रमाण", bn: "পরিচয় প্রমাণ" } },
  { id: "address_proof",   subject: "employee", group: "employee",     icon: "House",       i18n: { en: "Address Proof", hi: "पता प्रमाण", bn: "ঠিকানার প্রমাণ" } },
  { id: "agreement",       subject: "employee", versioned: true, group: "contracts",    icon: "FileSignature", i18n: { en: "Employment Agreement", hi: "रोज़गार अनुबंध", bn: "কর্মসংস্থান চুক্তি" } },
  { id: "joining_form",    subject: "employee", group: "employee",     icon: "FileText",    i18n: { en: "Joining Form", hi: "नियुक्ति फ़ॉर्म", bn: "যোগদান ফর্ম" } },
  { id: "bank_proof",      subject: "employee", group: "banking",      icon: "Building2",   i18n: { en: "Bank Account Proof", hi: "बैंक खाता प्रमाण", bn: "ব্যাঙ্ক অ্যাকাউন্ট প্রমাণ" } },
  { id: "qualification",   subject: "employee", group: "certificates", icon: "GraduationCap", i18n: { en: "Qualification Certificate", hi: "योग्यता प्रमाणपत्र", bn: "যোগ্যতার সনদ" } },
  { id: "skill_cert",      subject: "employee", group: "certificates", icon: "Award",       i18n: { en: "Skill Certificate", hi: "कौशल प्रमाणपत्र", bn: "দক্ষতার সনদ" } },
  { id: "training_cert",   subject: "employee", group: "certificates", icon: "Award",       i18n: { en: "Training Certificate", hi: "प्रशिक्षण प्रमाणपत्र", bn: "প্রশিক্ষণের সনদ" } },
  { id: "medical",         subject: "employee", group: "employee",     icon: "HeartPulse",  i18n: { en: "Medical / Fitness", hi: "चिकित्सा / फ़िटनेस", bn: "চিকিৎসা / ফিটনেস" } },
  { id: "driving_licence", subject: "employee", group: "licences",     icon: "Car",         i18n: { en: "Driving Licence", hi: "ड्राइविंग लाइसेंस", bn: "ড্রাইভিং লাইসেন্স" } },

  { id: "other", subject: "any", group: "other", icon: "FileText", i18n: { en: "Other", hi: "अन्य", bn: "অন্যান্য" } },
];

export const categoriesFor = (subjectType) =>
  DOC_CATEGORIES.filter((c) => c.subject === subjectType || c.subject === "any");

export const categoryOf = (id) =>
  DOC_CATEGORIES.find((c) => c.id === id) || DOC_CATEGORIES[DOC_CATEGORIES.length - 1];

/* ----------------------------------------------------------------- migration

   Runs once per device, lazily, before the first read. Old rows are copied,
   not moved: employeeDocuments and docs:list are left untouched so a failed
   or half-finished migration can never lose a farmer's records. */
const MIGRATION_FLAG = "docs:migrated:v1";
let _migration = null;

function fromEmployeeRow(r) {
  return {
    id: r.id,
    subjectType: "employee", subjectId: r.employeeId || "",
    category: r.type || "other",
    title: r.name || "", note: r.note || "", number: r.number || "",
    fileName: r.fileName || "", mimeType: r.mimeType || "", size: r.size || 0,
    storage: r.storage || (r.fileUrl || r.fileData ? "local" : "none"),
    storagePath: r.storagePath || "", fileUrl: r.fileUrl || "", fileData: r.fileData || "",
    issueDate: r.issueDate || "", expiryDate: r.expiryDate || "",
    status: r.status || "uploaded", verifiedDate: r.verifiedDate || "",
    uploadDate: r.uploadDate || today(),
    createdAt: r.createdAt || new Date().toISOString(),
  };
}

function fromOwnerRow(r) {
  return {
    id: String(r.id),
    subjectType: "owner", subjectId: "",
    category: r.type || "other",
    title: r.title || "", note: r.note || "", number: "",
    fileName: "", mimeType: "", size: 0,
    storage: "none", storagePath: "", fileUrl: "", fileData: "",
    issueDate: "", expiryDate: "",
    status: "uploaded", verifiedDate: "",
    uploadDate: r.ts ? new Date(r.ts).toISOString().slice(0, 10) : today(),
    createdAt: r.ts ? new Date(r.ts).toISOString() : new Date().toISOString(),
  };
}

/* Tests only: drop the once-per-session memo so a migration can be replayed.
   Production code must never call this — the memo is what stops every read
   racing the same migration. */
export function _resetMigrationForTests() { _migration = null; }

export function migrateOnce() {
  if (_migration) return _migration;
  _migration = (async () => {
    if (local.get(MIGRATION_FLAG)) return { skipped: true };

    const existing = await docs.getAll().catch(() => []);
    const seen = new Set(existing.map((d) => d.id));
    let employees = 0, owner = 0;

    /* Employee documents — the mature store, moved over field by field. */
    try {
      const old = await repo("employeeDocuments").getAll();
      for (const r of old) {
        if (seen.has(r.id)) continue;
        await docs.put(fromEmployeeRow(r));
        seen.add(r.id); employees++;
      }
    } catch { /* store absent on a fresh install */ }

    /* The farmer's localStorage list — titles and notes only, no files. */
    try {
      for (const r of local.get("docs:list", []) || []) {
        if (!r?.id || seen.has(String(r.id))) continue;
        await docs.put(fromOwnerRow(r));
        seen.add(String(r.id)); owner++;
      }
    } catch { /* malformed legacy value — nothing to salvage */ }

    local.set(MIGRATION_FLAG, true);
    return { employees, owner };
  })();
  return _migration;
}

/* -------------------------------------------------------------------- expiry */

export function expiryState(doc, ref = today()) {
  if (!doc?.expiryDate) return "valid";
  if (doc.expiryDate < ref) return "expired";
  const soon = new Date(ref + "T12:00:00");
  soon.setDate(soon.getDate() + EXPIRY_WINDOW_DAYS);
  return doc.expiryDate <= soon.toISOString().slice(0, 10) ? "expiring_soon" : "valid";
}

/* ------------------------------------------------------------------- service */

const sortRecent = (l) => l.sort((a, b) => (b.uploadDate || "").localeCompare(a.uploadDate || ""));

export const documentService = {
  DOC_CATEGORIES, categoriesFor, categoryOf, expiryState, previewKind,

  categoryLabel(id) {
    const c = DOC_CATEGORIES.find((x) => x.id === id);
    return c ? c.i18n.en : (id || "Document");
  },

  async list(subjectType, subjectId = "") {
    await migrateOnce();
    const all = await docs.getBy("subjectType", subjectType);
    return sortRecent(subjectId ? all.filter((d) => d.subjectId === subjectId) : all);
  },

  async all() {
    await migrateOnce();
    return sortRecent(await docs.getAll());
  },

  getById: (id) => docs.getById(id),

  /* Create a record. `file` is optional — a farmer may want to note that a
     document exists and where it is kept without photographing it. */
  async add({ subjectType = "owner", subjectId = "", category = "other",
              title = "", note = "", number = "", issueDate = "", expiryDate = "" },
            file, { onProgress, ownerId, uploadedBy = "" } = {}) {
    await migrateOnce();
    const rec = {
      subjectType, subjectId, category,
      title: title || file?.name || this.categoryLabel(category),
      note, number, issueDate, expiryDate,
      uploadDate: today(), status: "uploaded", uploadedBy,
      fileName: file?.name || "", mimeType: file?.type || "", size: file?.size || 0,
      storage: "none", storagePath: "", fileUrl: "", fileData: "",
    };

    if (file) Object.assign(rec, await putFile(file, { subjectType, subjectId, category, onProgress, ownerId }));

    let saved;
    try {
      saved = await docs.add(rec);
    } catch (err) {
      /* The bytes landed but the metadata row did not, so nothing in the app
         will ever reference that object again. Delete it rather than leave an
         invisible file sitting in the farmer's storage quota (brief §29). */
      if (rec.storagePath) {
        await import("../firebase/storage.js")
          .then((m) => m.deleteImage(rec.storagePath))
          .catch(() => {});
      }
      throw err;
    }
    auditService.log("document.created", {
      employeeId: subjectType === "employee" ? subjectId : "",
      detail: `${saved.title} (${category})`,
    });
    return saved;
  },

  update: (id, patch) => docs.update(id, patch),

  /* Swap the file on an existing record, keeping its metadata and identity.
     The new file is stored FIRST, so a failed replace leaves the original
     intact rather than losing both. */
  async replaceFile(id, file, { onProgress, ownerId, uploadedBy = "", changeNote = "" } = {}) {
    const existing = await docs.getById(id);
    if (!existing) return null;
    const stored = await putFile(file, {
      subjectType: existing.subjectType, subjectId: existing.subjectId,
      category: existing.category, onProgress, ownerId,
    });

    /* Keep the outgoing file for the record types where losing a previous
       version would matter — a land record or a lease is evidence, and the
       version it replaced may still be the one a dispute turns on. Everything
       else (a re-photographed soil card) is just churn, so the old object is
       deleted to reclaim the space. */
    const keep = !!categoryOf(existing.category).versioned;
    const hadFile = !!(existing.fileUrl || existing.fileData);

    if (keep && hadFile) {
      const prior = await versions.getBy("documentId", id);
      await versions.add({
        documentId: id,
        version: prior.length + 1,
        fileName: existing.fileName || "", mimeType: existing.mimeType || "", size: existing.size || 0,
        storage: existing.storage || "", storagePath: existing.storagePath || "",
        fileUrl: existing.fileUrl || "", fileData: existing.fileData || "",
        changedBy: uploadedBy, changeNote,
        changedAt: new Date().toISOString(),
      });
    }

    const updated = await docs.update(id, {
      ...stored,
      fileName: file.name, mimeType: file.type || stored.mimeType || "", size: file.size,
      replacedAt: new Date().toISOString(), replacedBy: uploadedBy,
      previousFileName: existing.fileName || "",
    });

    if (!keep && existing.storagePath && existing.storagePath !== stored.storagePath) {
      /* Best effort: a leftover object is wasted bytes, never a correctness
         problem, and must not fail the replace the farmer just did. */
      import("../firebase/storage.js")
        .then((m) => m.deleteImage(existing.storagePath))
        .catch(() => {});
    }
    auditService.log("document.replaced", {
      employeeId: existing.subjectType === "employee" ? existing.subjectId : "",
      detail: existing.title,
    });
    return updated;
  },

  /* Superseded files, newest first. Empty for categories we do not version. */
  versions: (documentId) => versions.getBy("documentId", documentId)
    .then((l) => l.sort((a, b) => (b.version || 0) - (a.version || 0))),

  isVersioned: (category) => !!categoryOf(category).versioned,

  /* Soft delete. The FILE is deliberately left in place: a delete that
     destroyed the scan immediately would make restore() a lie, and the most
     common reason to restore is having just deleted the wrong row.
     purgeExpiredDeletions() destroys it once the retention window passes. */
  async remove(id) {
    const d = await docs.getById(id);
    await docs.remove(id);
    auditService.log("document.removed", {
      employeeId: d?.subjectType === "employee" ? d.subjectId : "",
      detail: d?.title || id,
    });
    return d;
  },

  async restore(id) {
    const d = await docs.restore(id);
    if (d) {
      auditService.log("document.restored", {
        employeeId: d.subjectType === "employee" ? d.subjectId : "",
        detail: d.title || id,
      });
    }
    return d;
  },

  /* Irreversible: destroys the stored file, every superseded version, and the
     rows. This is the only path that frees cloud storage, so it has to reach
     the version objects too — they are invisible once their parent is gone and
     nothing else would ever clean them up. */
  async purge(id) {
    const d = (await docs.getById(id)) || (await docs.deleted()).find((x) => x.id === id);
    const vs = await versions.getBy("documentId", id);

    const paths = [d, ...vs].filter((x) => x?.storagePath).map((x) => x.storagePath);
    if (paths.length) {
      const { deleteImage } = await import("../firebase/storage.js").catch(() => ({}));
      /* Best effort per object: one failure (already gone, offline) must not
         strand the rest, and the rows are removed either way — a file we could
         not reach is a smaller problem than a row that never goes away. */
      if (deleteImage) await Promise.all(paths.map((p) => deleteImage(p).catch(() => {})));
    }

    for (const v of vs) await versions.purge(v.id);
    await docs.purge(id);
    return { id, filesDeleted: paths.length, versions: vs.length };
  },

  /* Retention sweep: destroy files for documents deleted longer ago than the
     window. Safe to call repeatedly — it only ever looks at tombstones. */
  async purgeExpiredDeletions({ now = Date.now(), retentionDays = DELETED_RETENTION_DAYS } = {}) {
    const cutoff = now - retentionDays * 86400000;
    const due = (await docs.deleted()).filter((d) => {
      const t = Date.parse(d.deletedAt);
      return Number.isFinite(t) && t <= cutoff;
    });
    let files = 0;
    for (const d of due) {
      const r = await this.purge(d.id).catch(() => null);
      if (r) files += r.filesDeleted;
    }
    return { purged: due.length, filesDeleted: files };
  },

  setStatus: (id, status) => docs.update(id, {
    status, ...(status === "verified" ? { verifiedDate: today() } : {}),
  }),

  /* Resolve a document to something openable. A cloud file is a URL; a local
     one is base64, which browsers refuse to navigate to at top level, so it
     becomes a blob URL the caller must revoke. */
  async openable(doc) {
    if (doc?.fileUrl) return { url: doc.fileUrl, revoke: null };
    if (!doc?.fileData) return null;
    try {
      const blob = await (await fetch(doc.fileData)).blob();
      const url = URL.createObjectURL(blob);
      return { url, revoke: () => URL.revokeObjectURL(url) };
    } catch { return null; }
  },

  logDownload(doc) {
    auditService.log("document.downloaded", {
      employeeId: doc?.subjectType === "employee" ? doc.subjectId : "",
      detail: doc?.title || "",
    });
  },

  /* Expiry roll-up across every document, for the Alerts Center. */
  async expirySummary() {
    const all = await this.all();
    const withExpiry = all.filter((d) => d.expiryDate);
    return {
      expired: withExpiry.filter((d) => expiryState(d) === "expired"),
      expiringSoon: withExpiry.filter((d) => expiryState(d) === "expiring_soon"),
    };
  },
};

/* Where a file physically goes.

   The path is fully app-generated: uid, subject, category and a random id.
   Nothing the farmer typed — and in particular no part of the original
   filename — becomes a path segment, so a name like "../../other-user/x"
   cannot escape its folder (brief §28). The original name is kept only as
   metadata, for display and download. */
export function storagePathFor({ ownerId, subjectType, subjectId, category, ext }) {
  const rand = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`)
    .replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  const subject = subjectId ? `${subjectType}/${subjectId}` : subjectType;
  return `users/${ownerId}/documents/${subject}/${category}/${rand}${ext ? `.${ext}` : ""}`;
}

const cloudAvailable = () =>
  !!import.meta.env?.VITE_FB_API_KEY && typeof navigator !== "undefined" && navigator.onLine !== false;

/* FileReader.readAsDataURL is the efficient browser path — it encodes natively
   rather than walking the bytes in JS — so it stays primary. The manual
   fallback covers environments without it, which includes the test runner. */
async function toDataUrl(file) {
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  /* Chunked: String.fromCharCode(...wholeFile) overflows the call stack on
     anything but a tiny file. */
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

/* Store the bytes and describe where they went. Cloud when we can, device
   otherwise; a cloud failure falls back to the device rather than losing the
   upload the farmer just waited for. */
async function putFile(file, { subjectType, subjectId, category, onProgress, ownerId }) {
  const uid = ownerId || local.get("user")?.uid;
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();

  if (cloudAvailable() && uid) {
    const path = storagePathFor({ ownerId: uid, subjectType, subjectId, category, ext });
    try {
      const { uploadFileResumable } = await import("../firebase/storage.js");
      const { promise, cancel } = uploadFileResumable(path, file, onProgress);

      /* Bounded wait. The SDK retries internally for ~2 minutes, which on a
         weak connection is two minutes of a motionless progress bar. Cancel
         at the deadline and keep the file on the device instead — the farmer
         gets their document saved either way. */
      let timer;
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => { cancel(); reject(new Error("upload-timeout")); }, UPLOAD_TIMEOUT_MS);
      });
      try {
        const fileUrl = await Promise.race([promise, deadline]);
        return { fileUrl, storagePath: path, storage: "cloud", fileData: "" };
      } finally {
        clearTimeout(timer);
      }
    } catch { /* fall through to the device */ }
  }

  /* Offline, signed out, or the upload failed. Keeping a huge scan inline
     would bloat IndexedDB on a cheap phone, so oversized files are recorded
     without their bytes and flagged for re-attachment. */
  if (file.size > MAX_OFFLINE_INLINE_BYTES) {
    return { storage: "pending", fileData: "", storagePath: "", fileUrl: "" };
  }
  onProgress?.(100);
  return { storage: "local", fileData: await toDataUrl(file), storagePath: "", fileUrl: "" };
}
