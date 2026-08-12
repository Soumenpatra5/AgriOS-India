/* Employee documents (spec §13–§17).

   Storage strategy (approved plan §2): when Firebase is configured AND online,
   the file is uploaded to Firebase Storage under the user path and only the
   download URL is stored; privacy is enforced by Firebase Storage security
   rules. Offline (or no Firebase), the file is kept as a base64 data-URL in
   IndexedDB so it still works fully offline and syncs later.

   HONEST LIMITS: signed/temporary URLs and malware scanning require Cloud
   Functions that don't exist yet — those remain extension points, not built.
   Metadata + expiry tracking work regardless of where the file lives. */

import { repo } from "../erp/erpDb.js";
import { storage } from "../../utils/storage.js";

export const DOC_TYPES = [
  { id: "profile_photo",  label: "Profile Photo" },
  { id: "id_proof",       label: "Identity Proof" },
  { id: "address_proof",  label: "Address Proof" },
  { id: "agreement",      label: "Employment Agreement" },
  { id: "joining_form",   label: "Joining Form" },
  { id: "bank_proof",     label: "Bank Account Proof" },
  { id: "qualification",  label: "Qualification Certificate" },
  { id: "skill_cert",     label: "Skill Certificate" },
  { id: "training_cert",  label: "Training Certificate" },
  { id: "medical",        label: "Medical / Fitness" },
  { id: "driving_licence", label: "Driving Licence" },
  { id: "other",          label: "Other Document" },
];

/* `fileData` (base64 blob) is stripped before cloud sync — it would exceed
   Firestore's 1 MB doc limit and would place sensitive scans in the cloud. It
   stays in local IndexedDB for offline access; the cloud path uses a Storage
   URL instead. */
const docs = repo("employeeDocuments", { stripForSync: ["fileData"] });
const today = () => new Date().toISOString().slice(0, 10);
const EXPIRY_WINDOW_DAYS = 30;

const typeLabel = (id) => DOC_TYPES.find((t) => t.id === id)?.label ?? id ?? "Document";

/* Cheap env check — avoids importing firebase into this chunk statically. */
const cloudAvailable = () =>
  !!import.meta.env.VITE_FB_API_KEY && typeof navigator !== "undefined" && navigator.onLine !== false;

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

export const documentService = {
  typeLabel,

  /* Expiry state from expiryDate (spec §17). */
  expiryState(doc, ref = today()) {
    if (!doc?.expiryDate) return "valid";
    if (doc.expiryDate < ref) return "expired";
    const soon = new Date(ref + "T12:00:00");
    soon.setDate(soon.getDate() + EXPIRY_WINDOW_DAYS);
    return doc.expiryDate <= soon.toISOString().slice(0, 10) ? "expiring_soon" : "valid";
  },

  /* Create a document record. `file` optional (metadata-only is allowed). */
  async add({ employeeId, type, name, number, issueDate, expiryDate }, file) {
    const rec = {
      employeeId, type,
      name: name || file?.name || typeLabel(type),
      number: number || "", issueDate: issueDate || "", expiryDate: expiryDate || "",
      uploadDate: today(), status: "uploaded",
      fileName: file?.name || "", mimeType: file?.type || "",
    };
    if (file) {
      // Cloud upload requires an authenticated owner so the file lands under
      // users/{uid}/… where the Storage rules grant owner-only access. Without
      // a uid we keep it local (base64) so nothing sensitive lands in a path
      // the rules would reject anyway.
      const ownerId = storage.get("user")?.uid;
      if (cloudAvailable() && ownerId) {
        try {
          const { uploadImage } = await import("../firebase/storage.js");
          const path = `users/${ownerId}/employees/${employeeId}/${Date.now()}-${file.name}`;
          rec.fileUrl = await uploadImage(path, file);
          rec.storagePath = path;
          rec.storage = "cloud";
        } catch {
          rec.fileData = await toDataUrl(file);
          rec.storage = "local";
        }
      } else {
        rec.fileData = await toDataUrl(file);
        rec.storage = "local";
      }
    }
    return docs.add(rec);
  },

  update: (id, patch) => docs.update(id, patch),
  remove: (id) => docs.remove(id),
  setStatus: (id, status) => docs.update(id, { status, ...(status === "verified" ? { verifiedDate: today() } : {}) }),

  forEmployee: (employeeId) => docs.getBy("employeeId", employeeId)
    .then((list) => list.sort((a, b) => (b.uploadDate || "").localeCompare(a.uploadDate || ""))),

  /* Expiry roll-up across all employees (for dashboards/notifications §17). */
  async expirySummary() {
    const all = await docs.getAll();
    const withExpiry = all.filter((d) => d.expiryDate);
    return {
      expired: withExpiry.filter((d) => this.expiryState(d) === "expired"),
      expiringSoon: withExpiry.filter((d) => this.expiryState(d) === "expiring_soon"),
    };
  },
};
