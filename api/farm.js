/* POST /api/farm — the entire Farm Space API, action-routed.

   One function, not one per resource. Vercel's Hobby plan allows 12 serverless
   functions and the other 11 are spoken for, so this is a hard constraint —
   but it is also the safer shape: the six-step authorization gate is applied
   here, once, to every action. A per-resource layout invites a handler added
   later that forgets a step, and that mistake is silent.

   Handlers live in api/_lib/farm/, which does not count against the function
   limit because only files directly under api/ become endpoints.

   Every action declares what it needs:
     permission  the Farm Space permission required (implies a space is needed)
     space:false actions that are not about one space (listing yours, invites
                 addressed to you) — these are still scoped by the caller's
                 identity, never open reads. */

import { getSql } from "./_lib/db.js";
import { HttpError } from "./_lib/http.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { authorize, requireUserRow } from "./_lib/farm/gate.js";
import { normalizeAgriosUserId } from "./_lib/agriosId.js";
import * as ops from "./_lib/farm/spaces.js";
import * as tasks from "./_lib/farm/tasks.js";
import * as ops4 from "./_lib/farm/operations.js";
import * as chat from "./_lib/farm/chat.js";
import * as dm from "./_lib/farm/dm.js";
import * as poultry from "./_lib/farm/poultry.js";
import * as poultryOps from "./_lib/farm/poultryOps.js";

/* Confirming who a User ID belongs to before sending an invitation. The id
   space (32^8, no clustering the way a phone number range has) makes blind
   guessing impractical on its own, but this is rate-limited anyway — the same
   defense-in-depth every other identity-adjacent endpoint in this app gets,
   not because a realistic attack is expected to work. */
async function lookupUser({ sql, user, payload }) {
  if (await rateLimit({ key: `farm:lookup:${user.id}`, max: 30, windowMs: 3_600_000 })) {
    throw new HttpError(429, "Too many lookups. Please try again in a while.");
  }
  const id = normalizeAgriosUserId(payload?.agriosUserId);
  if (!id) throw new HttpError(400, "Enter a valid AgriOS User ID");
  const found = await ops.lookupUserByAgriosId(sql, id);
  if (!found) throw new HttpError(404, "No AgriOS account has that User ID");
  return found;
}

/* The routing table IS the permission model as far as the network is
   concerned. Reading this list should tell you exactly what each action
   requires, without opening a handler. */
const ACTIONS = {
  /* --- not space-scoped: answered from the caller's own identity --- */
  "spaces.list":         { space: false, run: ({ sql, user }) => ops.listSpaces(sql, user.id) },
  "spaces.create":       { space: false, run: ({ sql, user, payload }) => ops.createSpace(sql, user.id, payload) },
  "invitations.mine":    { space: false, run: ({ sql, user }) => ops.listMyInvitations(sql, user) },
  "invitations.accept":  { space: false, run: ({ sql, user, payload }) => ops.acceptInvitation(sql, user, payload) },
  "invitations.decline": { space: false, run: ({ sql, user, payload }) => ops.declineInvitation(sql, user, payload) },
  /* Confirming a User ID before inviting — deliberately not space-scoped:
     the space-scoped permission check happens at members.invite, this step
     only answers "does this id belong to an account, and whose". */
  "users.lookup":        { space: false, run: lookupUser },

  /* --- space-scoped: gate runs all six steps before these are reached --- */
  "spaces.get":          { permission: "farm.view",             run: ({ membership }) => membership },
  "spaces.update":       { permission: "farm.settings.manage",  run: ({ sql, membership, user, payload }) => ops.updateSpace(sql, membership, user.id, payload) },
  "spaces.archive":      { permission: "farm.settings.manage",  run: ({ sql, membership, user }) => ops.archiveSpace(sql, membership, user.id) },
  /* Both re-check role === "owner" inside the handler: farm.settings.manage is
     owner-only today, but a custom-role override could grant it, and neither of
     these should ever be reachable by anyone but the owner. */
  "spaces.transfer":     { permission: "farm.settings.manage",  run: ({ sql, membership, user, payload }) => ops.transferOwnership(sql, membership, user.id, payload) },
  "spaces.delete":       { permission: "farm.settings.manage",  run: ({ sql, membership, user }) => ops.deleteSpace(sql, membership, user.id) },

  "members.list":        { permission: "farm.members.view",     run: ({ sql, membership }) => ops.listMembers(sql, membership) },
  "members.pendingInvites": { permission: "farm.members.manage", run: ({ sql, membership }) => ops.listSpaceInvitations(sql, membership) },
  "members.invite":      { permission: "farm.members.manage",   run: ({ sql, membership, user, payload }) => ops.createInvitation(sql, membership, user.id, payload) },
  "members.setRole":     { permission: "farm.members.manage",   run: ({ sql, membership, user, payload }) => ops.setMemberRole(sql, membership, user.id, payload) },
  "members.remove":      { permission: "farm.members.manage",   run: ({ sql, membership, user, payload }) => ops.removeMember(sql, membership, user.id, payload) },
  "members.leave":       { permission: "farm.view",             run: ({ sql, membership, user }) => ops.leaveSpace(sql, membership, user.id) },
  "invitations.cancel":  { permission: "farm.members.manage",   run: ({ sql, membership, user, payload }) => ops.cancelInvitation(sql, membership, user.id, payload) },

  "audit.list":          { permission: "farm.settings.manage",  run: ({ sql, membership, payload }) => ops.listAudit(sql, membership, payload) },

  /* Tasks. Note that view/update are granted to workers too — the ROWS they
     reach are narrowed inside the handler, which is where a "own" scope can be
     applied as a where clause rather than trusted to the client. */
  "tasks.list":          { permission: "farm.tasks.view",        run: ({ sql, membership, payload }) => tasks.listTasks(sql, membership, payload) },
  "tasks.get":           { permission: "farm.tasks.view",        run: ({ sql, membership, payload }) => tasks.getTask(sql, membership, payload) },
  "tasks.summary":       { permission: "farm.tasks.view",        run: ({ sql, membership }) => tasks.taskSummary(sql, membership) },
  "tasks.create":        { permission: "farm.tasks.create",      run: ({ sql, membership, user, payload }) => tasks.createTask(sql, membership, user.id, payload) },
  "tasks.update":        { permission: "farm.tasks.update",      run: ({ sql, membership, user, payload }) => tasks.updateTask(sql, membership, user.id, payload) },
  "tasks.setStatus":     { permission: "farm.tasks.update",      run: ({ sql, membership, user, payload }) => tasks.setTaskStatus(sql, membership, user.id, payload) },

  /* Attendance. view is granted to workers too; the rows they reach are their
     own, narrowed in the query rather than trusted to the client. Marking
     SOMEONE ELSE'S attendance is checked inside the handler, because a member
     may always mark their own without holding the manage permission. */
  "attendance.list":     { permission: "farm.attendance.view",   run: ({ sql, membership, payload }) => ops4.listAttendance(sql, membership, payload) },
  "attendance.summary":  { permission: "farm.attendance.view",   run: ({ sql, membership, payload }) => ops4.attendanceSummary(sql, membership, payload) },
  "attendance.mark":     { permission: "farm.attendance.view",   run: ({ sql, membership, user, payload }) => ops4.markAttendance(sql, membership, user.id, payload) },
  "attendance.checkOut": { permission: "farm.attendance.view",   run: ({ sql, membership, user, payload }) => ops4.checkOut(sql, membership, user.id, payload) },

  /* Announcements are read by every role — that is what they are for. */
  "announcements.list":   { permission: "farm.view",                  run: ({ sql, membership, payload }) => ops4.listAnnouncements(sql, membership, payload) },
  "announcements.create": { permission: "farm.announcement.create",   run: ({ sql, membership, user, payload }) => ops4.createAnnouncement(sql, membership, user.id, payload) },
  "announcements.remove": { permission: "farm.view",                  run: ({ sql, membership, user, payload }) => ops4.removeAnnouncement(sql, membership, user.id, payload) },

  "activity.list":        { permission: "farm.view",                  run: ({ sql, membership, payload }) => ops4.listActivity(sql, membership, payload) },

  /* Chat is the one area NOT narrowed by role: a channel where the workers
     cannot see each other would not be a conversation. Membership is the whole
     access rule. */
  "chat.list":            { permission: "farm.chat.view",  run: ({ sql, membership, payload }) => chat.listMessages(sql, membership, payload) },
  "chat.send":            { permission: "farm.chat.send",  run: ({ sql, membership, user, payload }) => chat.sendMessage(sql, membership, user.id, payload) },
  "chat.remove":          { permission: "farm.chat.view",  run: ({ sql, membership, user, payload }) => chat.removeMessage(sql, membership, user.id, payload) },
  "chat.hide":            { permission: "farm.chat.view",  run: ({ sql, membership, user, payload }) => chat.hideMessageForSelf(sql, membership, user.id, payload) },
  "chat.edit":            { permission: "farm.chat.send",  run: ({ sql, membership, user, payload }) => chat.editMessage(sql, membership, user.id, payload) },
  "chat.react":           { permission: "farm.chat.send",  run: ({ sql, membership, user, payload }) => chat.reactToMessage(sql, membership, user.id, payload) },
  "chat.unreact":         { permission: "farm.chat.send",  run: ({ sql, membership, user, payload }) => chat.removeReaction(sql, membership, user.id, payload) },
  /* Pin/unpin are the two chat actions gated at farm.members.manage rather
     than farm.chat.*: moderating what stays pinned in the channel is the
     same authority that already runs the roster, not a new tier. */
  "chat.pin":             { permission: "farm.members.manage", run: ({ sql, membership, user, payload }) => chat.pinMessage(sql, membership, user.id, payload) },
  "chat.unpin":           { permission: "farm.members.manage", run: ({ sql, membership, user, payload }) => chat.unpinMessage(sql, membership, user.id, payload) },
  "chat.pinned":          { permission: "farm.chat.view",  run: ({ sql, membership }) => chat.listPinnedMessages(sql, membership) },
  "chat.unread":          { permission: "farm.chat.view",  run: ({ sql, membership, payload }) => chat.unreadCount(sql, membership, payload) },
  "chat.search":          { permission: "farm.chat.view",  run: ({ sql, membership, payload }) => chat.searchMessages(sql, membership, payload) },

  /* 1:1 direct messages — a second, separate surface from the group channel
     above (see dm.js). Still gated by the chat permissions: a DM is Farm
     Space chat activity between two of its members, not a new tier. */
  "dm.conversations":     { permission: "farm.chat.view",  run: ({ sql, membership, user }) => dm.listConversations(sql, membership, user.id) },
  "dm.open":              { permission: "farm.chat.send",  run: ({ sql, membership, user, payload }) => dm.openConversation(sql, membership, user.id, payload) },
  "dm.list":              { permission: "farm.chat.view",  run: ({ sql, membership, user, payload }) => dm.listDmMessages(sql, membership, user.id, payload) },
  "dm.send":              { permission: "farm.chat.send",  run: ({ sql, membership, user, payload }) => dm.sendDm(sql, membership, user.id, payload) },
  "dm.edit":              { permission: "farm.chat.send",  run: ({ sql, membership, user, payload }) => dm.editDm(sql, membership, user.id, payload) },
  "dm.remove":            { permission: "farm.chat.view",  run: ({ sql, membership, user, payload }) => dm.removeDm(sql, membership, user.id, payload) },
  "dm.hide":              { permission: "farm.chat.view",  run: ({ sql, membership, user, payload }) => dm.hideDmForSelf(sql, membership, user.id, payload) },

  /* Poultry — Broiler Farm Management (P1: sheds + batches).

     Routed here rather than through a /api/poultry function because the
     project is at Vercel's 12-function limit — but it is also the safer shape:
     these inherit the same six-step gate as everything above, so a poultry
     handler cannot accidentally ship without authorization.

     Reads are farm.poultry.view (every role, including the worker who feeds
     the birds). Recording the day is farm.poultry.record. Creating batches and
     setting targets is farm.poultry.manage. Closing a cycle — which freezes
     the batch P&L — is farm.poultry.close, owner-only. */
  "poultry.sheds.list":     { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultry.listSheds(sql, membership, payload) },
  "poultry.sheds.create":   { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultry.createShed(sql, membership, user.id, payload) },
  "poultry.sheds.update":   { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultry.updateShed(sql, membership, user.id, payload) },
  "poultry.sheds.archive":  { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultry.archiveShed(sql, membership, user.id, payload) },

  "poultry.batches.list":   { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultry.listBatches(sql, membership, payload) },
  "poultry.batches.get":    { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultry.getBatch(sql, membership, payload) },
  "poultry.batches.create": { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultry.createBatch(sql, membership, user.id, payload) },
  "poultry.batches.update": { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultry.updateBatch(sql, membership, user.id, payload) },
  /* setStatus re-checks the per-transition permission inside the handler:
     the routing table's farm.poultry.manage is the floor, and closing/reversal
     demands farm.poultry.close on top of it. */
  "poultry.batches.setStatus": { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultry.setBatchStatus(sql, membership, user.id, payload) },
  "poultry.batches.delete": { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultry.deleteBatch(sql, membership, user.id, payload) },

  /* P2 — daily operations, weighings, feed ledger and the metrics derived from
     them. Recording the day is farm.poultry.record, which the worker who feeds
     the birds holds; removing a record is farm.poultry.manage, because a
     deletion changes history rather than adding to it. */
  "poultry.daily.list":     { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultryOps.listDaily(sql, membership, payload) },
  "poultry.daily.upsert":   { permission: "farm.poultry.record", run: ({ sql, membership, user, payload }) => poultryOps.upsertDaily(sql, membership, user.id, payload) },
  "poultry.daily.delete":   { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultryOps.deleteDaily(sql, membership, user.id, payload) },

  "poultry.weights.list":   { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultryOps.listWeights(sql, membership, payload) },
  "poultry.weights.add":    { permission: "farm.poultry.record", run: ({ sql, membership, user, payload }) => poultryOps.addWeight(sql, membership, user.id, payload) },
  "poultry.weights.delete": { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultryOps.deleteWeight(sql, membership, user.id, payload) },

  "poultry.feed.list":      { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultryOps.listFeed(sql, membership, payload) },
  "poultry.feed.add":       { permission: "farm.poultry.record", run: ({ sql, membership, user, payload }) => poultryOps.addFeedLog(sql, membership, user.id, payload) },
  "poultry.feed.delete":    { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultryOps.deleteFeedLog(sql, membership, user.id, payload) },

  /* One consistent snapshot per call — everything inside is read in a single
     transaction, so live birds and the FCR's bird count describe the same
     instant rather than two moments either side of someone else's write. */
  "poultry.metrics":        { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultryOps.batchMetrics(sql, membership, payload) },
  /* Validated inputs for the EXISTING farmAlertsService to consume later —
     facts and target comparisons, not a second alert engine. */
  "poultry.alerts.signals": { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultryOps.alertSignals(sql, membership, payload) },
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: { message: "POST only" } });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { action, spaceId, payload = {} } = body;

    const route = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
    if (!route) return res.status(400).json({ error: { message: "Unknown action" } });

    const sql = getSql();

    /* Steps 1-5. Actions marked space:false still authenticate — they are
       scoped to who the caller is, which is why they need no membership. */
    let user, membership = null;
    if (route.space === false) {
      user = await requireUserRow(req, sql);
    } else {
      ({ user, membership } = await authorize(req, sql, { spaceId, permission: route.permission }));
    }

    const data = await route.run({ sql, user, membership, payload });
    return res.status(200).json({ data });
  } catch (err) {
    /* Domain errors carry a status and a message written to be shown to a
       farmer. Everything else becomes a 500 with nothing leaked. */
    if (err instanceof HttpError) {
      /* `details` carries client-safe structured context (the feed quantity on
         hand, the birds available) so the UI can explain a refusal precisely.
         Present only when a handler supplied it. */
      return res.status(err.status).json({
        error: err.details ? { message: err.message, details: err.details } : { message: err.message },
      });
    }
    console.error("farm error:", err);
    if (/DATABASE_URL is not set/.test(err?.message || "")) {
      return res.status(503).json({ error: { message: "Farm Space is not configured — set DATABASE_URL." } });
    }
    return res.status(500).json({ error: { message: "Internal error" } });
  }
}
