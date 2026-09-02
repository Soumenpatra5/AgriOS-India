/* Document bytes on the device's own file system (OPFS).

   Documents used to be held as a base64 data URL on the record itself. That
   was always a compromise: base64 inflates a file by a third, the whole string
   has to be built in memory before IndexedDB ever sees it, and every read
   parses it back again. On a cheap phone a 4 MB scan became a ~5.5 MB string
   twice over, which is why anything larger was refused outright and left
   "pending" with no bytes at all.

   The Origin Private File System stores the Blob as a file, so nothing is
   encoded, nothing is held in memory whole, and the size ceiling that forced
   the "pending" state disappears. Files live in the browser's private storage
   for this origin — not the user's Downloads folder, not visible to other
   sites, and cleared if the user clears site data.

   OPFS is available in every browser this app targets, but not in every mode
   (some private-browsing contexts refuse it). When it is missing the caller
   falls back to the old base64 field, so a document is never lost for want of
   a file system — it is only stored less efficiently. */

const DIR = "documents";

let _dirPromise = null;

function opfsSupported() {
  return typeof navigator !== "undefined"
    && !!navigator.storage
    && typeof navigator.storage.getDirectory === "function";
}

/* One handle for the whole session. getDirectory() is cheap but not free, and
   every read and write would otherwise pay for it. */
function dir() {
  if (!_dirPromise) {
    _dirPromise = (async () => {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle(DIR, { create: true });
    })();
  }
  return _dirPromise;
}

/* A probe, not just a feature check: a browser can expose the API and still
   refuse to hand out a directory (private mode, storage pressure, a policy).
   Cached because the answer cannot change within a session. */
let _available = null;
export async function available() {
  if (_available !== null) return _available;
  if (!opfsSupported()) { _available = false; return false; }
  try {
    await dir();
    _available = true;
  } catch {
    _dirPromise = null;
    _available = false;
  }
  return _available;
}

/* Keys are app-generated, like storage paths: nothing the user typed becomes
   a filename, so a document called "../../x" cannot escape the directory. */
export function newKey(ext) {
  const rand = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`)
    .replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  const clean = String(ext || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  return clean ? `${rand}.${clean}` : rand;
}

/* Write a Blob and return its key, or null when OPFS is unavailable — the
   caller then keeps the file inline instead. Never throws for storage
   reasons; a failed write is reported as null so the document can still be
   saved by the fallback path. */
export async function put(blob, ext) {
  if (!(await available())) return null;
  const key = newKey(ext);
  try {
    const fh = await (await dir()).getFileHandle(key, { create: true });
    const w = await fh.createWritable();
    try {
      await w.write(blob);
    } finally {
      /* close() is what actually commits the file. Skipping it on an error
         path leaves a zero-byte entry behind. */
      await w.close();
    }
    return key;
  } catch {
    return null;
  }
}

/* Read a stored file back as a Blob. Returns null when the key is unknown —
   which is normal for a record written before this store existed, or one
   whose bytes the user cleared with their site data. */
export async function get(key) {
  if (!key || !(await available())) return null;
  try {
    const fh = await (await dir()).getFileHandle(key);
    return await fh.getFile();
  } catch {
    return null;
  }
}

export async function has(key) {
  return !!(await get(key));
}

/* Best effort: a key that is already gone is a success, not an error. */
export async function remove(key) {
  if (!key || !(await available())) return false;
  try {
    await (await dir()).removeEntry(key);
    return true;
  } catch {
    return false;
  }
}

/* Total bytes held, for the storage screen. Walks the directory rather than
   trusting the records, so files orphaned by a crash are still counted. */
export async function usage() {
  if (!(await available())) return { files: 0, bytes: 0 };
  let files = 0, bytes = 0;
  try {
    for await (const [, handle] of (await dir()).entries()) {
      if (handle.kind !== "file") continue;
      files += 1;
      bytes += (await handle.getFile()).size;
    }
  } catch { /* report what was counted before the walk failed */ }
  return { files, bytes };
}

/* Delete stored files that no record references any more. Callers pass the
   keys still in use; everything else in the directory is unreachable and only
   occupies the farmer's storage. */
export async function pruneOrphans(keysInUse) {
  if (!(await available())) return 0;
  const keep = new Set(keysInUse.filter(Boolean));
  let deleted = 0;
  try {
    const names = [];
    for await (const [name, handle] of (await dir()).entries()) {
      if (handle.kind === "file" && !keep.has(name)) names.push(name);
    }
    /* Collected first: removing entries while iterating the directory is not
       safe across implementations. */
    for (const n of names) if (await remove(n)) deleted += 1;
  } catch { /* leave the rest for the next sweep */ }
  return deleted;
}

/* Tests only — the availability probe and directory handle are cached for the
   life of the session, which would otherwise leak between cases. */
export function _resetForTests() {
  _dirPromise = null;
  _available = null;
}
