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
import * as poultryHealth from "./_lib/farm/poultryHealth.js";
import * as poultryFinance from "./_lib/farm/poultryFinance.js";
import * as wf from "./_lib/farm/poultryWorkflow.js";
import * as dairy from "./_lib/farm/dairy.js";
import * as dairyOps from "./_lib/farm/dairyOps.js";
import * as dairyFinance from "./_lib/farm/dairyFinance.js";
import * as goat from "./_lib/farm/goat.js";
import * as goatOps from "./_lib/farm/goatOps.js";
import * as pig from "./_lib/farm/pig.js";
import * as pigOps from "./_lib/farm/pigOps.js";
import * as fish from "./_lib/farm/fish.js";
import * as fishOps from "./_lib/farm/fishOps.js";
import * as bee from "./_lib/farm/bee.js";
import * as beeOps from "./_lib/farm/beeOps.js";
import * as crop from "./_lib/farm/crop.js";
import * as cropOps from "./_lib/farm/cropOps.js";
import * as analytics from "./_lib/farm/analytics.js";
import * as notifs from "./_lib/farm/notifications.js";

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
  "spaces.modules.get":  { permission: "farm.view",             run: ({ sql, membership }) => ops.getModules(sql, membership) },
  "spaces.modules.update": { permission: "farm.settings.manage", run: ({ sql, membership, user, payload }) => ops.updateModules(sql, membership, user.id, payload) },
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

  "poultry.health.list":         { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultryHealth.listHealth(sql, membership, payload) },
  /* poultry.health.add: adds the P4 row, then non-fatally auto-creates a
     follow-up chain for treatment, outbreak, and urgent-observation events.
     severity is NOT stored in poultry_health_events (confirmed in 0015) so it
     is forwarded here from the caller's payload. P4 row is always returned;
     chain creation failure is logged but does not fail the action. */
  "poultry.health.add": {
    permission: "farm.poultry.record",
    run: async ({ sql, membership, user, payload }) => {
      const row = await poultryHealth.addHealth(sql, membership, user.id, payload);
      await wf
        .maybeCreateFollowupFromHealthEvent(
          sql, membership, user.id, row, payload.severity ?? null,
        )
        .catch((e) => console.error("auto-followup (health):", e.message));
      return row;
    },
  },
  "poultry.health.delete":       { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultryHealth.deleteHealth(sql, membership, user.id, payload) },
  "poultry.vaccinations.list":   { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultryHealth.listVaccinations(sql, membership, payload) },
  /* poultry.vaccinations.add: adds the P4 row, then non-fatally auto-creates
     a post-vaccination follow-up chain. Default interval is 7 days; the caller
     may override via payload.followup_days (any integer 1-365). Vaccination row
     is always returned regardless of chain creation outcome. */
  "poultry.vaccinations.add": {
    permission: "farm.poultry.record",
    run: async ({ sql, membership, user, payload }) => {
      const row = await poultryHealth.addVaccination(sql, membership, user.id, payload);
      const followupDays = wf.vaccinationFollowupDays(payload.followup_days);
      await wf
        .maybeCreateFollowupFromVaccination(sql, membership, user.id, row, followupDays)
        .catch((e) => console.error("auto-followup (vaccination):", e.message));
      return row;
    },
  },
  "poultry.vaccinations.delete": { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultryHealth.deleteVaccination(sql, membership, user.id, payload) },

  /* P5 — Workflow Engine (Phase A).
     Generates daily task lists, tracks follow-up chains, records guided
     incident responses, and produces a daily operational summary.

     Reads (today, timeline, summary, list) are farm.poultry.view.
     Recording / completing tasks is farm.poultry.record (same as P2).
     Skipping tasks, resolving incidents, cancelling chains — and anything
     that modifies historical records or closes follow-up chains — requires
     farm.poultry.manage. */

  /* Workflow — task generation and management. */
  "poultry.workflow.today":    { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => wf.generateTodaysTasks(sql, membership, payload) },
  "poultry.workflow.complete": { permission: "farm.poultry.record", run: ({ sql, membership, user, payload }) => wf.markTaskComplete(sql, membership, user.id, payload) },
  "poultry.workflow.skip":     { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => wf.skipTask(sql, membership, user.id, payload) },
  "poultry.workflow.timeline": { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => wf.buildTimeline(sql, membership, payload) },
  "poultry.summary.daily":     { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => wf.generateDailySummary(sql, membership, payload) },

  /* Incidents — report, list, resolve. */
  "poultry.incident.report":   { permission: "farm.poultry.record", run: ({ sql, membership, user, payload }) => wf.reportIncident(sql, membership, user.id, payload) },
  "poultry.incident.list":     { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => wf.listIncidents(sql, membership, payload) },
  "poultry.incident.resolve":  { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => wf.resolveIncident(sql, membership, user.id, payload) },

  /* Templates — read-only in Phase A; mutation via direct DB in Phase B+. */
  "poultry.template.list":     { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => wf.listTemplates(sql, membership, payload) },

  /* Follow-up chains. */
  "poultry.followup.create":         { permission: "farm.poultry.record", run: ({ sql, membership, user, payload }) => wf.createFollowupChain(sql, membership, user.id, payload) },
  "poultry.followup.record_outcome": { permission: "farm.poultry.record", run: ({ sql, membership, user, payload }) => wf.recordFollowupOutcome(sql, membership, user.id, payload) },
  "poultry.followup.chain_detail":   { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => wf.getChainDetail(sql, membership, payload) },
  "poultry.followup.cancel":         { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => wf.cancelChain(sql, membership, user.id, payload) },

  /* P6 — Finance: Sales & Costs.
     Reads are farm.poultry.view (every role).
     Recording costs is farm.poultry.record (worker can log labour/electricity).
     Adding and deleting sales, and deleting costs, require farm.poultry.manage
     because a sale changes the live-bird count and historical P&L. */
  "poultry.sales.list":       { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultryFinance.listSales(sql, membership, payload) },
  "poultry.sales.add":        { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultryFinance.addSale(sql, membership, user.id, payload) },
  "poultry.sales.delete":     { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultryFinance.deleteSale(sql, membership, user.id, payload) },
  "poultry.costs.list":       { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultryFinance.listCosts(sql, membership, payload) },
  "poultry.costs.add":        { permission: "farm.poultry.record", run: ({ sql, membership, user, payload }) => poultryFinance.addCost(sql, membership, user.id, payload) },
  "poultry.costs.delete":     { permission: "farm.poultry.manage", run: ({ sql, membership, user, payload }) => poultryFinance.deleteCost(sql, membership, user.id, payload) },
  "poultry.finance.summary":  { permission: "farm.poultry.view",   run: ({ sql, membership, payload }) => poultryFinance.financeSummary(sql, membership, payload) },

  /* Dairy — Individual Animal Management (D1: foundation).
   *
   * Canonical identity: animal_id, NOT batch_id. Every table hangs off
   * dairy_animals for the animal's entire life. Four permission tiers:
   *   farm.dairy.view    — everyone can read the herd
   *   farm.dairy.record  — worker/supervisor can record milk, health, events
   *   farm.dairy.manage  — manager can create/update animals, lactations
   *   farm.dairy.finance — manager can access sales, costs, finance summary
   * No close permission: dairy has no batch-cycle concept to freeze. */

  /* Animals — individual animal registry */
  "dairy.animals.list":       { permission: "farm.dairy.view",    run: ({ sql, membership, payload }) => dairy.listAnimals(sql, membership, payload) },
  "dairy.animals.get":        { permission: "farm.dairy.view",    run: ({ sql, membership, payload }) => dairy.getAnimal(sql, membership, payload) },
  "dairy.animals.create":     { permission: "farm.dairy.manage",  run: ({ sql, membership, user, payload }) => dairy.createAnimal(sql, membership, user.id, payload) },
  "dairy.animals.update":     { permission: "farm.dairy.manage",  run: ({ sql, membership, user, payload }) => dairy.updateAnimal(sql, membership, user.id, payload) },
  "dairy.animals.setStatus":  { permission: "farm.dairy.manage",  run: ({ sql, membership, user, payload }) => dairy.setAnimalStatus(sql, membership, user.id, payload) },

  /* Lactations — calving and lactation cycle history */
  "dairy.lactations.list":    { permission: "farm.dairy.view",    run: ({ sql, membership, payload }) => dairy.listLactations(sql, membership, payload) },
  "dairy.lactations.add":     { permission: "farm.dairy.manage",  run: ({ sql, membership, user, payload }) => dairy.addLactation(sql, membership, user.id, payload) },
  "dairy.lactations.update":  { permission: "farm.dairy.manage",  run: ({ sql, membership, user, payload }) => dairy.updateLactation(sql, membership, user.id, payload) },

  /* Herd metrics — dashboard summary */
  "dairy.metrics":            { permission: "farm.dairy.view",    run: ({ sql, membership }) => dairy.herdMetrics(sql, membership) },

  /* Animal history — full timeline for one animal */
  "dairy.animal.history":     { permission: "farm.dairy.view",    run: ({ sql, membership, payload }) => dairy.animalHistory(sql, membership, payload) },

  /* Milk records — daily AM/PM recording.
     dairy.milk.delete is farm.dairy.record (not farm.dairy.manage) by design:
     the milkman who entered the record corrects their own entry. This differs
     from poultry.daily.delete (farm.poultry.manage), where a separate recorder
     and a supervisor control deletion. Dairy milking is typically one person;
     forcing them to escalate a correction to a manager adds friction without
     meaningful safety, since the scope check still confines deletion to the
     caller's own farm space. */
  "dairy.milk.list":          { permission: "farm.dairy.view",    run: ({ sql, membership, payload }) => dairyOps.listMilk(sql, membership, payload) },
  "dairy.milk.upsert":        { permission: "farm.dairy.record",  run: ({ sql, membership, user, payload }) => dairyOps.upsertMilk(sql, membership, user.id, payload) },
  "dairy.milk.delete":        { permission: "farm.dairy.record",  run: ({ sql, membership, user, payload }) => dairyOps.deleteMilk(sql, membership, user.id, payload) },

  /* Reproductive events — heat, AI, pregnancy check, calving */
  "dairy.repro.list":         { permission: "farm.dairy.view",    run: ({ sql, membership, payload }) => dairyOps.listRepro(sql, membership, payload) },
  "dairy.repro.add":          { permission: "farm.dairy.record",  run: ({ sql, membership, user, payload }) => dairyOps.addRepro(sql, membership, user.id, payload) },
  "dairy.repro.update":       { permission: "farm.dairy.record",  run: ({ sql, membership, user, payload }) => dairyOps.updateRepro(sql, membership, user.id, payload) },
  "dairy.repro.delete":       { permission: "farm.dairy.record",  run: ({ sql, membership, user, payload }) => dairyOps.deleteRepro(sql, membership, user.id, payload) },

  /* Health events — vaccination, treatment, deworming, vet visit */
  "dairy.health.list":        { permission: "farm.dairy.view",    run: ({ sql, membership, payload }) => dairyOps.listHealth(sql, membership, payload) },
  "dairy.health.add":         { permission: "farm.dairy.record",  run: ({ sql, membership, user, payload }) => dairyOps.addHealth(sql, membership, user.id, payload) },
  "dairy.health.update":      { permission: "farm.dairy.record",  run: ({ sql, membership, user, payload }) => dairyOps.updateHealth(sql, membership, user.id, payload) },
  "dairy.health.delete":      { permission: "farm.dairy.record",  run: ({ sql, membership, user, payload }) => dairyOps.deleteHealth(sql, membership, user.id, payload) },

  /* Feed records — operational per-animal feed tracking (not finance) */
  "dairy.feed.list":          { permission: "farm.dairy.view",    run: ({ sql, membership, payload }) => dairyOps.listFeed(sql, membership, payload) },
  "dairy.feed.add":           { permission: "farm.dairy.record",  run: ({ sql, membership, user, payload }) => dairyOps.addFeed(sql, membership, user.id, payload) },
  "dairy.feed.update":        { permission: "farm.dairy.record",  run: ({ sql, membership, user, payload }) => dairyOps.updateFeed(sql, membership, user.id, payload) },
  "dairy.feed.delete":        { permission: "farm.dairy.record",  run: ({ sql, membership, user, payload }) => dairyOps.deleteFeed(sql, membership, user.id, payload) },

  /* Milk sales — farm-level cooperative/buyer sales (no animal_id) */
  "dairy.sales.list":         { permission: "farm.dairy.finance", run: ({ sql, membership, payload }) => dairyFinance.listSales(sql, membership, payload) },
  "dairy.sales.add":          { permission: "farm.dairy.finance", run: ({ sql, membership, user, payload }) => dairyFinance.addSale(sql, membership, user.id, payload) },
  "dairy.sales.delete":       { permission: "farm.dairy.finance", run: ({ sql, membership, user, payload }) => dairyFinance.deleteSale(sql, membership, user.id, payload) },

  /* Operating costs — feed, medicine, labour, AI, equipment, veterinary */
  "dairy.costs.list":         { permission: "farm.dairy.finance", run: ({ sql, membership, payload }) => dairyFinance.listCosts(sql, membership, payload) },
  "dairy.costs.add":          { permission: "farm.dairy.finance", run: ({ sql, membership, user, payload }) => dairyFinance.addCost(sql, membership, user.id, payload) },
  "dairy.costs.delete":       { permission: "farm.dairy.finance", run: ({ sql, membership, user, payload }) => dairyFinance.deleteCost(sql, membership, user.id, payload) },

  /* Finance summary — month-to-date P&L in one consistent snapshot */
  "dairy.finance.summary":    { permission: "farm.dairy.finance", run: ({ sql, membership, payload }) => dairyFinance.financeSummary(sql, membership, payload) },

  /* ── Goat / Small Ruminant module ─────────────────────────────────────────
   *   farm.goat.view    — everyone can read the flock
   *   farm.goat.record  — worker/supervisor records milk, weight, health, events
   *   farm.goat.manage  — manager creates/updates animals
   *   farm.goat.finance — manager accesses sales, costs, finance summary */

  /* Animals */
  "goat.animals.list":      { permission: "farm.goat.view",    run: ({ sql, membership, payload }) => goat.listAnimals(sql, membership, payload) },
  "goat.animals.get":       { permission: "farm.goat.view",    run: ({ sql, membership, payload }) => goat.getAnimal(sql, membership, payload) },
  "goat.animals.create":    { permission: "farm.goat.manage",  run: ({ sql, membership, user, payload }) => goat.createAnimal(sql, membership, user.id, payload) },
  "goat.animals.update":    { permission: "farm.goat.manage",  run: ({ sql, membership, user, payload }) => goat.updateAnimal(sql, membership, user.id, payload) },
  "goat.animals.setStatus": { permission: "farm.goat.manage",  run: ({ sql, membership, user, payload }) => goat.setAnimalStatus(sql, membership, user.id, payload) },

  /* Herd metrics */
  "goat.metrics":           { permission: "farm.goat.view",    run: ({ sql, membership }) => goat.herdMetrics(sql, membership) },

  /* Animal history */
  "goat.animal.history":    { permission: "farm.goat.view",    run: ({ sql, membership, payload }) => goat.animalHistory(sql, membership, payload) },

  /* Milk records */
  "goat.milk.list":         { permission: "farm.goat.view",    run: ({ sql, membership, payload }) => goatOps.listMilk(sql, membership, payload) },
  "goat.milk.upsert":       { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.upsertMilk(sql, membership, user.id, payload) },
  "goat.milk.delete":       { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.deleteMilk(sql, membership, user.id, payload) },

  /* Weight records */
  "goat.weight.list":       { permission: "farm.goat.view",    run: ({ sql, membership, payload }) => goatOps.listWeight(sql, membership, payload) },
  "goat.weight.add":        { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.addWeight(sql, membership, user.id, payload) },
  "goat.weight.delete":     { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.deleteWeight(sql, membership, user.id, payload) },

  /* Reproductive events */
  "goat.repro.list":        { permission: "farm.goat.view",    run: ({ sql, membership, payload }) => goatOps.listRepro(sql, membership, payload) },
  "goat.repro.add":         { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.addRepro(sql, membership, user.id, payload) },
  "goat.repro.update":      { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.updateRepro(sql, membership, user.id, payload) },
  "goat.repro.delete":      { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.deleteRepro(sql, membership, user.id, payload) },

  /* Health events */
  "goat.health.list":       { permission: "farm.goat.view",    run: ({ sql, membership, payload }) => goatOps.listHealth(sql, membership, payload) },
  "goat.health.add":        { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.addHealth(sql, membership, user.id, payload) },
  "goat.health.update":     { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.updateHealth(sql, membership, user.id, payload) },
  "goat.health.delete":     { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.deleteHealth(sql, membership, user.id, payload) },

  /* Feed records */
  "goat.feed.list":         { permission: "farm.goat.view",    run: ({ sql, membership, payload }) => goatOps.listFeed(sql, membership, payload) },
  "goat.feed.add":          { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.addFeed(sql, membership, user.id, payload) },
  "goat.feed.update":       { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.updateFeed(sql, membership, user.id, payload) },
  "goat.feed.delete":       { permission: "farm.goat.record",  run: ({ sql, membership, user, payload }) => goatOps.deleteFeed(sql, membership, user.id, payload) },

  /* Sales */
  "goat.sales.list":        { permission: "farm.goat.finance", run: ({ sql, membership, payload }) => goatOps.listSales(sql, membership, payload) },
  "goat.sales.add":         { permission: "farm.goat.finance", run: ({ sql, membership, user, payload }) => goatOps.addSale(sql, membership, user.id, payload) },
  "goat.sales.delete":      { permission: "farm.goat.finance", run: ({ sql, membership, user, payload }) => goatOps.deleteSale(sql, membership, user.id, payload) },

  /* Costs */
  "goat.costs.list":        { permission: "farm.goat.finance", run: ({ sql, membership, payload }) => goatOps.listCosts(sql, membership, payload) },
  "goat.costs.add":         { permission: "farm.goat.finance", run: ({ sql, membership, user, payload }) => goatOps.addCost(sql, membership, user.id, payload) },
  "goat.costs.delete":      { permission: "farm.goat.finance", run: ({ sql, membership, user, payload }) => goatOps.deleteCost(sql, membership, user.id, payload) },

  /* Finance summary */
  "goat.finance.summary":   { permission: "farm.goat.finance", run: ({ sql, membership, payload }) => goatOps.financeSummary(sql, membership, payload) },

  /* ── Pig / Swine module ────────────────────────────────────────────────────
   *   farm.pig.view    — everyone can read the herd
   *   farm.pig.record  — worker/supervisor records weight, health, events
   *   farm.pig.manage  — manager creates/updates animals
   *   farm.pig.finance — manager accesses sales, costs, finance summary */

  /* Animals */
  "pig.animals.list":      { permission: "farm.pig.view",    run: ({ sql, membership, payload }) => pig.listAnimals(sql, membership, payload) },
  "pig.animals.get":       { permission: "farm.pig.view",    run: ({ sql, membership, payload }) => pig.getAnimal(sql, membership, payload) },
  "pig.animals.create":    { permission: "farm.pig.manage",  run: ({ sql, membership, user, payload }) => pig.createAnimal(sql, membership, user.id, payload) },
  "pig.animals.update":    { permission: "farm.pig.manage",  run: ({ sql, membership, user, payload }) => pig.updateAnimal(sql, membership, user.id, payload) },
  "pig.animals.setStatus": { permission: "farm.pig.manage",  run: ({ sql, membership, user, payload }) => pig.setAnimalStatus(sql, membership, user.id, payload) },

  /* Herd metrics */
  "pig.metrics":           { permission: "farm.pig.view",    run: ({ sql, membership }) => pig.herdMetrics(sql, membership) },

  /* Animal history */
  "pig.animal.history":    { permission: "farm.pig.view",    run: ({ sql, membership, payload }) => pig.animalHistory(sql, membership, payload) },

  /* Weight records */
  "pig.weight.list":       { permission: "farm.pig.view",    run: ({ sql, membership, payload }) => pigOps.listWeight(sql, membership, payload) },
  "pig.weight.add":        { permission: "farm.pig.record",  run: ({ sql, membership, user, payload }) => pigOps.addWeight(sql, membership, user.id, payload) },
  "pig.weight.delete":     { permission: "farm.pig.record",  run: ({ sql, membership, user, payload }) => pigOps.deleteWeight(sql, membership, user.id, payload) },

  /* Reproductive events */
  "pig.repro.list":        { permission: "farm.pig.view",    run: ({ sql, membership, payload }) => pigOps.listRepro(sql, membership, payload) },
  "pig.repro.add":         { permission: "farm.pig.record",  run: ({ sql, membership, user, payload }) => pigOps.addRepro(sql, membership, user.id, payload) },
  "pig.repro.update":      { permission: "farm.pig.record",  run: ({ sql, membership, user, payload }) => pigOps.updateRepro(sql, membership, user.id, payload) },
  "pig.repro.delete":      { permission: "farm.pig.record",  run: ({ sql, membership, user, payload }) => pigOps.deleteRepro(sql, membership, user.id, payload) },

  /* Health events */
  "pig.health.list":       { permission: "farm.pig.view",    run: ({ sql, membership, payload }) => pigOps.listHealth(sql, membership, payload) },
  "pig.health.add":        { permission: "farm.pig.record",  run: ({ sql, membership, user, payload }) => pigOps.addHealth(sql, membership, user.id, payload) },
  "pig.health.update":     { permission: "farm.pig.record",  run: ({ sql, membership, user, payload }) => pigOps.updateHealth(sql, membership, user.id, payload) },
  "pig.health.delete":     { permission: "farm.pig.record",  run: ({ sql, membership, user, payload }) => pigOps.deleteHealth(sql, membership, user.id, payload) },

  /* Feed records */
  "pig.feed.list":         { permission: "farm.pig.view",    run: ({ sql, membership, payload }) => pigOps.listFeed(sql, membership, payload) },
  "pig.feed.add":          { permission: "farm.pig.record",  run: ({ sql, membership, user, payload }) => pigOps.addFeed(sql, membership, user.id, payload) },
  "pig.feed.update":       { permission: "farm.pig.record",  run: ({ sql, membership, user, payload }) => pigOps.updateFeed(sql, membership, user.id, payload) },
  "pig.feed.delete":       { permission: "farm.pig.record",  run: ({ sql, membership, user, payload }) => pigOps.deleteFeed(sql, membership, user.id, payload) },

  /* Sales */
  "pig.sales.list":        { permission: "farm.pig.finance", run: ({ sql, membership, payload }) => pigOps.listSales(sql, membership, payload) },
  "pig.sales.add":         { permission: "farm.pig.finance", run: ({ sql, membership, user, payload }) => pigOps.addSale(sql, membership, user.id, payload) },
  "pig.sales.delete":      { permission: "farm.pig.finance", run: ({ sql, membership, user, payload }) => pigOps.deleteSale(sql, membership, user.id, payload) },

  /* Costs */
  "pig.costs.list":        { permission: "farm.pig.finance", run: ({ sql, membership, payload }) => pigOps.listCosts(sql, membership, payload) },
  "pig.costs.add":         { permission: "farm.pig.finance", run: ({ sql, membership, user, payload }) => pigOps.addCost(sql, membership, user.id, payload) },
  "pig.costs.delete":      { permission: "farm.pig.finance", run: ({ sql, membership, user, payload }) => pigOps.deleteCost(sql, membership, user.id, payload) },

  /* Finance summary */
  "pig.finance.summary":   { permission: "farm.pig.finance", run: ({ sql, membership, payload }) => pigOps.financeSummary(sql, membership, payload) },

  /* ── Fish / Aquaculture module ────────────────────────────────────────────
   *   farm.fish.view    — everyone can read the ponds
   *   farm.fish.record  — worker/supervisor records feed, water quality, events
   *   farm.fish.manage  — manager creates/updates ponds
   *   farm.fish.finance — manager accesses sales, costs, finance summary */

  /* Ponds */
  "fish.ponds.list":       { permission: "farm.fish.view",    run: ({ sql, membership, payload }) => fish.listPonds(sql, membership, payload) },
  "fish.ponds.get":        { permission: "farm.fish.view",    run: ({ sql, membership, payload }) => fish.getPond(sql, membership, payload) },
  "fish.ponds.create":     { permission: "farm.fish.manage",  run: ({ sql, membership, user, payload }) => fish.createPond(sql, membership, user.id, payload) },
  "fish.ponds.update":     { permission: "farm.fish.manage",  run: ({ sql, membership, user, payload }) => fish.updatePond(sql, membership, user.id, payload) },
  "fish.ponds.setStatus":  { permission: "farm.fish.manage",  run: ({ sql, membership, user, payload }) => fish.setPondStatus(sql, membership, user.id, payload) },

  /* Pond metrics */
  "fish.metrics":          { permission: "farm.fish.view",    run: ({ sql, membership }) => fish.pondMetrics(sql, membership) },

  /* Pond history */
  "fish.pond.history":     { permission: "farm.fish.view",    run: ({ sql, membership, payload }) => fish.pondHistory(sql, membership, payload) },

  /* Water quality */
  "fish.water.list":       { permission: "farm.fish.view",    run: ({ sql, membership, payload }) => fishOps.listWater(sql, membership, payload) },
  "fish.water.add":        { permission: "farm.fish.record",  run: ({ sql, membership, user, payload }) => fishOps.addWater(sql, membership, user.id, payload) },
  "fish.water.delete":     { permission: "farm.fish.record",  run: ({ sql, membership, user, payload }) => fishOps.deleteWater(sql, membership, user.id, payload) },

  /* Feed records */
  "fish.feed.list":        { permission: "farm.fish.view",    run: ({ sql, membership, payload }) => fishOps.listFeed(sql, membership, payload) },
  "fish.feed.add":         { permission: "farm.fish.record",  run: ({ sql, membership, user, payload }) => fishOps.addFeed(sql, membership, user.id, payload) },
  "fish.feed.delete":      { permission: "farm.fish.record",  run: ({ sql, membership, user, payload }) => fishOps.deleteFeed(sql, membership, user.id, payload) },

  /* Health events */
  "fish.health.list":      { permission: "farm.fish.view",    run: ({ sql, membership, payload }) => fishOps.listHealth(sql, membership, payload) },
  "fish.health.add":       { permission: "farm.fish.record",  run: ({ sql, membership, user, payload }) => fishOps.addHealth(sql, membership, user.id, payload) },
  "fish.health.update":    { permission: "farm.fish.record",  run: ({ sql, membership, user, payload }) => fishOps.updateHealth(sql, membership, user.id, payload) },
  "fish.health.delete":    { permission: "farm.fish.record",  run: ({ sql, membership, user, payload }) => fishOps.deleteHealth(sql, membership, user.id, payload) },

  /* Mortality records */
  "fish.mortality.list":   { permission: "farm.fish.view",    run: ({ sql, membership, payload }) => fishOps.listMortality(sql, membership, payload) },
  "fish.mortality.add":    { permission: "farm.fish.record",  run: ({ sql, membership, user, payload }) => fishOps.addMortality(sql, membership, user.id, payload) },
  "fish.mortality.delete": { permission: "farm.fish.record",  run: ({ sql, membership, user, payload }) => fishOps.deleteMortality(sql, membership, user.id, payload) },

  /* Harvest records */
  "fish.harvest.list":     { permission: "farm.fish.view",    run: ({ sql, membership, payload }) => fishOps.listHarvest(sql, membership, payload) },
  "fish.harvest.add":      { permission: "farm.fish.record",  run: ({ sql, membership, user, payload }) => fishOps.addHarvest(sql, membership, user.id, payload) },
  "fish.harvest.delete":   { permission: "farm.fish.record",  run: ({ sql, membership, user, payload }) => fishOps.deleteHarvest(sql, membership, user.id, payload) },

  /* Sales */
  "fish.sales.list":       { permission: "farm.fish.finance", run: ({ sql, membership, payload }) => fishOps.listSales(sql, membership, payload) },
  "fish.sales.add":        { permission: "farm.fish.finance", run: ({ sql, membership, user, payload }) => fishOps.addSale(sql, membership, user.id, payload) },
  "fish.sales.delete":     { permission: "farm.fish.finance", run: ({ sql, membership, user, payload }) => fishOps.deleteSale(sql, membership, user.id, payload) },

  /* Costs */
  "fish.costs.list":       { permission: "farm.fish.finance", run: ({ sql, membership, payload }) => fishOps.listCosts(sql, membership, payload) },
  "fish.costs.add":        { permission: "farm.fish.finance", run: ({ sql, membership, user, payload }) => fishOps.addCost(sql, membership, user.id, payload) },
  "fish.costs.delete":     { permission: "farm.fish.finance", run: ({ sql, membership, user, payload }) => fishOps.deleteCost(sql, membership, user.id, payload) },

  /* Finance summary */
  "fish.finance.summary":  { permission: "farm.fish.finance", run: ({ sql, membership, payload }) => fishOps.financeSummary(sql, membership, payload) },

  /* ── Bee / Apiculture module ──────────────────────────────────────────────
   *   farm.bee.view    — everyone can read apiaries and hives
   *   farm.bee.record  — worker/supervisor records inspections, harvests, treatments
   *   farm.bee.manage  — manager creates/updates hives and apiaries
   *   farm.bee.finance — manager accesses sales, costs, finance summary */

  /* Apiaries */
  "bee.apiaries.list":   { permission: "farm.bee.view",    run: ({ sql, membership })                  => bee.listApiaries(sql, membership) },
  "bee.apiaries.create": { permission: "farm.bee.manage",  run: ({ sql, membership, user, payload })   => bee.createApiary(sql, membership, user.id, payload) },
  "bee.apiaries.delete": { permission: "farm.bee.manage",  run: ({ sql, membership, user, payload })   => bee.deleteApiary(sql, membership, user.id, payload) },

  /* Hives */
  "bee.hives.list":      { permission: "farm.bee.view",    run: ({ sql, membership, payload })          => bee.listHives(sql, membership, payload) },
  "bee.hives.get":       { permission: "farm.bee.view",    run: ({ sql, membership, payload })          => bee.getHive(sql, membership, payload) },
  "bee.hives.create":    { permission: "farm.bee.manage",  run: ({ sql, membership, user, payload })    => bee.createHive(sql, membership, user.id, payload) },
  "bee.hives.update":    { permission: "farm.bee.manage",  run: ({ sql, membership, user, payload })    => bee.updateHive(sql, membership, user.id, payload) },
  "bee.hives.setStatus": { permission: "farm.bee.manage",  run: ({ sql, membership, user, payload })    => bee.setHiveStatus(sql, membership, user.id, payload) },

  /* Hive metrics + history */
  "bee.metrics":         { permission: "farm.bee.view",    run: ({ sql, membership })                   => bee.hiveMetrics(sql, membership) },
  "bee.hive.history":    { permission: "farm.bee.view",    run: ({ sql, membership, payload })          => bee.hiveHistory(sql, membership, payload) },

  /* Inspections */
  "bee.inspections.list":   { permission: "farm.bee.view",    run: ({ sql, membership, payload })       => bee.listInspections(sql, membership, payload) },
  "bee.inspections.add":    { permission: "farm.bee.record",  run: ({ sql, membership, user, payload }) => bee.addInspection(sql, membership, user.id, payload) },
  "bee.inspections.delete": { permission: "farm.bee.manage",  run: ({ sql, membership, user, payload }) => bee.deleteInspection(sql, membership, user.id, payload) },

  /* Harvests */
  "bee.harvests.list":   { permission: "farm.bee.view",    run: ({ sql, membership, payload })          => bee.listHarvests(sql, membership, payload) },
  "bee.harvests.add":    { permission: "farm.bee.record",  run: ({ sql, membership, user, payload })    => bee.addHarvest(sql, membership, user.id, payload) },
  "bee.harvests.delete": { permission: "farm.bee.manage",  run: ({ sql, membership, user, payload })    => bee.deleteHarvest(sql, membership, user.id, payload) },

  /* Treatments */
  "bee.treatments.list":   { permission: "farm.bee.view",    run: ({ sql, membership, payload })        => bee.listTreatments(sql, membership, payload) },
  "bee.treatments.add":    { permission: "farm.bee.record",  run: ({ sql, membership, user, payload })  => bee.addTreatment(sql, membership, user.id, payload) },
  "bee.treatments.delete": { permission: "farm.bee.manage",  run: ({ sql, membership, user, payload })  => bee.deleteTreatment(sql, membership, user.id, payload) },

  /* Sales */
  "bee.sales.list":   { permission: "farm.bee.finance", run: ({ sql, membership, payload })             => beeOps.listSales(sql, membership, payload) },
  "bee.sales.add":    { permission: "farm.bee.finance", run: ({ sql, membership, user, payload })       => beeOps.addSale(sql, membership, user.id, payload) },
  "bee.sales.delete": { permission: "farm.bee.finance", run: ({ sql, membership, user, payload })       => beeOps.deleteSale(sql, membership, user.id, payload) },

  /* Costs */
  "bee.costs.list":   { permission: "farm.bee.finance", run: ({ sql, membership, payload })             => beeOps.listCosts(sql, membership, payload) },
  "bee.costs.add":    { permission: "farm.bee.finance", run: ({ sql, membership, user, payload })       => beeOps.addCost(sql, membership, user.id, payload) },
  "bee.costs.delete": { permission: "farm.bee.finance", run: ({ sql, membership, user, payload })       => beeOps.deleteCost(sql, membership, user.id, payload) },

  /* Finance summary */
  "bee.finance.summary": { permission: "farm.bee.finance", run: ({ sql, membership, payload })          => beeOps.financeSummary(sql, membership, payload) },

  /* ── Crop / Field module ──────────────────────────────────────────────────
   *   farm.crop.view    — read fields, activities, sowing, harvests
   *   farm.crop.record  — worker/supervisor records activities, sowing, harvests
   *   farm.crop.manage  — manager creates/updates/deactivates fields
   *   farm.crop.finance — manager accesses sales, costs, finance summary */

  /* Field metrics */
  "crop.metrics":             { permission: "farm.crop.view",    run: ({ sql, membership })                  => crop.fieldMetrics(sql, membership) },

  /* Fields */
  "crop.fields.list":         { permission: "farm.crop.view",    run: ({ sql, membership, payload })          => crop.listFields(sql, membership, payload) },
  "crop.fields.get":          { permission: "farm.crop.view",    run: ({ sql, membership, payload })          => crop.getField(sql, membership, payload) },
  "crop.fields.create":       { permission: "farm.crop.manage",  run: ({ sql, membership, user, payload })    => crop.createField(sql, membership, user.id, payload) },
  "crop.fields.update":       { permission: "farm.crop.manage",  run: ({ sql, membership, user, payload })    => crop.updateField(sql, membership, user.id, payload) },
  "crop.fields.setStatus":    { permission: "farm.crop.manage",  run: ({ sql, membership, user, payload })    => crop.setFieldStatus(sql, membership, user.id, payload) },
  "crop.field.history":       { permission: "farm.crop.view",    run: ({ sql, membership, payload })          => crop.fieldHistory(sql, membership, payload) },

  /* Sowing */
  "crop.sowing.list":         { permission: "farm.crop.view",    run: ({ sql, membership, payload })          => crop.listSowing(sql, membership, payload) },
  "crop.sowing.add":          { permission: "farm.crop.record",  run: ({ sql, membership, user, payload })    => crop.addSowing(sql, membership, user.id, payload) },
  "crop.sowing.delete":       { permission: "farm.crop.manage",  run: ({ sql, membership, user, payload })    => crop.deleteSowing(sql, membership, user.id, payload) },

  /* Activities */
  "crop.activities.list":     { permission: "farm.crop.view",    run: ({ sql, membership, payload })          => crop.listActivities(sql, membership, payload) },
  "crop.activities.add":      { permission: "farm.crop.record",  run: ({ sql, membership, user, payload })    => crop.addActivity(sql, membership, user.id, payload) },
  "crop.activities.delete":   { permission: "farm.crop.manage",  run: ({ sql, membership, user, payload })    => crop.deleteActivity(sql, membership, user.id, payload) },

  /* Harvests */
  "crop.harvests.list":       { permission: "farm.crop.view",    run: ({ sql, membership, payload })          => crop.listHarvests(sql, membership, payload) },
  "crop.harvests.add":        { permission: "farm.crop.record",  run: ({ sql, membership, user, payload })    => crop.addHarvest(sql, membership, user.id, payload) },
  "crop.harvests.delete":     { permission: "farm.crop.manage",  run: ({ sql, membership, user, payload })    => crop.deleteHarvest(sql, membership, user.id, payload) },

  /* Sales */
  "crop.sales.list":          { permission: "farm.crop.finance", run: ({ sql, membership, payload })           => cropOps.listSales(sql, membership, payload) },
  "crop.sales.add":           { permission: "farm.crop.finance", run: ({ sql, membership, user, payload })     => cropOps.addSale(sql, membership, user.id, payload) },
  "crop.sales.delete":        { permission: "farm.crop.finance", run: ({ sql, membership, user, payload })     => cropOps.deleteSale(sql, membership, user.id, payload) },

  /* Costs */
  "crop.costs.list":          { permission: "farm.crop.finance", run: ({ sql, membership, payload })           => cropOps.listCosts(sql, membership, payload) },
  "crop.costs.add":           { permission: "farm.crop.finance", run: ({ sql, membership, user, payload })     => cropOps.addCost(sql, membership, user.id, payload) },
  "crop.costs.delete":        { permission: "farm.crop.finance", run: ({ sql, membership, user, payload })     => cropOps.deleteCost(sql, membership, user.id, payload) },

  /* Finance summary */
  "crop.finance.summary":     { permission: "farm.crop.finance", run: ({ sql, membership, payload })           => cropOps.financeSummary(sql, membership, payload) },

  /* ── Cross-module Analytics ───────────────────────────────────────────────
   *   Gated on farm.view — every member can see the aggregated totals.
   *   Individual transaction details are NOT exposed here, only aggregates. */
  "farm.analytics.summary":     { permission: "farm.view", run: ({ sql, membership, payload }) => analytics.farmAnalytics(sql, membership, payload) },
  "farm.analytics.leaderboard": { permission: "farm.view", run: ({ sql, membership, payload }) => analytics.activityLeaderboard(sql, membership, payload) },

  /* ── Notifications ────────────────────────────────────────────────────────
   *   All gated on farm.view. mark-read and dismiss are personal (scoped to
   *   the caller) so any member may act on their own inbox. */
  "notifications.list":     { permission: "farm.view", run: ({ sql, membership, user, payload }) => notifs.listNotifications(sql, membership, user.id, payload) },
  "notifications.count":    { permission: "farm.view", run: ({ sql, membership, user })          => notifs.unreadCount(sql, membership, user.id) },
  "notifications.markRead": { permission: "farm.view", run: ({ sql, membership, user, payload }) => notifs.markRead(sql, membership, user.id, payload) },
  "notifications.dismiss":  { permission: "farm.view", run: ({ sql, membership, user, payload }) => notifs.dismissNotification(sql, membership, user.id, payload) },
  "notifications.check":    { permission: "farm.view", run: ({ sql, membership, user })          => notifs.checkAndGenerateAlerts(sql, membership, user.id) },
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
