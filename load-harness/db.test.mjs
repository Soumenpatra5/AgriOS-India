/* Stand-in for api/_lib/db.js under the load harness: getSql() returns the
   PGlite-backed client the Tier-1 harness owns. No DATABASE_URL is read, so
   no external Postgres — production or otherwise — can ever be reached from
   this process, regardless of what is in the environment. */

import { dbRef } from "../api/_lib/__tests__/e2e/harness.js";

export function getSql() {
  if (!dbRef.sql) throw new Error("load-harness: freshDb() has not run yet");
  return dbRef.sql;
}
