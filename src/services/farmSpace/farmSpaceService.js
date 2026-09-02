/* Farm Space client state: which spaces you belong to, which one is open, and
   what the UI should offer inside it.

   The permission matrix is IMPORTED FROM THE SERVER (api/_lib/farm/
   permissions.js) rather than copied. It is pure and dependency-free, so both
   sides can use it, and a copy would eventually drift — at which point the app
   would offer buttons the server refuses, or hide ones it would allow. One
   matrix, two consumers.

   What the client decides here is only what to DRAW. Every one of these
   permissions is re-checked server-side on every request; hiding a button is a
   courtesy to the user, never the control. A caller who edits their membership
   object in devtools gets a nicer-looking menu and exactly the same 403s. */

import { storage } from "../../utils/storage.js";
import { farmSpaceApi, FARM_ERROR } from "./farmSpaceApi.js";
import { memberCan, ROLE_META, scopeForRole } from "../../../api/_lib/farm/permissions.js";

const ACTIVE_KEY = "farm:activeSpace";

let _spaces = null;      // cached list, null = not loaded
let _invitations = null;
const listeners = new Set();

/* Screens re-read through this rather than holding their own copy, so a change
   made on the members screen shows up on the hub without a manual refresh. */
export function onFarmSpaceChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() { listeners.forEach((fn) => { try { fn(); } catch { /* a bad listener must not break the rest */ } }); }

export const farmSpaceService = {
  /* ── membership ─────────────────────────────────────────────────────────── */

  /* The spaces this user belongs to. `fresh` forces a refetch; everything else
     reads the cache, because the hub, the picker and the Home card all want
     the same list within a second of each other. */
  async spaces({ fresh = false } = {}) {
    if (_spaces && !fresh) return _spaces;
    _spaces = await farmSpaceApi.listSpaces();
    /* An active space that no longer appears — access revoked, or the space
       archived — must not stay selected, or the next screen opens onto a 404. */
    const active = storage.get(ACTIVE_KEY, null);
    if (active && !_spaces.some((s) => s.id === active)) this.setActive(null);
    notify();
    return _spaces;
  },

  async invitations({ fresh = false } = {}) {
    if (_invitations && !fresh) return _invitations;
    _invitations = await farmSpaceApi.myInvitations();
    return _invitations;
  },

  async accept(invitationId) {
    const membership = await farmSpaceApi.acceptInvitation(invitationId);
    _spaces = null; _invitations = null;
    /* Land the user in the space they just joined — it is the only reason
       they tapped Accept. */
    this.setActive(membership.space_id);
    notify();
    return membership;
  },

  async decline(invitationId) {
    const out = await farmSpaceApi.declineInvitation(invitationId);
    _invitations = null;
    notify();
    return out;
  },

  async create(input) {
    const space = await farmSpaceApi.createSpace(input);
    _spaces = null;
    this.setActive(space.id);
    notify();
    return space;
  },

  /* ── the open space ─────────────────────────────────────────────────────── */

  activeId() { return storage.get(ACTIVE_KEY, null); },

  setActive(spaceId) {
    if (spaceId) storage.set(ACTIVE_KEY, spaceId);
    else storage.remove(ACTIVE_KEY);
    notify();
  },

  /* The active space, or the only one if there is exactly one — a farmer in a
     single space should never be asked to choose. */
  async active({ fresh = false } = {}) {
    const list = await this.spaces({ fresh });
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    const id = this.activeId();
    return list.find((s) => s.id === id) || null;
  },

  /* ── what to draw ───────────────────────────────────────────────────────── */

  /* A space row from spaces.list carries `role` and `permissions`, which is
     the shape memberCan expects — with status, since the list only ever
     returns active memberships. */
  can(space, permission) {
    if (!space) return false;
    return memberCan({ status: "active", role: space.role, permissions: space.permissions }, permission);
  },

  scope(space, resource) { return scopeForRole(space?.role, resource); },

  roleLabel(role) { return ROLE_META[role]?.label ?? { en: role, hi: role, bn: role }; },

  /* Invalidate everything — used on sign-out, so the next user does not see
     the previous one's farms. */
  reset() {
    _spaces = null; _invitations = null;
    storage.remove(ACTIVE_KEY);
    notify();
  },
};

export { FARM_ERROR };
