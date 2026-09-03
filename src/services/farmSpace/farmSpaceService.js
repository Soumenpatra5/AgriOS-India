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
let _spacesPromise = null;  // in-flight spaces() request, so concurrent callers share one
let _invitations = null;
const _members = new Map();          // spaceId -> cached member list
const _membersPromise = new Map();   // spaceId -> in-flight members() request
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

  /* The spaces this user belongs to. `fresh` forces a real request rather than
     returning the cache; everything else reads the cache, because the hub,
     the picker and the Home card all want the same list within a second of
     each other.

     Concurrent callers — the hub and its own SwitchSpace child both ask for
     this on mount — share one in-flight request instead of each firing their
     own. A `fresh` call still joins a request that is already in flight
     rather than starting a second one: that request is real network traffic
     either way, so there is nothing "stale" about sharing it. */
  async spaces({ fresh = false } = {}) {
    if (_spaces && !fresh) return _spaces;
    if (_spacesPromise) return _spacesPromise;

    _spacesPromise = (async () => {
      try {
        _spaces = await farmSpaceApi.listSpaces();
        /* An active space that no longer appears — access revoked, or the
           space archived — must not stay selected, or the next screen opens
           onto a 404. */
        const active = storage.get(ACTIVE_KEY, null);
        if (active && !_spaces.some((s) => s.id === active)) this.setActive(null);
        notify();
        return _spaces;
      } finally {
        _spacesPromise = null;
      }
    })();
    return _spacesPromise;
  },

  /* The cached list, or null if nothing has been fetched yet — never triggers
     a request. For screens that want to paint instantly from whatever is
     already known, before confirming it against the server. */
  peekSpaces() { return _spaces; },

  /* Applied straight to the cache after a mutation whose response already
     carries the updated row, so the space that changed reflects it everywhere
     immediately without a round trip back to spaces.list to learn what the
     mutation itself just returned. */
  patchSpace(spaceId, patch) {
    if (!_spaces) return;
    _spaces = _spaces.map((s) => (s.id === spaceId ? { ...s, ...patch } : s));
    notify();
  },

  removeSpaceFromCache(spaceId) {
    if (!_spaces) return;
    _spaces = _spaces.filter((s) => s.id !== spaceId);
    notify();
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

  /* ── members ────────────────────────────────────────────────────────────── */

  /* The roster for one space, cached per space id. Team, the task-creation
     sheet, Attendance (for managers) and Settings all need the same list —
     before this, each fetched it independently on every mount, so switching
     between them re-downloaded the same rows repeatedly within one session.
     Mirrors spaces() exactly, in-flight dedupe included. */
  async members(spaceId, { fresh = false } = {}) {
    if (!fresh && _members.has(spaceId)) return _members.get(spaceId);
    if (_membersPromise.has(spaceId)) return _membersPromise.get(spaceId);

    const p = (async () => {
      try {
        const list = await farmSpaceApi.listMembers(spaceId);
        _members.set(spaceId, list);
        notify();
        return list;
      } finally {
        _membersPromise.delete(spaceId);
      }
    })();
    _membersPromise.set(spaceId, p);
    return p;
  },

  peekMembers(spaceId) { return _members.get(spaceId) || null; },

  /* A role change or removal is applied to the cache directly by the screen
     that made it — it already knows the new state and there is no reason to
     make every other screen re-download the roster to learn what this one
     just did. */
  patchMember(spaceId, userId, patch) {
    const list = _members.get(spaceId);
    if (!list) return;
    _members.set(spaceId, list.map((m) => (m.user_id === userId ? { ...m, ...patch } : m)));
    notify();
  },

  removeMemberFromCache(spaceId, userId) {
    const list = _members.get(spaceId);
    if (!list) return;
    _members.set(spaceId, list.filter((m) => m.user_id !== userId));
    notify();
  },

  invalidateMembers(spaceId) {
    _members.delete(spaceId);
    notify();
  },

  /* Invalidate everything — used on sign-out, so the next user does not see
     the previous one's farms. */
  reset() {
    _spaces = null; _invitations = null;
    _members.clear(); _membersPromise.clear();
    storage.remove(ACTIVE_KEY);
    notify();
  },
};

export { FARM_ERROR };
