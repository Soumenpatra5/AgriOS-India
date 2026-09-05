/* STAGING-BRANCH-ONLY test for the load-test auth path in verifyAuth.js.
   Lives in the same swap commit as the implementation, so main never sees
   either. Proves the three guards and the fall-through behavior. */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import { verifyToken } from "../verifyAuth.js";

const SECRET = "test-secret-0123456789abcdef0123456789abcdef";
const mac = (uid, secret = SECRET) => createHmac("sha256", secret).update(uid).digest("hex");
const req = (headers = {}) => ({ headers });

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("LOAD_TEST_AUTH_SECRET", SECRET);
  /* No FB project id: the JWKS fallback fails closed, like the real preview. */
  vi.stubEnv("FB_PROJECT_ID", "");
  vi.stubEnv("VITE_FB_PROJECT_ID", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("load-test auth path (staging branch only)", () => {
  it("accepts a valid HMAC header and returns harness-convention claims", async () => {
    const uid = "TEST-USER-006";
    const claims = await verifyToken(req({ "x-load-test-auth": `${uid}:${mac(uid)}` }));
    expect(claims).toEqual({ sub: uid, name: "Tester 006", phone_number: "+919000000006" });
  });

  it("rejects a wrong MAC", async () => {
    const uid = "TEST-USER-006";
    expect(await verifyToken(req({ "x-load-test-auth": `${uid}:${mac(uid, "wrong-secret")}` }))).toBeNull();
    expect(await verifyToken(req({ "x-load-test-auth": `${uid}:deadbeef` }))).toBeNull();
  });

  it("rejects a valid MAC for a non-test identity — the secret cannot impersonate real users", async () => {
    const uid = "some-real-firebase-uid";
    expect(await verifyToken(req({ "x-load-test-auth": `${uid}:${mac(uid)}` }))).toBeNull();
  });

  it("guard 2: inert unless VERCEL_ENV is exactly 'preview'", async () => {
    const uid = "TEST-USER-006";
    const header = { "x-load-test-auth": `${uid}:${mac(uid)}` };
    for (const env of ["production", "development", ""]) {
      vi.stubEnv("VERCEL_ENV", env);
      expect(await verifyToken(req(header))).toBeNull();
    }
  });

  it("guard 3: inert without LOAD_TEST_AUTH_SECRET", async () => {
    vi.stubEnv("LOAD_TEST_AUTH_SECRET", "");
    const uid = "TEST-USER-006";
    expect(await verifyToken(req({ "x-load-test-auth": `${uid}:${mac(uid)}` }))).toBeNull();
  });

  it("falls through to production behavior: no header at all still returns null", async () => {
    expect(await verifyToken(req())).toBeNull();
  });

  it("a Firebase Bearer token is still rejected when no project id is configured", async () => {
    /* The preview has no FB_PROJECT_ID, so even a genuine production token
       must fail closed there. */
    expect(await verifyToken(req({ authorization: "Bearer eyJhbGciOiJSUzI1NiJ9.e30.sig" }))).toBeNull();
  });
});
