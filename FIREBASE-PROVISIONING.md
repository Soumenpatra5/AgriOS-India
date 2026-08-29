# Firebase — Provisioning Runbook

The app now points at the Firebase project **`agrios-india-app`** (`.env`,
`.firebaserc`). That project is **newly created and completely bare**. Until the
three services below are enabled, the app cannot log anyone in, cannot sync, and
cannot store a file.

Probed against the live project:

| Service | State | Evidence |
|---|---|---|
| Authentication | **not enabled** | `identitytoolkit …/v1/projects` → `400 CONFIGURATION_NOT_FOUND` |
| Firestore | **no database** | `firestore …/databases/(default)` → `403 "Cloud Firestore API has not been used in project agrios-india-app before or it is disabled"` |
| Storage | **no bucket** | `storage …/b/agrios-india-app.firebasestorage.app` → `404 "The specified bucket does not exist"` |

For contrast, the previous project `agrios-india` had working Auth and Firestore
(its Firestore answers `403 PERMISSION_DENIED`, i.e. the database exists and
rules correctly deny anonymous reads) but never had Storage either.

## Read this before switching

**Existing users cannot log in to the new project.** Firebase Auth accounts do
not transfer between projects. Everyone who has signed up has an account in
`agrios-india`, and to the new project they are strangers. They will have to
register again.

**Cloud data stays behind.** Synced Firestore documents live in the old project.
The app is local-first, so each device keeps everything in IndexedDB and nothing
visible is lost — but the cloud backup starts empty, and a farmer restoring onto
a new phone would find nothing there.

If that is not what you want, keep `.env` pointed at `agrios-india` and enable
Storage there instead — that alone fixes uploads without disturbing anyone.

## 1. Authentication

Console → **Build → Authentication → Get started**, then enable the methods the
app offers (`src/pages/Login.jsx`): Google, Apple, Facebook, X/Twitter, Email/
Password, and Phone. Each social provider needs its own OAuth client configured
in that provider's console; phone needs a billing account for SMS beyond the
free tier.

Then **Settings → Authorized domains**, and add:

- the production Vercel domain (the *new* one, after the account move)
- `localhost` for development

A domain missing here fails sign-in with a message that does not mention
domains, which is a slow thing to debug.

## 2. Firestore

Console → **Build → Firestore Database → Create database**.

- Location: `asia-south1` (Mumbai) or `asia-south2` (Delhi). **Permanent.**
- Start in production mode; `firestore.rules` is already written and replaces
  the defaults in the next step.

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

`.firebaserc` pins the project, so no `--project` flag is needed.

## 3. Storage

Console → **Build → Storage → Get started**.

- Location: same region as Firestore. **Permanent.**
- Confirm the bucket name matches `VITE_FB_STORAGE_BUCKET` — currently
  `agrios-india-app.firebasestorage.app`. If the console shows
  `…appspot.com` instead, change the env var to match the console, not the
  other way round.

```bash
npx firebase-tools deploy --only storage
```

`storage.rules` confines every file to `users/{uid}/…` and caps uploads at
15 MB.

### CORS

Browser uploads fail without this, with a preflight error that looks exactly
like a permissions problem. `cors.json` is at the repo root.

```bash
gcloud storage buckets update gs://agrios-india-app.firebasestorage.app --cors-file=cors.json
```

(or `gsutil cors set cors.json gs://agrios-india-app.firebasestorage.app`)

**Edit `cors.json` first.** It lists the old Vercel URL and the local dev ports.
Add the new production origin, or uploads keep failing in a way indistinguishable
from an unprovisioned bucket.

## 4. Push the config to Vercel

The six `VITE_FB_*` values and `FB_PROJECT_ID` are already updated in `.env` and
in `.env.newproject` (the migration file). They must also be set on the Vercel
project, for **production and preview** — the `VITE_*` ones are baked into the
bundle at build time, so a preview build missing them loses Firebase silently.

`VITE_FB_VAPID_KEY` (web push) is project-specific and is **not** carried over.
Generate a new key pair in Console → Project settings → Cloud Messaging → Web
Push certificates if push notifications are wanted.

## 5. Verify

1. Sign in on the deployed site with a fresh account.
2. Add a document with a PDF attached. Its detail screen should read
   **"Private cloud folder"**, not "This device".
3. Console → Storage shows the object under
   `users/{uid}/documents/owner/{category}/`.
4. Console → Firestore shows synced collections appearing.
5. Browser console: no CORS errors.

Anything captured while Storage was missing is still on the device and uploads
by itself — `uploadQueue` sweeps on reconnect and at startup. No data is lost in
the meantime and no migration is needed.
