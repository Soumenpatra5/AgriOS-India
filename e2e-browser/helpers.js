/* Shared plumbing for the Tier-2 browser suite.

   SAFETY CONTRACT (from the QA brief): no fake identity may ever reach a real
   backend. Two independent guarantees enforce it:

   1. The bundle under test is built with VITE_FB_API_KEY blank, so
      `fbEnabled` is false — the Firebase SDK is never initialised and
      `onAuthChange` is a no-op (src/services/firebase/config.js documents
      that the app is designed to run this way). This is also what keeps an
      injected localStorage user stable: with Firebase enabled, the
      auth-state observer would correctly sign out a user who has no real
      session — that protection is itself asserted in the Tier-1 suite.
   2. Belt-and-braces: every test context aborts all non-localhost requests,
      so even a mis-built bundle could not send anything anywhere.

   The injected user unlocks the full local-first surface (IndexedDB-backed
   features, tab shell, navigation) — exactly the code paths a signed-in
   farmer exercises on-device, minus the server round-trips that Tier-1
   already covers at the handler level. */

export const TEST_USER = {
  uid: "PW-TEST-UID-001",
  phone: "9000000001",
  name: "Playwright Tester",
  email: "",
  photo: "",
  provider: "phone",
  joined: 1700000000000,
};

/* Abort everything that is not same-origin. */
export async function blockExternal(context) {
  await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
}

/* Collect page errors + console.error lines for the whole test. */
export function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  return errors;
}

/* Blocked external requests surface as resource-load console errors — that is
   the sandbox working, not an app bug. Everything else counts. */
const BENIGN = /net::ERR_FAILED|Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|Failed to fetch|NetworkError|dynamically imported module/i;
export const realErrors = (errors) => errors.filter((e) => !BENIGN.test(e));

/* Seed the pre-app flags the way storage.js writes them (JSON-encoded under
   the "agrios:" namespace) so nextAfterSplash() returns "app". */
export async function seedSignedIn(page, { lang = "en" } = {}) {
  await page.addInitScript(
    ([user, lang]) => {
      localStorage.setItem("agrios:lang", JSON.stringify(lang));
      localStorage.setItem("agrios:onboarded", "true");
      /* A returning user has dismissed the first-run Home tour; without this
         its scrim overlays the bottom nav and intercepts every tab click. */
      localStorage.setItem("agrios:tour_done", "true");
      localStorage.setItem("agrios:user", JSON.stringify(user));
    },
    [TEST_USER, lang],
  );
}

/* Boot to the in-app Home shell (splash is 350ms; the nav proves arrival). */
export async function bootToHome(page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Home" }).waitFor({ timeout: 15_000 });
}

/* Services tab -> Farm ledger screen. The card and the screen share the
   title text, so arrival is proven by the screen's own Export button. */
export async function openLedger(page) {
  await page.getByRole("tab", { name: "Services" }).click();
  await page.getByText("Farm ledger", { exact: true }).first().click();
  await page.getByRole("button", { name: "Export CSV" }).waitFor({ timeout: 15_000 });
}
