/* FarmSpace Notifications — per-member inbox + alert generation.
 *
 * Alerts are generated on-demand when the member calls notifications.check.
 * The engine looks at the current state of hives, ponds, and fields and
 * upserts deduped alerts. Existing un-dismissed alerts for the same alert_key
 * are not duplicated (UNIQUE index on space_id + member_id + alert_key). */

/* ── list / mark-read / dismiss ──────────────────────────────────────────── */

export async function listNotifications(sql, membership, userId, payload = {}) {
  const { includeRead = false, limit = 50 } = payload;
  const readFilter = includeRead ? sql`` : sql`and is_read = false`;

  return sql`
    select * from farm_notifications
    where space_id = ${membership.space_id}
      and member_id = ${userId}
      and dismissed = false
      ${readFilter}
    order by created_at desc
    limit ${Math.min(Number(limit), 100)}
  `;
}

export async function unreadCount(sql, membership, userId) {
  const rows = await sql`
    select count(*) as c from farm_notifications
    where space_id = ${membership.space_id}
      and member_id = ${userId}
      and dismissed = false
      and is_read = false
  `;
  return { count: Number(rows[0].c) };
}

export async function markRead(sql, membership, userId, payload = {}) {
  const { notificationId, all = false } = payload;
  if (all) {
    await sql`
      update farm_notifications set is_read = true, read_at = now()
      where space_id = ${membership.space_id}
        and member_id = ${userId}
        and is_read = false
    `;
    return { ok: true };
  }
  if (!notificationId) throw { status: 400, message: "notificationId or all required" };
  await sql`
    update farm_notifications set is_read = true, read_at = now()
    where id = ${notificationId}
      and space_id = ${membership.space_id}
      and member_id = ${userId}
  `;
  return { ok: true };
}

export async function dismissNotification(sql, membership, userId, payload = {}) {
  const { notificationId, all = false } = payload;
  if (all) {
    await sql`
      update farm_notifications set dismissed = true, dismissed_at = now(), is_read = true
      where space_id = ${membership.space_id}
        and member_id = ${userId}
        and dismissed = false
    `;
    return { ok: true };
  }
  if (!notificationId) throw { status: 400, message: "notificationId or all required" };
  await sql`
    update farm_notifications set dismissed = true, dismissed_at = now(), is_read = true
    where id = ${notificationId}
      and space_id = ${membership.space_id}
      and member_id = ${userId}
  `;
  return { ok: true };
}

/* ── alert generation engine ─────────────────────────────────────────────── */

async function upsertAlert(sql, { spaceId, memberId, title, body, severity, category, alertKey, linkKind, linkProps }) {
  await sql`
    insert into farm_notifications
      (space_id, member_id, title, body, severity, category, alert_key, link_kind, link_props)
    values (
      ${spaceId}, ${memberId}, ${title}, ${body ?? null}, ${severity},
      ${category}, ${alertKey}, ${linkKind ?? null}, ${linkProps ? JSON.stringify(linkProps) : null}
    )
    on conflict (space_id, member_id, alert_key)
    where alert_key is not null and dismissed = false
    do nothing
  `;
}

export async function checkAndGenerateAlerts(sql, membership, userId) {
  const spaceId = membership.space_id;
  let generated = 0;

  /* 1. Beekeeping — queenless or weak hives */
  try {
    const hives = await sql`
      select id, name, current_status from bee_hives
      where space_id = ${spaceId} and deleted_at is null
        and current_status in ('queenless','weak')
    `;
    for (const hive of hives) {
      const isQueenless = hive.current_status === 'queenless';
      await upsertAlert(sql, {
        spaceId, memberId: userId,
        title: isQueenless ? `Queenless hive: ${hive.name}` : `Weak colony: ${hive.name}`,
        body: isQueenless
          ? "This hive has no queen. Inspect and re-queen as soon as possible."
          : "Colony strength is low. Check for disease, pests or feed shortage.",
        severity: isQueenless ? "critical" : "warning",
        category: "bee",
        alertKey: `hive:${hive.current_status}:${hive.id}`,
        linkKind: "hiveDetail",
        linkProps: { hiveId: hive.id },
      });
      generated++;
    }
  } catch { /* bee table may not exist on older schemas */ }

  /* 2. Fish — ponds with no water check in last 7 days */
  try {
    const stale = await sql`
      select p.id, p.name from fish_ponds p
      where p.space_id = ${spaceId} and p.deleted_at is null
        and p.pond_status not in ('inactive','drained')
        and (
          select max(recorded_at) from fish_water_checks wc
          where wc.pond_id = p.id and wc.deleted_at is null
        ) < now() - interval '7 days'
        or not exists (
          select 1 from fish_water_checks wc
          where wc.pond_id = p.id and wc.deleted_at is null
        )
    `;
    for (const pond of stale) {
      await upsertAlert(sql, {
        spaceId, memberId: userId,
        title: `Water check overdue: ${pond.name}`,
        body: "No water quality check recorded in the past 7 days.",
        severity: "warning",
        category: "fish",
        alertKey: `fish:water_check_overdue:${pond.id}`,
        linkKind: "fishPondDetail",
        linkProps: { pondId: pond.id },
      });
      generated++;
    }
  } catch { /* fish table may not exist */ }

  /* 3. Crop — fields with status 'ready' (waiting to harvest) */
  try {
    const ready = await sql`
      select id, name from farm_fields
      where space_id = ${spaceId} and deleted_at is null
        and current_status = 'ready'
    `;
    for (const field of ready) {
      await upsertAlert(sql, {
        spaceId, memberId: userId,
        title: `Ready to harvest: ${field.name}`,
        body: "Field status is 'ready'. Plan harvest to avoid crop loss.",
        severity: "warning",
        category: "crop",
        alertKey: `crop:ready:${field.id}`,
        linkKind: "fieldDetail",
        linkProps: { fieldId: field.id },
      });
      generated++;
    }
  } catch { /* crop table may not exist */ }

  /* 4. Tasks — overdue tasks assigned to this member */
  try {
    const overdue = await sql`
      select id, title from farm_tasks
      where space_id = ${spaceId}
        and deleted_at is null
        and status not in ('done','cancelled')
        and due_date < now()::date
        and (assigned_to = ${userId} or assigned_to is null)
      limit 5
    `;
    for (const task of overdue) {
      await upsertAlert(sql, {
        spaceId, memberId: userId,
        title: `Overdue task: ${task.title}`,
        body: "This task is past its due date.",
        severity: "warning",
        category: "tasks",
        alertKey: `task:overdue:${task.id}`,
        linkKind: "farmSpaceTasks",
        linkProps: null,
      });
      generated++;
    }
  } catch { /* tasks table may not exist */ }

  return { generated };
}
