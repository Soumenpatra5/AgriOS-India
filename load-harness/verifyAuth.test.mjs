/* Stand-in for api/_middleware/verifyAuth.js under the load harness: the same
   testVerifyToken the Tier-1 suite uses — an x-test-uid header IS the
   identity. No Google JWKS fetch, no Firebase, no production credentials.
   Only the load-harness server ever registers the hook that maps to this. */

export { testVerifyToken as verifyToken } from "../api/_lib/__tests__/e2e/harness.js";
