/* TEMPORARY diagnostic endpoint — remove after debugging.
   Reports which env vars are present and which imports succeed, so we can
   pinpoint the cause of FUNCTION_INVOCATION_FAILED on the AI routes. */

export default async function handler(req, res) {
  const out = {
    step: "start",
    node: process.version,
    env: {
      FB_PROJECT_ID: !!process.env.FB_PROJECT_ID,
      FB_CLIENT_EMAIL: !!process.env.FB_CLIENT_EMAIL,
      FB_PRIVATE_KEY: !!process.env.FB_PRIVATE_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    },
  };
  try {
    out.step = "import firebase-admin/app";
    const app = await import("firebase-admin/app");
    out.firebaseAdminApp = Object.keys(app);

    out.step = "import firebase-admin/auth";
    const auth = await import("firebase-admin/auth");
    out.firebaseAdminAuth = Object.keys(auth);

    out.step = "import ./_middleware/verifyAuth.js";
    const mw = await import("./_middleware/verifyAuth.js");
    out.middleware = Object.keys(mw);

    out.step = "call verifyToken (no auth header)";
    const decoded = await mw.verifyToken({ headers: {} });
    out.verifyTokenResult = decoded;

    out.step = "done";
    return res.status(200).json(out);
  } catch (err) {
    return res.status(200).json({ ...out, crashedAt: out.step, error: err?.message, stack: err?.stack });
  }
}
