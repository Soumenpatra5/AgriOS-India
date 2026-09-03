/* Mirror a verified Firebase identity into the Postgres `users` table and return
   the internal row. Called at the start of every authenticated commerce request
   so downstream code has a stable internal user id (uuid) to use as a FK.

   Pure and dependency-injected: it takes the `sql` client as an argument (rather
   than importing it) so it is trivially unit-testable with a fake. */

import { generateAgriosUserId } from "./agriosId.js";

/* Normalize an Indian phone from a Firebase token claim: strip a leading +91. */
export function normalizePhone(raw) {
  if (!raw) return null;
  return String(raw).replace(/^\+91/, "") || null;
}

/* Postgres's SQLSTATE for a unique-violation. Only the fresh-insert branch of
   the upsert below can ever raise this — an existing user's row never
   reaches the agrios_user_id value at all, since ON CONFLICT (firebase_uid)
   diverts to the update branch before it would be written. */
const UNIQUE_VIOLATION = "23505";

export async function ensureUser(sql, decoded) {
  const firebaseUid = decoded?.sub;
  if (!firebaseUid) throw new Error("ensureUser: token has no subject (uid)");

  const phone = normalizePhone(decoded.phone_number);
  const name = decoded.name || null;

  /* A fresh candidate is generated on every call, but it is only ever
     WRITTEN on a true first insert — agrios_user_id is deliberately absent
     from the ON CONFLICT SET clause, so an existing user's id can never be
     touched, let alone reassigned. At the address space this ID space
     covers, the retry below exists to satisfy "guaranteed by a database
     constraint, not just randomness" rather than because a collision is
     ever expected in practice. */
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const rows = await sql`
        insert into users (firebase_uid, phone, name, agrios_user_id)
        values (${firebaseUid}, ${phone}, ${name}, ${generateAgriosUserId()})
        on conflict (firebase_uid) do update
          set phone = coalesce(excluded.phone, users.phone),
              name  = coalesce(excluded.name,  users.name)
        returning *`;
      return rows[0];
    } catch (err) {
      if (err?.code !== UNIQUE_VIOLATION || attempt === 4) throw err;
    }
  }
}
