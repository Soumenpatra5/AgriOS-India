/* Pure decision logic for the hardware/browser Back button, kept out of AppStore
   so it can be unit-tested without a DOM. AppStore wires these to the History
   API (see the "Back integration" effects there). */

/* How many Back steps deep the app currently is (0 = nothing to go back to).
   Only the authenticated app is tracked — the linear splash → language →
   onboarding → auth flow is not. A non-home tab counts as one step above Home. */
export function backDepth({ stage, tab, stack } = {}) {
  if (stage !== "app") return 0;
  const pushed = Array.isArray(stack) ? stack.length : 0;
  return pushed + (tab && tab !== "home" ? 1 : 0);
}

/* What a Back press should do given the current nav:
   - "pop"  : close the top pushed screen
   - "home" : return to the Home tab (from another tab)
   - "exit" : nothing to intercept — let the browser leave the app */
export function resolveBack({ stack, tab } = {}) {
  if (Array.isArray(stack) && stack.length) return "pop";
  if (tab && tab !== "home") return "home";
  return "exit";
}
