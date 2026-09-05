/* Tier-3 Phase 3A module hooks — the SAME two seams Tier-1 replaces with
   vi.mock, done with Node's module.register() so they work in a real HTTP
   server process (vitest is not running here):

     api/_lib/db.js             -> load-harness/db.test.mjs        (PGlite)
     api/_middleware/verifyAuth -> load-harness/verifyAuth.test.mjs (x-test-uid)

   Everything else — farm.js routing table, the six-step gate, ensureUser,
   every action handler — is the real production module, unmodified.

   These hooks exist only in this directory and are only ever registered by
   load-harness/server.mjs; no production code imports or is aware of them. */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const key = (p) => pathToFileURL(path.join(root, p)).href.toLowerCase();

const REDIRECTS = new Map([
  [key("api/_lib/db.js"), pathToFileURL(path.join(root, "load-harness/db.test.mjs")).href],
  [key("api/_middleware/verifyAuth.js"), pathToFileURL(path.join(root, "load-harness/verifyAuth.test.mjs")).href],
]);

export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(specifier, context);
  const mapped = REDIRECTS.get(resolved.url.toLowerCase());
  if (mapped) return { url: mapped, shortCircuit: true };
  return resolved;
}
