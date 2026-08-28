/* Reservation sweep for the commerce backend.

   Lives in _lib rather than behind an HTTP route: Vercel does not deploy
   underscore-prefixed directories as Serverless Functions, and the Hobby plan
   allows only 12. The sweep is driven by a scheduled GitHub Actions job
   (.github/workflows/release-stale.yml -> scripts/release-stale.mjs), which
   connects to the same database directly, so no public endpoint is needed. */

/* Cancel unpaid orders older than `ttlMinutes` and return their stock. Each
   order is re-guarded (where status='pending_payment') inside its own
   transaction, so a concurrent payment/transition is never clobbered. Returns
   the number of orders released. */
export async function releaseStaleOrders(sql, ttlMinutes) {
  const stale = await sql`
    select id from orders
    where status = 'pending_payment'
      and created_at < now() - (${ttlMinutes} * interval '1 minute')`;
  let count = 0;
  for (const { id } of stale) {
    await sql.begin(async (tx) => {
      const [moved] = await tx`update orders set status = 'cancelled' where id = ${id} and status = 'pending_payment' returning id`;
      if (!moved) return; // paid/transitioned in the meantime
      const items = await tx`select listing_id, quantity from order_items where order_id = ${id}`;
      for (const it of items) {
        await tx`update listings set qty_available = qty_available + ${it.quantity} where id = ${it.listing_id}`;
      }
      count++;
    });
  }
  return count;
}
