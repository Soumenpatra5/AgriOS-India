/* Shared error responder for commerce API handlers. Maps the "DB not wired yet"
   case to a clean 503 (so the client can degrade gracefully before Supabase is
   provisioned) and everything else to a generic 500 (never leaking internals). */

export function sendError(res, err, label = "commerce") {
  console.error(`${label} error:`, err);
  if (/DATABASE_URL is not set/.test(err?.message || "")) {
    return res.status(503).json({ error: { message: "Commerce backend is not configured — set DATABASE_URL." } });
  }
  return res.status(500).json({ error: { message: "Internal error" } });
}
