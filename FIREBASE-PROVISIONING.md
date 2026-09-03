# Firebase — Provisioning Runbook

The app uses the Firebase project **`agrios-india`** (`.env`, `.firebaserc`).

| Service | State | Evidence |
|---|---|---|
| Authentication | working | users sign in today |
| Firestore | working | `403 PERMISSION_DENIED` — the database exists and rules correctly deny anonymous reads |
| Storage | **NOT PROVISIONED** | `404 "The specified bucket does not exist"` |

Only Storage is missing. Enabling it is the whole job.

> A second project, `agrios-india-app`, was created during an account move and
> is **bare** — no Auth (`400 CONFIGURATION_NOT_FOUND`), no Firestore, no
> Storage. Switching to it would log every existing user out permanently:
> Firebase Auth accounts do not transfer between projects, and synced Firestore
> data stays behind. Do not point `.env` at it without reading "Moving projects"
> at the bottom.

## What the missing bucket breaks

Nothing visibly, which is why it went unnoticed. `putFile()` in
`services/documents/documentService.js` tries the cloud, times out, and keeps
the file on the device as base64. Documents save and open normally — they are
just not backed up and do not follow a farmer to a new phone.

`uploadQueue` retries on reconnect and at startup, so **everything already
captured uploads by itself once the bucket exists**. No data is lost and no
migration is needed.

Affected: employee documents (ID, bank proof, medical), the farmer's own
documents (land records, KCC, insurance), and diagnostic photos.

## 1. Create the bucket

Console access only; this cannot be scripted.

1. Firebase Console → **`agrios-india`** → **Build → Storage → Get started**.
2. **Choose a location. This is permanent.** Pick `asia-south1` (Mumbai) or
   `asia-south2` (Delhi) — the users are in India, and a US bucket adds a round
   trip to every upload on the connections least able to afford one.
3. Confirm the bucket name matches `VITE_FB_STORAGE_BUCKET`, currently
   `agrios-india.firebasestorage.app`. If the console shows `…appspot.com`,
   change the env var to match the console rather than the reverse.

## 2. Deploy the rules

`storage.rules` is written and committed: every file is confined to
`users/{uid}/…` and uploads are capped at 15 MB. Without it the permissive
defaults apply.

```bash
npx firebase-tools login
npx firebase-tools deploy --only storage
```

`.firebaserc` pins the project, so no `--project` flag is needed.

## 3. Apply CORS

Browser uploads fail without this, with a preflight error that reads like a
permissions problem and is not.

```bash
gcloud storage buckets update gs://agrios-india.firebasestorage.app --cors-file=cors.json
```

(or `gsutil cors set cors.json gs://agrios-india.firebasestorage.app`)

**Check the origins in `cors.json` first.** It lists the current Vercel URL and
the local dev ports. If the Vercel account move changes the production URL, add
the new origin — a missing origin fails identically to a missing bucket.

## 4. Verify

With a signed-in user on the deployed site, attach a PDF to a document:

- the document detail screen reads **"Private cloud folder"**, not "This device";
- Console → Storage shows the object under
  `users/{uid}/documents/owner/{category}/`;
- the browser console shows no CORS error.

## Vercel environment variables — read this

Every variable on the Vercel project is typed **Sensitive**, which makes it
write-only. `vercel env pull` cannot return those values; it writes the literal
string `[SENSITIVE]` instead. Anything pulled that way is a placeholder, not a
secret.

The six `VITE_FB_*` values are recoverable regardless — they are compiled into
the client bundle, so the live deployment is an authoritative copy:

```bash
curl -s https://agrios-india.vercel.app/assets/config-BVsiJ1Ww.js | grep -o 'AIza[0-9A-Za-z_-]\{35\}'
```

These four exist **only** inside Vercel and cannot be read back from anywhere.
If they are ever lost they must be reissued, not recovered:

| Variable | Where to reissue |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com |

## Moving projects

If Firebase ever does move to another project or account:

- **Auth accounts do not transfer.** Every existing user must register again.
- **Firestore data does not transfer.** The app is local-first so no device
  loses anything, but the cloud backup starts empty.
- Both region choices (Firestore, Storage) are **permanent** — pick
  `asia-south1`/`asia-south2` at creation.
- Enable Auth providers and add the production domain under
  **Authentication → Settings → Authorized domains**, or sign-in fails with an
  error that never mentions domains.
- `VITE_FB_VAPID_KEY` (web push) is project-specific and must be regenerated.
