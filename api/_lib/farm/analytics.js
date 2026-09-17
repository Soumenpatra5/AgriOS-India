/* FarmSpace Analytics — cross-module aggregation.
 *
 * Reads from every livestock/crop finance table in the space and returns a
 * unified summary: total revenue, total cost, net profit, broken down by
 * module, plus a month-by-month trend for the requested period.
 *
 * This is a read-only endpoint gated on farm.view (every member can see it).
 * Individual module finance permissions are NOT re-checked here — the farm
 * owner already controls who joins the space, and the cross-module totals do
 * not expose individual transaction detail. */

import { HttpError } from "../http.js";

export async function farmAnalytics(sql, membership, payload = {}) {
  const { fromDate, toDate } = payload;
  if (!fromDate || !toDate) throw new HttpError(400, "fromDate and toDate required");

  const spaceId = membership.space_id;

  /* Pull revenue and cost totals per module in parallel */
  const [
    poultryRev, poultryCost,
    dairyRev,   dairyCost,
    goatRev,    goatCost,
    pigRev,     pigCost,
    fishRev,    fishCost,
    beeRev,     beeCost,
    cropRev,    cropCost,
  ] = await Promise.all([
    /* Poultry: poultry_batch_sales / poultry_batch_costs */
    sql`select coalesce(sum(amount),0) as total from poultry_batch_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}`,
    sql`select coalesce(sum(amount),0) as total from poultry_batch_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}`,

    /* Dairy: dairy_sales / dairy_costs */
    sql`select coalesce(sum(amount),0) as total from dairy_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}`,
    sql`select coalesce(sum(amount),0) as total from dairy_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}`,

    /* Goat: goat_sales / goat_costs */
    sql`select coalesce(sum(amount),0) as total from goat_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}`,
    sql`select coalesce(sum(amount),0) as total from goat_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}`,

    /* Pig: pig_sales / pig_costs */
    sql`select coalesce(sum(amount),0) as total from pig_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}`,
    sql`select coalesce(sum(amount),0) as total from pig_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}`,

    /* Fish: fish_sales / fish_costs */
    sql`select coalesce(sum(amount),0) as total from fish_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}`,
    sql`select coalesce(sum(amount),0) as total from fish_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}`,

    /* Bee: bee_sales / bee_costs */
    sql`select coalesce(sum(amount),0) as total from bee_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}`,
    sql`select coalesce(sum(amount),0) as total from bee_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}`,

    /* Crop: field_sales / field_costs */
    sql`select coalesce(sum(amount),0) as total from field_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}`,
    sql`select coalesce(sum(amount),0) as total from field_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}`,
  ]);

  const n = (rows) => Number(rows[0]?.total ?? 0);

  const by_module = {
    poultry: { revenue: n(poultryRev), cost: n(poultryCost) },
    dairy:   { revenue: n(dairyRev),   cost: n(dairyCost) },
    goat:    { revenue: n(goatRev),    cost: n(goatCost) },
    pig:     { revenue: n(pigRev),     cost: n(pigCost) },
    fish:    { revenue: n(fishRev),    cost: n(fishCost) },
    bee:     { revenue: n(beeRev),     cost: n(beeCost) },
    crop:    { revenue: n(cropRev),    cost: n(cropCost) },
  };

  for (const m of Object.values(by_module)) {
    m.profit = m.revenue - m.cost;
  }

  const total_revenue = Object.values(by_module).reduce((s, m) => s + m.revenue, 0);
  const total_cost    = Object.values(by_module).reduce((s, m) => s + m.cost, 0);

  /* Month-by-month trend — union all revenue sources, group by month */
  const trendRows = await sql`
    select
      to_char(d, 'YYYY-MM') as month,
      coalesce(sum(rev), 0) as revenue,
      coalesce(sum(cst), 0) as cost
    from (
      /* poultry */
      select sale_date as d, amount as rev, 0 as cst from poultry_batch_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}
      union all
      select cost_date, 0, amount from poultry_batch_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}
      union all
      /* dairy */
      select sale_date, amount, 0 from dairy_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}
      union all
      select cost_date, 0, amount from dairy_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}
      union all
      /* goat */
      select sale_date, amount, 0 from goat_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}
      union all
      select cost_date, 0, amount from goat_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}
      union all
      /* pig */
      select sale_date, amount, 0 from pig_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}
      union all
      select cost_date, 0, amount from pig_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}
      union all
      /* fish */
      select sale_date, amount, 0 from fish_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}
      union all
      select cost_date, 0, amount from fish_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}
      union all
      /* bee */
      select sale_date, amount, 0 from bee_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}
      union all
      select cost_date, 0, amount from bee_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}
      union all
      /* crop */
      select sale_date, amount, 0 from field_sales
        where space_id=${spaceId} and deleted_at is null and sale_date between ${fromDate} and ${toDate}
      union all
      select cost_date, 0, amount from field_costs
        where space_id=${spaceId} and deleted_at is null and cost_date between ${fromDate} and ${toDate}
    ) t
    group by to_char(d, 'YYYY-MM')
    order by month asc
  `;

  const trend = trendRows.map(r => ({
    month:   r.month,
    revenue: Number(r.revenue),
    cost:    Number(r.cost),
    profit:  Number(r.revenue) - Number(r.cost),
  }));

  return {
    total_revenue,
    total_cost,
    net_profit: total_revenue - total_cost,
    by_module,
    trend,
  };
}

/* Top-activity leaderboard — who recorded the most farm actions this month */
export async function activityLeaderboard(sql, membership, payload = {}) {
  const { limit = 10 } = payload;
  const spaceId = membership.space_id;

  /* Use the audit log (farm_audit_log) if it exists, else return empty */
  const tableCheck = await sql`
    select 1 from information_schema.tables
    where table_name = 'farm_audit_log' limit 1
  `;
  if (!tableCheck.length) return { leaderboard: [] };

  const rows = await sql`
    select
      u.name,
      u.uid,
      count(*) as action_count
    from farm_audit_log al
    join users u on u.id = al.actor_id
    where al.space_id = ${spaceId}
      and al.created_at >= now() - interval '30 days'
    group by u.id, u.name, u.uid
    order by action_count desc
    limit ${Math.min(Number(limit), 20)}
  `;

  return {
    leaderboard: rows.map(r => ({
      name: r.name,
      uid:  r.uid,
      action_count: Number(r.action_count),
    })),
  };
}
