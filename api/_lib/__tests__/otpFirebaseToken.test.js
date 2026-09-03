import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateKeyPair, exportPKCS8, jwtVerify } from "jose";

import { signingMode, customTokenConfigured, mintCustomToken } from "../otp/firebaseToken.js";

/* Minting the Firebase custom token.

   Two signers, and which one runs matters: Google blocks service-account key
   creation by default, so federation is the path that actually works on this
   project. These check that the choice is made correctly, that the claims
   Firebase requires are present either way, and that a misconfiguration is a
   clean 503 rather than a broken token. */

const AUD = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";
const SAVED = { ...process.env };

beforeEach(() => {
  for (const k of ["GCP_PROJECT_NUMBER", "GCP_WORKLOAD_IDENTITY_POOL_ID",
                   "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID", "GCP_SERVICE_ACCOUNT_EMAIL",
                   "FB_CLIENT_EMAIL", "FB_PRIVATE_KEY", "VERCEL_OIDC_TOKEN"]) {
    delete process.env[k];
  }
});
afterEach(() => { process.env = { ...SAVED }; vi.unstubAllGlobals(); });

const wifEnv = () => {
  process.env.GCP_PROJECT_NUMBER = "123456789012";
  process.env.GCP_WORKLOAD_IDENTITY_POOL_ID = "vercel";
  process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID = "vercel";
  process.env.GCP_SERVICE_ACCOUNT_EMAIL = "vercel@agrios-india-app.iam.gserviceaccount.com";
};

async function statusOf(fn) {
  try { await fn(); return 200; } catch (e) { return e?.status ?? 500; }
}

describe("choosing a signer", () => {
  it("reports nothing configured when neither is set", () => {
    expect(signingMode()).toBeNull();
    expect(customTokenConfigured()).toBe(false);
  });

  it("prefers federation when both are available", async () => {
    wifEnv();
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    process.env.FB_CLIENT_EMAIL = "sa@example.com";
    process.env.FB_PRIVATE_KEY = await exportPKCS8(privateKey);

    /* The keyless path is the one Google leaves open, so it wins. */
    expect(signingMode()).toBe("federation");
  });

  it("falls back to a local key when federation is not set up", async () => {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    process.env.FB_CLIENT_EMAIL = "sa@example.com";
    process.env.FB_PRIVATE_KEY = await exportPKCS8(privateKey);
    expect(signingMode()).toBe("private-key");
  });

  it("refuses to mint anything when neither is configured", async () => {
    expect(await statusOf(() => mintCustomToken("uid-1"))).toBe(503);
  });
});

describe("the token Firebase will accept", () => {
  it("carries the claims Firebase requires", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
    process.env.FB_CLIENT_EMAIL = "sa@agrios-india-app.iam.gserviceaccount.com";
    process.env.FB_PRIVATE_KEY = await exportPKCS8(privateKey);

    const jwt = await mintCustomToken("phone:919876543210", { phone_number: "+919876543210" });
    const { payload } = await jwtVerify(jwt, publicKey, { audience: AUD });

    expect(payload.uid).toBe("phone:919876543210");
    expect(payload.iss).toBe(process.env.FB_CLIENT_EMAIL);
    expect(payload.sub, "iss and sub must both be the service account").toBe(payload.iss);
    expect(payload.aud).toBe(AUD);
    expect(payload.claims).toEqual({ phone_number: "+919876543210" });
  });

  it("expires within Firebase's one-hour ceiling", async () => {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    process.env.FB_CLIENT_EMAIL = "sa@example.com";
    process.env.FB_PRIVATE_KEY = await exportPKCS8(privateKey);

    const jwt = await mintCustomToken("uid-1");
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
    const life = payload.exp - payload.iat;
    expect(life).toBeGreaterThan(0);
    expect(life, "Firebase rejects anything longer than an hour").toBeLessThanOrEqual(3600);
  });

  it("repairs a PEM whose newlines were flattened by a web form", async () => {
    /* Pasting a key into Vercel turns real newlines into literal \n. Handling
       it here is the difference between a working deploy and an opaque error. */
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    process.env.FB_CLIENT_EMAIL = "sa@example.com";
    process.env.FB_PRIVATE_KEY = (await exportPKCS8(privateKey)).replace(/\n/g, "\\n");

    expect(await statusOf(() => mintCustomToken("uid-1"))).toBe(200);
  });
});

describe("federation", () => {
  it("exchanges the Vercel token and asks Google to sign", async () => {
    wifEnv();
    const calls = [];

    vi.stubGlobal("fetch", async (url, opts) => {
      calls.push({ url: String(url), body: JSON.parse(opts.body) });
      if (String(url).includes("sts.googleapis.com")) {
        return new Response(JSON.stringify({ access_token: "ya29.fake" }), { status: 200 });
      }
      return new Response(JSON.stringify({ signedJwt: "signed.by.google" }), { status: 200 });
    });

    const req = { headers: { "x-vercel-oidc-token": "vercel-oidc-token" } };
    const jwt = await mintCustomToken("phone:919876543210", { phone_number: "+919876543210" }, req);
    expect(jwt).toBe("signed.by.google");

    /* The exchange must present Vercel's token against the pool that trusts
       it — an audience naming another pool would be accepted by nobody. */
    const exchange = calls[0];
    expect(exchange.body.subjectToken).toBe("vercel-oidc-token");
    expect(exchange.body.audience).toBe(
      "//iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/vercel/providers/vercel");
    expect(exchange.body.grantType).toBe("urn:ietf:params:oauth:grant-type:token-exchange");

    /* And Google signs the same claims the local path would produce. */
    const sign = calls[1];
    expect(sign.url).toContain(":signJwt");
    const claims = JSON.parse(sign.body.payload);
    expect(claims.uid).toBe("phone:919876543210");
    expect(claims.aud).toBe(AUD);
    expect(claims.iss).toBe(process.env.GCP_SERVICE_ACCOUNT_EMAIL);
  });

  it("fails cleanly when the request carries no OIDC token", async () => {
    wifEnv();   // federation configured, but the header is absent
    expect(await statusOf(() => mintCustomToken("uid-1", {}, { headers: {} }))).toBe(503);
  });

  it("reads the token from the request header, not the environment", async () => {
    /* Inside a Vercel function the token arrives as x-vercel-oidc-token;
       VERCEL_OIDC_TOKEN only exists during builds and local dev. Reading the
       wrong one looks exactly like "federation is switched off". */
    wifEnv();
    let sent = null;
    vi.stubGlobal("fetch", async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (String(url).includes("sts.googleapis.com")) {
        sent = body.subjectToken;
        return new Response(JSON.stringify({ access_token: "ya29.fake" }), { status: 200 });
      }
      return new Response(JSON.stringify({ signedJwt: "signed.by.google" }), { status: 200 });
    });

    await mintCustomToken("uid-1", {}, { headers: { "x-vercel-oidc-token": "from-header" } });
    expect(sent).toBe("from-header");
  });

  it("still accepts the environment variable, for builds and local dev", async () => {
    wifEnv();
    process.env.VERCEL_OIDC_TOKEN = "from-env";
    let sent = null;
    vi.stubGlobal("fetch", async (url, opts) => {
      if (String(url).includes("sts.googleapis.com")) {
        sent = JSON.parse(opts.body).subjectToken;
        return new Response(JSON.stringify({ access_token: "ya29.fake" }), { status: 200 });
      }
      return new Response(JSON.stringify({ signedJwt: "signed" }), { status: 200 });
    });

    await mintCustomToken("uid-1", {}, { headers: {} });
    expect(sent).toBe("from-env");
  });

  it("says nothing about Google's error to whoever is signing in", async () => {
    wifEnv();
    vi.stubGlobal("fetch", async () => new Response(
      JSON.stringify({ error: { message: "workloadIdentityPools/vercel: subject not authorised" } }), { status: 403 }));

    let caught;
    try { await mintCustomToken("uid-1", {}, { headers: { "x-vercel-oidc-token": "t" } }); } catch (e) { caught = e; }
    expect(caught.status).toBe(503);
    /* The pool name and the subject stay in the server log, not the response. */
    expect(caught.message).not.toMatch(/workloadIdentityPools|subject|403/);
  });
});
