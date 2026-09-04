/* Postgres client for the commerce backend (Supabase).

   Uses a lazy module-level singleton so warm serverless invocations reuse the
   connection. Point DATABASE_URL at Supabase's TRANSACTION pooler (port 6543):
   with pgBouncer in transaction mode, prepared statements must be disabled
   (`prepare: false`). SSL is required by Supabase.

   The service-role connection bypasses RLS by design — authorization is
   enforced in the API layer (every handler verifies the Firebase token first).
   NEVER expose DATABASE_URL or this client to the browser. */

import postgres from "postgres";

let _sql = null;

export function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  /* idle_timeout was 20s, which meant any warm instance that sat quiet for
     longer re-paid the full TCP+TLS handshake to the pooler (~1s measured)
     on its next request. Five minutes keeps the socket alive across the
     gaps real usage actually has; the transaction pooler is built to hold
     many mostly-idle client connections, so this costs it nothing. */
  _sql = postgres(url, { prepare: false, ssl: "require", max: 3, idle_timeout: 300 });
  return _sql;
}
