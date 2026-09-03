/* POST /api/blob-upload — issues short-lived, scoped tokens for Farm Chat
   attachments to upload directly to Vercel Blob from the browser.

   WHY A SEPARATE ENDPOINT. Vercel Blob's client-upload flow (@vercel/blob's
   `upload()` + `handleUpload()`) expects its own request/response shape —
   trying to fold it into api/farm.js's `{action, spaceId, payload}` router
   would fight the SDK rather than use it as intended. This is the 12th
   top-level file under api/ (every routable file counts, api/_lib and
   api/_middleware do not) — the Hobby plan's cap, exactly. There is no room
   left for another top-level endpoint: anything added after this must go
   through an existing router (api/farm.js's action map, the way everything
   except this file and OTP/weather/AI-chat already does), not a new file.

   WHY DIRECT-TO-BLOB AT ALL, RATHER THAN THROUGH A FUNCTION. A photo or
   voice note routed through a serverless function eats into its execution
   budget and payload limits for no benefit — the file never needs to touch
   application code, only get authorized. The browser uploads the bytes
   straight to Vercel's storage; this endpoint only ever decides WHETHER that
   upload may happen, never handles the bytes themselves.

   AUTHORIZATION. The same six-step gate every other Farm Space write goes
   through — requireMembership + requirePermission(farm.chat.send) — run
   here via authorize(), exactly as api/farm.js's router already does for
   chat.send. A client cannot request a token for a space they are not an
   active, permitted member of, whatever pathname or clientPayload they send.

   PRIVACY LIMIT, STATED PLAINLY. Vercel Blob's public access mode (the only
   one this uses) means the resulting URL, once created, is fetchable by
   anyone who has it — there is no per-request auth check on Vercel's CDN
   side. The unguessable random suffix (addRandomSuffix, forced below
   regardless of what the client requests) is what stands in for that, the
   same trade-off this codebase already made — and documented — for Firebase
   Storage document URLs (see src/services/firebase/storage.js). The app's
   own gate still controls who ever LEARNS a URL exists (only chat.list/
   oneMessage responses to verified space members carry one); what happens
   to a copy of the link after that is the same limit either storage system
   has under this project's serverless-function budget. */

import { handleUpload } from "@vercel/blob/client";
import { getSql } from "./_lib/db.js";
import { HttpError } from "./_lib/http.js";
import { authorize } from "./_lib/farm/gate.js";

/* One entry per attachment kind Farm Chat accepts. Sizes are deliberately
   modest — this app is built for rural connections, and "upload progress"
   only matters because the file is often large enough to need it; it
   should never be so large that sending it is impractical to begin with. */
const KIND_RULES = {
  image:    { types: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"], maxBytes: 10 * 1024 * 1024 },
  video:    { types: ["video/mp4", "video/quicktime", "video/webm"], maxBytes: 50 * 1024 * 1024 },
  audio:    { types: ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg", "audio/aac"], maxBytes: 15 * 1024 * 1024 },
  document: {
    types: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    maxBytes: 15 * 1024 * 1024,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: { message: "POST only" } });

  try {
    const sql = getSql();

    const jsonResponse = await handleUpload({
      request: req,
      body: req.body,
      onBeforeGenerateToken: async (pathname, clientPayloadRaw) => {
        let payload;
        try { payload = JSON.parse(clientPayloadRaw || "{}"); } catch { payload = {}; }
        const { spaceId, kind } = payload;

        const rules = KIND_RULES[kind];
        if (!rules) throw new HttpError(400, "Unsupported attachment kind");

        /* The client names the file, but only within its own space's
           namespace — never trusted beyond that. */
        if (typeof spaceId !== "string" || !pathname.startsWith(`farm-chat/${spaceId}/`)) {
          throw new HttpError(400, "Invalid upload path");
        }

        /* The same gate api/farm.js's chat.send action runs — a token is
           never issued to someone who could not have sent the message this
           attachment is destined for. */
        await authorize(req, sql, { spaceId, permission: "farm.chat.send" });

        return {
          allowedContentTypes: rules.types,
          maximumSizeInBytes: rules.maxBytes,
          addRandomSuffix: true,
          validUntil: Date.now() + 5 * 60 * 1000,
        };
      },
      /* No completion side-effect needed: the client's own upload() promise
         resolving is what tells it the file has landed, and the message
         (with the resulting URL as an attachment) is created by the normal
         chat.send call right after — not by this webhook, which is not
         guaranteed to be reachable in every environment (e.g. localhost). */
      onUploadCompleted: async () => {},
    });

    return res.status(200).json(jsonResponse);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { message: err.message } });
    }
    console.error("blob-upload error:", err?.message);
    return res.status(400).json({ error: { message: err?.message || "Upload could not be authorized" } });
  }
}
