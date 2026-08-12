/* Auth gate for commerce endpoints: verify the Firebase ID token, then mirror
   the identity into Postgres and return the internal user row. On failure it
   writes a 401 and returns null, so callers do: `const user = await
   requireUser(req, res, sql); if (!user) return;` */

import { verifyToken } from "../_middleware/verifyAuth.js";
import { ensureUser } from "./ensureUser.js";

export async function requireUser(req, res, sql) {
  const decoded = await verifyToken(req);
  if (!decoded) {
    res.status(401).json({ error: { message: "Unauthorized" } });
    return null;
  }
  return ensureUser(sql, decoded);
}
