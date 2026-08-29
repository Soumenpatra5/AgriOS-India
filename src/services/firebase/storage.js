let _storage = null;

async function getStore() {
  if (_storage) return _storage;
  const { getStorage } = await import("firebase/storage");
  const { app } = await import("./config.js");
  _storage = getStorage(app);
  return _storage;
}

export async function uploadImage(path, file) {
  const { ref, uploadBytes, getDownloadURL } = await import(
    "firebase/storage"
  );
  const storage = await getStore();
  const storageRef = ref(storage, path);
  const snap = await uploadBytes(storageRef, file);
  return getDownloadURL(snap.ref);
}

/* Resumable upload with progress, for documents (brief §22).

   uploadBytes() above resolves only when the whole file has landed, which is
   fine for a small avatar but leaves a farmer on a 2G connection staring at a
   frozen button for a 10 MB scan. This reports bytes as they go and can be
   cancelled.

   Returns { promise, cancel }. `promise` resolves to the download URL.

   NOTE ON THE URL: getDownloadURL() returns a long-lived token URL, not a
   short-lived signed URL. The access boundary is storage.rules — the object
   lives under users/{uid}/ and only that owner can read it. Minting expiring
   URLs needs the Admin SDK server-side; see the Phase 3 note in the plan. */
export function uploadFileResumable(path, file, onProgress) {
  let task = null;
  let cancelled = false;

  const promise = (async () => {
    const { ref, uploadBytesResumable, getDownloadURL } = await import("firebase/storage");
    const storage = await getStore();
    if (cancelled) throw new Error("cancelled");

    task = uploadBytesResumable(ref(storage, path), file, {
      contentType: file.type || "application/octet-stream",
    });

    await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          if (typeof onProgress !== "function" || !snap.totalBytes) return;
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        },
        reject,
        resolve,
      );
    });
    return getDownloadURL(task.snapshot.ref);
  })();

  return {
    promise,
    cancel() {
      cancelled = true;
      try { task?.cancel(); } catch { /* already finished */ }
    },
  };
}

export async function deleteImage(path) {
  const { ref, deleteObject } = await import("firebase/storage");
  const storage = await getStore();
  await deleteObject(ref(storage, path));
}
