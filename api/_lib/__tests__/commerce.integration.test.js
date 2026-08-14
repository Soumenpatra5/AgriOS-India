/* Commerce backend INTEGRATION tests — real SQL against a real Postgres engine
   (PGlite, embedded, no external server) so they run in the normal suite and in
   CI. They apply the actual migration and exercise the correctness-critical SQL
   the handlers rely on: full-text search + soft-delete (api/commerce/listings),
   the atomic oversell guard + order transaction (api/commerce/orders), webhook
   idempotency + fulfilment (api/commerce/payments/webhook), the transaction-
   guarded lifecycle + stock release (api/commerce/orders/[id]), and the review
   uniqueness constraint (api/commerce/reviews).

   The queries here mirror the handler SQL; a future refactor extracting the DB
   ops into a shared module would let handler and test share the exact text. */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

let db;

const migrationUrl = new URL("../../../supabase/migrations/0001_commerce_foundation.sql", import.meta.url);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(migrationUrl, "utf8"));
}, 30000); // PGlite WASM init + migration can exceed the default 10s hook timeout under parallel load

beforeEach(async () => {
  await db.exec(`truncate reviews, payments, order_items, orders, listing_media, listings, users, webhook_events restart identity cascade`);
});

async function seedUser(uid, name = uid, isSeller = false) {
  const r = await db.query(
    `insert into users (firebase_uid, name, is_seller) values ($1,$2,$3) returning id`,
    [uid, name, isSeller],
  );
  return r.rows[0].id;
}

async function seedListing(sellerId, over = {}) {
  const l = { title: "Fresh Paddy", category: "crop", unit: "quintal", price_paise: 230000, qty_available: 10, status: "active", ...over };
  const r = await db.query(
    `insert into listings (seller_id,title,category,unit,price_paise,qty_available,status)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [sellerId, l.title, l.category, l.unit, l.price_paise, l.qty_available, l.status],
  );
  return r.rows[0];
}

describe("schema", () => {
  it("applies the migration and creates the core tables", async () => {
    const r = await db.query(
      `select table_name from information_schema.tables where table_schema='public' order by table_name`,
    );
    const names = r.rows.map((x) => x.table_name);
    for (const t of ["users", "listings", "orders", "order_items", "payments", "webhook_events", "reviews"]) {
      expect(names).toContain(t);
    }
  });
});

describe("listings: search + soft-delete", () => {
  it("full-text + category filter finds active listings and hides soft-deleted", async () => {
    const s = await seedUser("s1", "Asha", true);
    await seedListing(s, { title: "Fresh Paddy", category: "crop" });
    await seedListing(s, { title: "Urea Fertilizer", category: "fertilizer" });
    const gone = await seedListing(s, { title: "Old Paddy", category: "crop" });
    await db.query(`update listings set deleted_at = now() where id = $1`, [gone.id]);

    const hits = await db.query(
      `select title from listings
       where status='active' and deleted_at is null and category = $1
         and to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,''))
             @@ plainto_tsquery('simple', $2)`,
      ["crop", "paddy"],
    );
    expect(hits.rows.map((r) => r.title)).toEqual(["Fresh Paddy"]); // fertilizer + soft-deleted excluded
  });
});

describe("listings: mine filter (seller dashboard)", () => {
  it("returns the seller's own listings across all statuses; the public feed shows only active", async () => {
    const seller = await seedUser("s1", "Asha", true);
    await seedListing(seller, { title: "Live One", status: "active" });
    await seedListing(seller, { title: "Draft One", status: "draft" });

    // mine=1 -> own listings, all statuses (mirrors listings.js list())
    const mine = await db.query(
      `select title, status from listings where seller_id = $1 and deleted_at is null order by title`, [seller]);
    expect(mine.rows.map((r) => r.title)).toEqual(["Draft One", "Live One"]);

    // public feed -> active only
    const pub = await db.query(`select title from listings where status='active' and deleted_at is null order by title`);
    expect(pub.rows.map((r) => r.title)).toEqual(["Live One"]);
  });
});

describe("orders: atomic stock guard", () => {
  it("never oversells — the WHERE qty>=n guard admits exactly one buyer of the last unit", async () => {
    const s = await seedUser("s1", "Asha", true);
    const listing = await seedListing(s, { qty_available: 1 });

    const reserve = () => db.query(
      `update listings set qty_available = qty_available - 1
       where id = $1 and qty_available >= 1 returning qty_available`,
      [listing.id],
    );
    const results = await Promise.all([reserve(), reserve(), reserve()]);
    const winners = results.filter((r) => r.rows.length === 1).length;

    expect(winners).toBe(1);
    const [{ qty_available }] = (await db.query(`select qty_available from listings where id=$1`, [listing.id])).rows;
    expect(Number(qty_available)).toBe(0); // never negative
  });

  it("creates an order with items and decremented stock in one transaction", async () => {
    const seller = await seedUser("s1", "Asha", true);
    const buyer = await seedUser("b1", "Ravi");
    const listing = await seedListing(seller, { qty_available: 10, price_paise: 230000 });

    await db.transaction(async (tx) => {
      const dec = await tx.query(
        `update listings set qty_available = qty_available - 2
         where id=$1 and qty_available >= 2 returning qty_available`, [listing.id]);
      expect(dec.rows.length).toBe(1);
      const order = (await tx.query(
        `insert into orders (buyer_id,seller_id,status,subtotal_paise,shipping_paise,total_paise)
         values ($1,$2,'pending_payment',460000,0,460000) returning *`, [buyer, seller])).rows[0];
      await tx.query(
        `insert into order_items (order_id,listing_id,title_snapshot,unit_price_paise,quantity,line_total_paise)
         values ($1,$2,'Fresh Paddy',230000,2,460000)`, [order.id, listing.id]);
      await tx.query(
        `insert into payments (order_id,provider,amount_paise,status) values ($1,'razorpay',460000,'created')`, [order.id]);
    });

    const [{ qty_available }] = (await db.query(`select qty_available from listings where id=$1`, [listing.id])).rows;
    expect(Number(qty_available)).toBe(8);
    const items = (await db.query(`select * from order_items`)).rows;
    expect(items).toHaveLength(1);
    expect(Number(items[0].line_total_paise)).toBe(460000);
  });
});

describe("payments: webhook idempotency + fulfilment", () => {
  it("records an event once and no-ops on redelivery", async () => {
    const first = await db.query(
      `insert into webhook_events (provider,event_id,payload) values ('razorpay','evt_1','{}')
       on conflict (provider,event_id) do nothing returning id`);
    const second = await db.query(
      `insert into webhook_events (provider,event_id,payload) values ('razorpay','evt_1','{}')
       on conflict (provider,event_id) do nothing returning id`);
    expect(first.rows).toHaveLength(1);
    expect(second.rows).toHaveLength(0); // duplicate delivery -> no-op
  });

  it("marks payment captured and order confirmed only from a payable state", async () => {
    const seller = await seedUser("s1", "Asha", true);
    const buyer = await seedUser("b1", "Ravi");
    const order = (await db.query(
      `insert into orders (buyer_id,seller_id,status,subtotal_paise,total_paise) values ($1,$2,'pending_payment',100,100) returning *`,
      [buyer, seller])).rows[0];
    await db.query(`insert into payments (order_id,provider,provider_order_id,amount_paise,status) values ($1,'razorpay','rzp_ord_1',100,'created')`, [order.id]);

    await db.transaction(async (tx) => {
      const pay = (await tx.query(`select * from payments where provider_order_id='rzp_ord_1' for update`)).rows[0];
      await tx.query(`update payments set status='captured', provider_payment_id='pay_1' where id=$1`, [pay.id]);
      await tx.query(`update orders set status='confirmed' where id=$1 and status in ('pending_payment','paid')`, [pay.order_id]);
    });

    const [{ status: pstatus }] = (await db.query(`select status from payments where provider_order_id='rzp_ord_1'`)).rows;
    const [{ status: ostatus }] = (await db.query(`select status from orders where id=$1`, [order.id])).rows;
    expect(pstatus).toBe("captured");
    expect(ostatus).toBe("confirmed");
  });
});

describe("orders: lifecycle transition guard + stock release", () => {
  it("the status-guarded update transitions once; a stale retry affects 0 rows", async () => {
    const seller = await seedUser("s1", "Asha", true);
    const buyer = await seedUser("b1", "Ravi");
    const order = (await db.query(
      `insert into orders (buyer_id,seller_id,status,subtotal_paise,total_paise) values ($1,$2,'confirmed',100,100) returning *`,
      [buyer, seller])).rows[0];

    const first = await db.query(`update orders set status='shipped' where id=$1 and status='confirmed' returning id`, [order.id]);
    const stale = await db.query(`update orders set status='shipped' where id=$1 and status='confirmed' returning id`, [order.id]);
    expect(first.rows).toHaveLength(1);
    expect(stale.rows).toHaveLength(0); // already moved -> guard blocks double apply
  });

  it("cancelling an unpaid order returns the reserved stock", async () => {
    const seller = await seedUser("s1", "Asha", true);
    const buyer = await seedUser("b1", "Ravi");
    const listing = await seedListing(seller, { qty_available: 8 }); // 2 already reserved (was 10)
    const order = (await db.query(
      `insert into orders (buyer_id,seller_id,status,subtotal_paise,total_paise) values ($1,$2,'pending_payment',460000,460000) returning *`,
      [buyer, seller])).rows[0];
    await db.query(
      `insert into order_items (order_id,listing_id,title_snapshot,unit_price_paise,quantity,line_total_paise)
       values ($1,$2,'Fresh Paddy',230000,2,460000)`, [order.id, listing.id]);

    await db.transaction(async (tx) => {
      const moved = await tx.query(`update orders set status='cancelled' where id=$1 and status='pending_payment' returning id`, [order.id]);
      expect(moved.rows).toHaveLength(1);
      for (const it of (await tx.query(`select listing_id, quantity from order_items where order_id=$1`, [order.id])).rows) {
        await tx.query(`update listings set qty_available = qty_available + $2 where id=$1`, [it.listing_id, it.quantity]);
      }
    });

    const [{ qty_available }] = (await db.query(`select qty_available from listings where id=$1`, [listing.id])).rows;
    expect(Number(qty_available)).toBe(10); // 8 + 2 released
  });
});

describe("reviews: one per (order, reviewer, subject)", () => {
  it("enforces the unique constraint on a second identical review", async () => {
    const seller = await seedUser("s1", "Asha", true);
    const buyer = await seedUser("b1", "Ravi");
    const order = (await db.query(
      `insert into orders (buyer_id,seller_id,status,subtotal_paise,total_paise) values ($1,$2,'delivered',100,100) returning *`,
      [buyer, seller])).rows[0];

    const insert = () => db.query(
      `insert into reviews (order_id,reviewer_id,subject_type,subject_id,rating,comment)
       values ($1,$2,'seller',$3,5,'Great') returning id`, [order.id, buyer, seller]);

    await expect(insert()).resolves.toBeDefined();
    await expect(insert()).rejects.toThrow(); // unique_violation
  });
});

describe("B4: reservation-timeout sweep", () => {
  it("cancels stale unpaid orders and returns their stock, leaving fresh ones", async () => {
    const seller = await seedUser("s1", "Asha", true);
    const buyer = await seedUser("b1", "Ravi");
    const listing = await seedListing(seller, { qty_available: 8 }); // 2 already reserved

    const stale = (await db.query(
      `insert into orders (buyer_id,seller_id,status,subtotal_paise,total_paise,created_at)
       values ($1,$2,'pending_payment',460000,460000, now() - interval '40 minutes') returning *`,
      [buyer, seller])).rows[0];
    await db.query(`insert into order_items (order_id,listing_id,title_snapshot,unit_price_paise,quantity,line_total_paise)
       values ($1,$2,'Fresh Paddy',230000,2,460000)`, [stale.id, listing.id]);
    const fresh = (await db.query(
      `insert into orders (buyer_id,seller_id,status,subtotal_paise,total_paise) values ($1,$2,'pending_payment',100,100) returning *`,
      [buyer, seller])).rows[0];

    // mirrors releaseStaleOrders(sql, 30) in api/commerce/cron/release-stale.js
    const doomed = await db.query(`select id from orders where status='pending_payment' and created_at < now() - (30 * interval '1 minute')`);
    for (const { id } of doomed.rows) {
      await db.transaction(async (tx) => {
        const moved = await tx.query(`update orders set status='cancelled' where id=$1 and status='pending_payment' returning id`, [id]);
        if (!moved.rows.length) return;
        for (const it of (await tx.query(`select listing_id, quantity from order_items where order_id=$1`, [id])).rows) {
          await tx.query(`update listings set qty_available = qty_available + $2 where id=$1`, [it.listing_id, it.quantity]);
        }
      });
    }

    expect(doomed.rows.map((r) => r.id)).toEqual([stale.id]); // only the stale order
    expect((await db.query(`select status from orders where id=$1`, [stale.id])).rows[0].status).toBe("cancelled");
    expect(Number((await db.query(`select qty_available from listings where id=$1`, [listing.id])).rows[0].qty_available)).toBe(10);
    expect((await db.query(`select status from orders where id=$1`, [fresh.id])).rows[0].status).toBe("pending_payment"); // untouched
  });
});

describe("B4: refund restocks and marks refunded", () => {
  it("refunding a confirmed order returns stock and marks the payment refunded", async () => {
    const seller = await seedUser("s1", "Asha", true);
    const buyer = await seedUser("b1", "Ravi");
    const listing = await seedListing(seller, { qty_available: 8 });
    const order = (await db.query(
      `insert into orders (buyer_id,seller_id,status,subtotal_paise,total_paise) values ($1,$2,'confirmed',460000,460000) returning *`,
      [buyer, seller])).rows[0];
    await db.query(`insert into order_items (order_id,listing_id,title_snapshot,unit_price_paise,quantity,line_total_paise)
       values ($1,$2,'Fresh Paddy',230000,2,460000)`, [order.id, listing.id]);
    await db.query(`insert into payments (order_id,provider,provider_payment_id,amount_paise,status) values ($1,'razorpay','pay_1',460000,'captured')`, [order.id]);

    // mirrors the DB half of the refund path in api/commerce/orders/[id].js
    // (after the external Razorpay refund has succeeded).
    await db.transaction(async (tx) => {
      const moved = await tx.query(`update orders set status='refunded' where id=$1 and status='confirmed' returning id`, [order.id]);
      expect(moved.rows.length).toBe(1);
      await tx.query(`update payments set status='refunded' where order_id=$1`, [order.id]);
      for (const it of (await tx.query(`select listing_id, quantity from order_items where order_id=$1`, [order.id])).rows) {
        await tx.query(`update listings set qty_available = qty_available + $2 where id=$1`, [it.listing_id, it.quantity]);
      }
    });

    expect((await db.query(`select status from orders where id=$1`, [order.id])).rows[0].status).toBe("refunded");
    expect((await db.query(`select status from payments where order_id=$1`, [order.id])).rows[0].status).toBe("refunded");
    expect(Number((await db.query(`select qty_available from listings where id=$1`, [listing.id])).rows[0].qty_available)).toBe(10);
  });
});
