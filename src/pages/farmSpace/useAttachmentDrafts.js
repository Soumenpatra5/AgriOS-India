import { useState } from "react";
import { uploadChatAttachment, attachmentKindForFile, ATTACHMENT_KIND_RULES } from "../../services/farmSpace/farmChatUpload.js";

/* Attachment-draft lifecycle shared between Farm Chat's group channel
   (FarmSpaceChat.jsx) and 1:1 direct messages (FarmSpaceDm.jsx) — both
   picked files and a shared location go through the same
   uploading/done/error states before Send includes them.

   Extracted after a real production bug: the two screens each had their
   own copy of this logic, and BOTH copies silently swallowed a failed
   upload — no toast, and the only visible signal was an alert icon whose
   explanation lived in an HTML `title` attribute (a hover tooltip, invisible
   on touch devices). A farmer whose photo failed to send saw nothing telling
   them why, and had no way to retry short of removing the attachment and
   re-picking the file from scratch. Fixed here, once, so both screens get
   the fix rather than needing it applied twice (and inevitably drifting). */
/* A second, independent safety net on top of compressImage's own internal
   timeout (farmChatUpload.js) — that one only guards against a browser API
   that never settles. This guards the WHOLE upload (token request, the
   actual PUT to Blob, anything else in the chain), since fetch() itself has
   no built-in timeout and a stalled connection can hang indefinitely with
   neither a resolve nor a reject. Whatever the cause, a farmer must see a
   failure and a retry within a bounded time, never silence forever. */
const UPLOAD_TIMEOUT_MS = 30000;

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error(message), { reason: "timeout" })), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export function useAttachmentDrafts({ spaceId, toast, tc, max = 4 }) {
  const [attachmentDrafts, setAttachmentDrafts] = useState([]);

  const tooManyToast = () => {
    toast(tc({ en: `Up to ${max} attachments per message.`,
               hi: `प्रति संदेश अधिकतम ${max} अनुलग्नक।`,
               bn: `প্রতি বার্তায় সর্বোচ্চ ${max}টি সংযুক্তি।` }), "error");
  };

  /* Runs (or re-runs) the actual upload for a draft that already exists in
     the array — the one function both the initial add and a later retry
     both call, so the failure handling can only ever be written once. */
  const runUpload = (localId, file, kind) => {
    setAttachmentDrafts((d) => d.map((x) => (x.localId === localId ? { ...x, status: "uploading", progress: 0, error: null } : x)));
    const timeoutMessage = tc({ en: "Upload timed out — check your connection and retry.",
                                 hi: "अपलोड का समय समाप्त हो गया — कनेक्शन जाँचें और फिर कोशिश करें।",
                                 bn: "আপলোড সময় শেষ হয়েছে — সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।" });
    withTimeout(
      uploadChatAttachment(spaceId, file, kind, {
        onProgress: (pct) => setAttachmentDrafts((d) => d.map((x) => (x.localId === localId ? { ...x, progress: pct } : x))),
      }),
      UPLOAD_TIMEOUT_MS,
      timeoutMessage,
    ).then((result) => {
      /* Picks up whatever uploadChatAttachment actually sent (post-
         compression, for an image) rather than the original file's stats —
         what gets shown/stored should describe the bytes that landed on
         Blob, not the ones the farmer originally picked. */
      setAttachmentDrafts((d) => d.map((x) => (x.localId === localId
        ? { ...x, status: "done", url: result.url, name: result.name, size: result.size, type: result.type }
        : x)));
    }).catch((err) => {
      const message = err?.message || tc({ en: "Upload failed.", hi: "अपलोड विफल हुआ।", bn: "আপলোড ব্যর্থ হয়েছে।" });
      setAttachmentDrafts((d) => d.map((x) => (x.localId === localId ? { ...x, status: "error", error: message } : x)));
      toast(message, "error");
    });
  };

  /* `forceKind`/`extra` let a caller with its own idea of the file's kind
     (voice recordings are always "audio" and carry a duration no picked
     file does) reuse the same size-cap and upload path rather than
     duplicating it. */
  const addFileDraft = (file, { forceKind, extra = {} } = {}) => {
    if (attachmentDrafts.length >= max) { tooManyToast(); return; }
    const kind = forceKind || attachmentKindForFile(file);
    const rules = ATTACHMENT_KIND_RULES[kind];
    if (file.size > rules.maxBytes) {
      toast(tc({ en: "This file is too large to send.", hi: "यह फ़ाइल भेजने के लिए बहुत बड़ी है।", bn: "এই ফাইলটি পাঠানোর জন্য খুব বড়।" }), "error");
      return;
    }

    const localId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const previewUrl = (kind === "image" || kind === "video") ? URL.createObjectURL(file) : null;
    setAttachmentDrafts((d) => [...d, {
      localId, kind, file, name: file.name, size: file.size, type: file.type, previewUrl, ...extra,
      status: "uploading", progress: 0,
    }]);
    runUpload(localId, file, kind);
  };

  const runLocation = async (localId) => {
    setAttachmentDrafts((d) => d.map((x) => (x.localId === localId ? { ...x, status: "uploading", error: null } : x)));
    try {
      const { locationService } = await import("../../services/location/locationService.js");
      const pos = await locationService.currentPosition();
      setAttachmentDrafts((d) => d.map((x) => (x.localId === localId
        ? { ...x, status: "done", lat: pos.lat, lng: pos.lon, label: pos.name }
        : x)));
    } catch (err) {
      const message = err?.message || tc({ en: "Couldn't get your location.", hi: "आपका स्थान नहीं मिल सका।", bn: "আপনার অবস্থান পাওয়া যায়নি।" });
      setAttachmentDrafts((d) => d.map((x) => (x.localId === localId ? { ...x, status: "error", error: message } : x)));
      toast(message, "error");
    }
  };

  /* Coordinates only, resolved once at share-time — this is a location
     ATTACHMENT (a single point in the conversation, like WhatsApp's), not
     the farm's live/active location LocationPicker manages elsewhere. */
  const addLocationDraft = () => {
    if (attachmentDrafts.length >= max) { tooManyToast(); return; }
    const localId = `att-${Date.now()}-loc`;
    setAttachmentDrafts((d) => [...d, { localId, kind: "location", status: "uploading" }]);
    runLocation(localId);
  };

  const retryDraft = (localId) => {
    const draft = attachmentDrafts.find((x) => x.localId === localId);
    if (!draft) return;
    if (draft.kind === "location") { runLocation(localId); return; }
    if (draft.file) runUpload(localId, draft.file, draft.kind);
  };

  const removeDraft = (localId) => {
    setAttachmentDrafts((d) => {
      const found = d.find((x) => x.localId === localId);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return d.filter((x) => x.localId !== localId);
    });
  };

  const clearDrafts = () => setAttachmentDrafts([]);

  const payloadFrom = (drafts) => drafts.filter((d) => d.status === "done").map((d) => (d.kind === "location"
    ? { kind: "location", lat: d.lat, lng: d.lng, label: d.label }
    : { kind: d.kind, url: d.url, name: d.name, size: d.size, type: d.type, ...(d.kind === "audio" && d.duration != null ? { duration: d.duration } : {}) }));

  return {
    attachmentDrafts,
    addFileDraft,
    addLocationDraft,
    retryDraft,
    removeDraft,
    clearDrafts,
    payloadFrom,
    max,
    hasReadyAttachment: attachmentDrafts.some((d) => d.status === "done"),
    attachmentsUploading: attachmentDrafts.some((d) => d.status === "uploading"),
    /* Send is blocked while this is true — a failed attachment must be
       explicitly retried or removed, never silently left out of a message
       the farmer believed included it. */
    hasErroredAttachment: attachmentDrafts.some((d) => d.status === "error"),
  };
}
