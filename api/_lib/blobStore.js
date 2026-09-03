/* Vercel Blob helpers shared between the upload endpoint (api/blob-upload.js)
   and Farm Chat's server logic (api/_lib/farm/chat.js) — kept here, under
   _lib, rather than imported from the endpoint file itself, the same
   separation every other shared piece in this app already follows (only
   files directly under api/ are routable). */

import { del } from "@vercel/blob";

/* Frees the actual file when a message is deleted for everyone — Vercel
   Blob makes that trivial, unlike this app's existing Firebase Storage
   documents, which are never deleted. Best-effort: a failed delete must
   not fail the message removal the farmer already asked for and was told
   succeeded. */
export async function deleteAttachment(url) {
  try { await del(url); } catch (err) { console.error("blob delete failed:", err?.message); }
}
