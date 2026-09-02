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
import { authorize, requireUserRow } from "./_lib/farm/gate.js";
import * as ops from "./_lib/farm/spaces.js";

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

  /* --- space-scoped: gate runs all six steps before these are reached --- */
  "spaces.get":          { permission: "farm.view",             run: ({ membership }) => membership },
  "spaces.update":       { permission: "farm.settings.manage",  run: ({ sql, membership, user, payload }) => ops.updateSpace(sql, membership, user.id, payload) },
  "spaces.archive":      { permission: "farm.settings.manage",  run: ({ sql, membership, user }) => ops.archiveSpace(sql, membership, user.id) },

  "members.list":        { permission: "farm.members.view",     run: ({ sql, membership }) => ops.listMembers(sql, membership) },
  "members.invite":      { permission: "farm.members.manage",   run: ({ sql, membership, user, payload }) => ops.createInvitation(sql, membership, user.id, payload) },
  "members.setRole":     { permission: "farm.members.manage",   run: ({ sql, membership, user, payload }) => ops.setMemberRole(sql, membership, user.id, payload) },
  "members.remove":      { permission: "farm.members.manage",   run: ({ sql, membership, user, payload }) => ops.removeMember(sql, membership, user.id, payload) },
  "members.leave":       { permission: "farm.view",             run: ({ sql, membership, user }) => ops.leaveSpace(sql, membership, user.id) },

  "audit.list":          { permission: "farm.settings.manage",  run: ({ sql, membership, payload }) => ops.listAudit(sql, membership, payload) },
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
      return res.status(err.status).json({ error: { message: err.message } });
    }
    console.error("farm error:", err);
    if (/DATABASE_URL is not set/.test(err?.message || "")) {
      return res.status(503).json({ error: { message: "Farm Space is not configured — set DATABASE_URL." } });
    }
    return res.status(500).json({ error: { message: "Internal error" } });
  }
}
