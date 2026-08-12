/* Pure last-write-wins reconciliation for sync (H2/H3). Kept DOM/Firestore-free
   so it can be unit-tested in isolation.

   A record's "time" is the newest of its deletedAt / updatedAt / createdAt. When
   a local and a cloud copy of the same id both exist, the newer one wins — so a
   newer cloud TOMBSTONE (deletedAt set) deletes the local record instead of it
   resurrecting, and a newer local edit is not clobbered by a stale cloud copy.
   On an exact tie a tombstone wins, biasing against resurrection. */

export function recordTime(r) {
  if (!r) return 0;
  const t = r.deletedAt || r.updatedAt || r.createdAt || 0;
  const n = typeof t === "number" ? t : Date.parse(t);
  return Number.isFinite(n) ? n : 0;
}

/* Returns the record that should win locally (may be a tombstone), or null. */
export function reconcile(local, cloud) {
  if (!cloud) return local ?? null;
  if (!local) return cloud;
  const tc = recordTime(cloud);
  const tl = recordTime(local);
  if (tc > tl) return cloud;
  if (tl > tc) return local;
  // Tie: prefer a deletion from either side (avoid resurrection), else cloud.
  if (cloud.deletedAt) return cloud;
  if (local.deletedAt) return local;
  return cloud;
}
