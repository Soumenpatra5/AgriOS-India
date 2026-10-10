import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { freshDb } from "./e2e/harness.js";
import { requireMembership } from "../farm/gate.js";
import { createSpace, listMembers } from "../farm/spaces.js";
import { generateAgriosUserId } from "../agriosId.js";
import { openConversation } from "../farm/dm.js";
import { listActivity } from "../farm/operations.js";
import {
  getPresenceState,
  formatPresence,
  countOnlineMembers,
  formatActivityAgo,
  PRESENCE_COLORS,
} from "../../../src/services/farmSpace/presenceUtils.js";

describe("Farm Space Presence Utils", () => {
  const now = new Date("2026-10-09T10:00:00.000Z").getTime();
  const mockTc = (obj) => obj?.en || "";

  describe("getPresenceState", () => {
    it("handles null, undefined and invalid date strings safely as offline", () => {
      expect(getPresenceState(null, now)).toEqual({ state: "offline", diffMs: Infinity, seenDate: null });
      expect(getPresenceState(undefined, now)).toEqual({ state: "offline", diffMs: Infinity, seenDate: null });
      expect(getPresenceState("", now)).toEqual({ state: "offline", diffMs: Infinity, seenDate: null });
      expect(getPresenceState("invalid-date-string", now)).toEqual({ state: "offline", diffMs: Infinity, seenDate: null });
    });

    it("handles clock skew gracefully when timestamp is slightly in the future", () => {
      const future = new Date(now + 10000).toISOString(); // 10s in the future
      const res = getPresenceState(future, now);
      expect(res.state).toBe("online");
      expect(res.diffMs).toBe(0);
    });

    it("identifies online status (< 90 seconds)", () => {
      const onlineAt = new Date(now - 45 * 1000).toISOString(); // 45s ago
      const res = getPresenceState(onlineAt, now);
      expect(res.state).toBe("online");
      expect(res.diffMs).toBe(45 * 1000);
    });

    it("identifies recently active status (>= 90s and < 60 minutes)", () => {
      const recentAt = new Date(now - 5 * 60 * 1000).toISOString(); // 5m ago
      const res = getPresenceState(recentAt, now);
      expect(res.state).toBe("recent");
      expect(res.diffMs).toBe(5 * 60 * 1000);
    });

    it("identifies offline status (>= 60 minutes)", () => {
      const offlineAt = new Date(now - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      const res = getPresenceState(offlineAt, now);
      expect(res.state).toBe("offline");
      expect(res.diffMs).toBe(2 * 60 * 60 * 1000);
    });
  });

  describe("formatPresence", () => {
    it("formats online state with green dot and localized label", () => {
      const onlineIso = new Date(now - 30 * 1000).toISOString();
      const res = formatPresence(onlineIso, mockTc, now);
      expect(res.state).toBe("online");
      expect(res.label).toBe("Online");
      expect(res.dotColor).toBe(PRESENCE_COLORS.online.dot);
      expect(res.badgeBg).toBe(PRESENCE_COLORS.online.badgeBg);
    });

    it("formats recently active state with amber dot and relative minutes", () => {
      const recentIso = new Date(now - 12 * 60 * 1000).toISOString();
      const res = formatPresence(recentIso, mockTc, now);
      expect(res.state).toBe("recent");
      expect(res.label).toBe("Active 12m ago");
      expect(res.dotColor).toBe(PRESENCE_COLORS.recent.dot);
      expect(res.badgeBg).toBe(PRESENCE_COLORS.recent.badgeBg);
    });

    it("formats offline state with null timestamp as Offline", () => {
      const res = formatPresence(null, mockTc, now);
      expect(res.state).toBe("offline");
      expect(res.label).toBe("Offline");
      expect(res.dotColor).toBe(PRESENCE_COLORS.offline.dot);
    });

    it("formats offline state within same calendar day as Active today", () => {
      const sameDayIso = new Date(now - 3 * 60 * 60 * 1000).toISOString(); // 3 hours ago, same day
      const res = formatPresence(sameDayIso, mockTc, now);
      expect(res.state).toBe("offline");
      expect(res.label).toBe("Active today");
    });

    it("formats offline state yesterday as Active yesterday", () => {
      const yesterdayIso = new Date(now - 24 * 60 * 60 * 1000).toISOString(); // 24h ago
      const res = formatPresence(yesterdayIso, mockTc, now);
      expect(res.state).toBe("offline");
      expect(res.label).toBe("Active yesterday");
    });
  });

  describe("countOnlineMembers", () => {
    it("correctly counts online members", () => {
      const list = [
        { user_id: "u1", last_seen_at: new Date(now - 20 * 1000).toISOString() }, // online
        { user_id: "u2", last_seen_at: new Date(now - 60 * 1000).toISOString() }, // online
        { user_id: "u3", last_seen_at: new Date(now - 5 * 60 * 1000).toISOString() }, // recent
        { user_id: "u4", last_seen_at: null }, // offline
      ];
      expect(countOnlineMembers(list, now)).toBe(2);
    });

    it("returns 0 for empty or invalid input", () => {
      expect(countOnlineMembers(null)).toBe(0);
      expect(countOnlineMembers([])).toBe(0);
    });
  });

  describe("formatActivityAgo", () => {
    it("formats relative activity timestamps properly", () => {
      const nowMs = Date.now();
      expect(formatActivityAgo(new Date(nowMs - 10000).toISOString(), mockTc)).toBe("just now");
      expect(formatActivityAgo(new Date(nowMs - 5 * 60000).toISOString(), mockTc)).toBe("5m ago");
      expect(formatActivityAgo(new Date(nowMs - 2 * 3600000).toISOString(), mockTc)).toBe("2h ago");
      expect(formatActivityAgo(new Date(nowMs - 48 * 3600000).toISOString(), mockTc)).toBe("2d ago");
    });
  });
});

describe("Farm Space Presence Database Integration", () => {
  let db, sql, owner, worker, space, ownerMem;

  beforeAll(async () => {
    const env = await freshDb();
    db = env.pg;
    sql = env.sql;
  }, 40000);

  beforeEach(async () => {
    await db.exec(`truncate farm_space_memberships, farm_spaces, users, farm_audit_logs restart identity cascade`);

    const ownerRes = await db.query(
      `insert into users (firebase_uid, phone, name, agrios_user_id) values ($1, $2, $3, $4) returning *`,
      ["uid-owner-1", "+919876543210", "Ramesh Farmer", generateAgriosUserId()]
    );
    owner = ownerRes.rows[0];

    const workerRes = await db.query(
      `insert into users (firebase_uid, phone, name, agrios_user_id) values ($1, $2, $3, $4) returning *`,
      ["uid-worker-1", "+919876543211", "Suresh Worker", generateAgriosUserId()]
    );
    worker = workerRes.rows[0];

    space = await createSpace(sql, owner.id, { name: "Green Valley Farm" });
    ownerMem = await requireMembership(sql, owner.id, space.id);

    await sql`
      insert into farm_space_memberships (space_id, user_id, role, status, last_seen_at)
      values (${space.id}, ${worker.id}, 'worker', 'active', now())`;
  });

  it("listMembers queries m.last_seen_at properly", async () => {
    const members = await listMembers(sql, ownerMem);
    expect(members.length).toBe(2);
    const workerRow = members.find((m) => m.user_id === worker.id);
    expect(workerRow).toBeDefined();
    expect(workerRow.last_seen_at).toBeDefined();
    expect(new Date(workerRow.last_seen_at).getTime()).toBeGreaterThan(0);
  });

  it("openConversation calculates other_is_online dynamically", async () => {
    // When worker was just active, worker should be online for owner
    const convForOwner = await openConversation(sql, ownerMem, owner.id, { otherUserId: worker.id });
    expect(convForOwner.other_user_id).toBe(worker.id);
    expect(convForOwner.other_is_online).toBe(true);

    // Age worker's presence past 100 seconds
    await sql`
      update farm_space_memberships
         set last_seen_at = now() - interval '100 seconds'
       where space_id = ${space.id} and user_id = ${worker.id}`;

    const convForOwnerOffline = await openConversation(sql, ownerMem, owner.id, { otherUserId: worker.id });
    expect(convForOwnerOffline.other_is_online).toBe(false);
  });

  it("listActivity returns farm audit logs in reverse chronological order", async () => {
    // Audit logs were written during createSpace
    const logs = await listActivity(sql, ownerMem, owner.id, { limit: 10 });
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe("space.created");
    expect(logs[0].actor_name).toBe("Ramesh Farmer");
  });
});
