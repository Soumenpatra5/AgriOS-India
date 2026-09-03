/* Which tab a pushed screen belongs to.

   The bottom nav highlights a tab only while the stack is empty:

     const active = stack.length === 0 && tab === k;

   so pushing any screen de-highlights every tab. That is the app's existing
   behaviour and it is fine for most screens — a crop calculator opened from
   Services is not really "in" Services.

   Farm Space is different. It is a place with its own sections, and walking
   from its hub into Team or Tasks should not make the app look as though you
   left. This map names the screens that belong to a tab so the nav can keep
   that tab lit.

   Deliberately an allow-list, and deliberately small. Every kind not named
   here keeps the old behaviour exactly, so adding Farm Space changes nothing
   for Home, AI, Services or Profile. */

const OWNER_TAB = {
  farmSpace:              "farmSpace",
  farmSpacePicker:        "farmSpace",
  farmSpaceCreate:        "farmSpace",
  farmSpaceInvites:       "farmSpace",
  farmSpaceTeam:          "farmSpace",
  farmSpaceTasks:         "farmSpace",
  farmSpaceAttendance:    "farmSpace",
  farmSpaceAnnouncements: "farmSpace",
  farmSpaceActivity:      "farmSpace",
  farmSpaceChat:          "farmSpace",
  farmSpaceSettings:      "farmSpace",
};

/* The tab a screen belongs to, or null when it belongs to none — which is the
   answer for almost every screen in the app. */
export function ownerTabOf(kind) {
  return Object.prototype.hasOwnProperty.call(OWNER_TAB, kind) ? OWNER_TAB[kind] : null;
}

/* Which tab the nav should show as active, given the whole navigation state.
   Pure, so the rule is testable without rendering anything. */
export function activeTab({ tab, stack }) {
  const top = stack?.[stack.length - 1];
  if (!top) return tab;                 // on a tab root: the tab itself
  return ownerTabOf(top.kind);          // pushed: its owning tab, or null
}
