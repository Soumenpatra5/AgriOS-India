# Firebase Storage — Provisioning Runbook

**Status: NOT PROVISIONED.** The bucket does not exist. Every document and photo
upload in the app currently fails and silently falls back to storing the file on
the device.

Verified against the live project:

```
GET https://storage.googleapis.com/storage/v1/b/agrios-india.firebasestorage.app
→ 404 { "error": { "message": "The specified bucket does not exist." } }
```

Both naming conventions (`…firebasestorage.app` and `…appspot.com`) return the
same. This is not a CORS problem and not a rules problem — Storage has never
been enabled on the Firebase project.

## What this breaks

Nothing visibly, which is why it went unnoticed for so long. `putFile()` in
`services/documents/documentService.js` tries the cloud, times out, and keeps
the file on the device as base64 instead. The farmer's document is saved and
readable; it just never reaches the cloud, so it is not backed up and does not
follow them to another device. `uploadQueue` retries in the background and will
push everything up on its own once the bucket exists — no data is lost in the
meantime and no migration is needed.

Affected: employee documents (ID, bank proof, medical), the farmer's own
documents (land records, KCC, insurance), and diagnostic photos.

## 1. Create the bucket — Firebase Console

This step cannot be scripted; it needs console access to the project.

1. Firebase Console → the `agrios-india` project → **Build → Storage**.
2. **Get started**. Accept the default rules for now — step 2 replaces them.
3. **Choose a location.** This is permanent and cannot be changed afterwards.
   Pick `asia-south1` (Mumbai) or `asia-south2` (Delhi): the users are in India,
   and a US bucket adds a round trip to every upload on a connection that can
   least afford it.
4. Confirm the bucket name matches `VITE_FB_STORAGE_BUCKET` in `.env` and in the
   Vercel project — currently `agrios-india.firebasestorage.app`. Newer projects
   get `.firebasestorage.app`; older ones get `.appspot.com`. If the console
   shows a different name, update the env var rather than the console.

## 2. Deploy the security rules

`storage.rules` is already written and committed. It confines every file to
`users/{uid}/…` and caps uploads at 15 MB. Without it the default rules apply,
which are far more permissive.

```bash
npx firebase-tools deploy --only storage
```

Requires `firebase login` first. Verify in Console → Storage → Rules that the
deployed rules match the file.

## 3. Apply CORS

Browser uploads fail without this, with a preflight error that looks like a
permissions problem but is not. `cors.json` is committed at the repo root.

```bash
gcloud storage buckets update gs://agrios-india.firebasestorage.app --cors-file=cors.json
```

(or `gsutil cors set cors.json gs://agrios-india.firebasestorage.app`)

**Add the production origin first.** `cors.json` lists the old Vercel URL and
the local dev ports. After the Vercel account move the production URL changes,
and an origin missing here fails exactly like an unprovisioned bucket.

## 4. Verify

With a signed-in user on the deployed site, attach a PDF to a document. Then:

- the document detail screen should read **"Private cloud folder"**, not
  "This device";
- Console → Storage should show the object under
  `users/{uid}/documents/owner/{category}/`;
- the browser console should show no CORS error.

Anything captured while the bucket was missing is still on the device and will
upload by itself — `uploadQueue` sweeps on reconnect and at startup.

## Note on the account move

If the Firebase project is moving to a new Google account along with GitHub and
Vercel, do that **before** creating the bucket. The bucket location is permanent,
so provisioning it under the old account and then migrating means either
recreating it or keeping a dependency on the old account.
