/* Mirror a verified Firebase identity into the Postgres `users` table and return
   the internal row. Called at the start of every authenticated commerce request
   so downstream code has a stable internal user id (uuid) to use as a FK.

   Pure and dependency-injected: it takes the `sql` client as an argument (rather
   than importing it) so it is trivially unit-testable with a fake. */

/* Normalize an Indian phone from a Firebase token claim: strip a leading +91. */
export function normalizePhone(raw) {
  if (!raw) return null;
  return String(raw).replace(/^\+91/, "") || null;
}

export async function ensureUser(sql, decoded) {
  const firebaseUid = decoded?.sub;
  if (!firebaseUid) throw new Error("ensureUser: token has no subject (uid)");

  const phone = normalizePhone(decoded.phone_number);
  const name = decoded.name || null;

  const rows = await sql`
    insert into users (firebase_uid, phone, name)
    values (${firebaseUid}, ${phone}, ${name})
    on conflict (firebase_uid) do update
      set phone = coalesce(excluded.phone, users.phone),
          name  = coalesce(excluded.name,  users.name)
    returning *`;
  return rows[0];
}
