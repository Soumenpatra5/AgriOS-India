/* Supply-chain analytics — pure aggregation over the logistics stores.
   No ML; forecasting/risk models are deferred to the backend phase. */

import { repo } from "./logisticsDb.js";
import { fleetService } from "./fleetService.js";

const shipments = repo("shipments");
const vehicles = repo("vehicles");
const drivers = repo("drivers");
const warehouses = repo("warehouses");
const auctions = repo("auctions");
const procurements = repo("procurements");
const num = (v) => Number(v) || 0;

export const logisticsAnalytics = {
  async fleet() {
    const list = await vehicles.getAll();
    const drv = await drivers.getAll();
    return {
      vehicles: list.length,
      available: list.filter((v) => v.available).length,
      onTrip: list.filter((v) => v.status === "on_trip").length,
      drivers: drv.length,
      docAlerts: list.reduce((s, v) => s + fleetService.documentAlerts(v).length, 0),
    };
  },

  async shipments() {
    const list = await shipments.getAll();
    const delivered = list.filter((s) => s.status === "delivered");
    const active = list.filter((s) => ["assigned", "picked_up", "in_transit"].includes(s.status));
    return {
      total: list.length,
      pending: list.filter((s) => s.status === "pending").length,
      active: active.length,
      delivered: delivered.length,
      revenue: delivered.reduce((sum, s) => sum + num(s.price), 0),
      totalKm: Math.round(list.reduce((sum, s) => sum + num(s.distanceKm), 0)),
      damageReports: list.reduce((sum, s) => sum + (s.damage?.length || 0), 0),
    };
  },

  async warehouses() {
    const list = await warehouses.getAll();
    const capacity = list.reduce((s, w) => s + num(w.capacityKg), 0);
    const allocated = list.reduce((s, w) => s + num(w.allocatedKg), 0);
    return {
      facilities: list.length,
      cold: list.filter((w) => w.cold).length,
      capacityKg: capacity,
      allocatedKg: allocated,
      utilisation: capacity ? Math.round((allocated / capacity) * 100) : 0,
    };
  },

  async trade() {
    const auc = await auctions.getAll();
    const proc = await procurements.getAll();
    return {
      auctions: auc.length,
      liveAuctions: auc.filter((a) => a.status === "live").length,
      awardedAuctions: auc.filter((a) => a.status === "awarded").length,
      procurements: proc.length,
      openProcurements: proc.filter((p) => p.status === "open").length,
    };
  },

  /* Commodity throughput = delivered shipment weight grouped by commodity. */
  async commodityThroughput() {
    const list = (await shipments.getAll()).filter((s) => s.status === "delivered");
    const map = {};
    list.forEach((s) => { map[s.commodity] = (map[s.commodity] || 0) + num(s.quantityKg); });
    return Object.entries(map)
      .map(([commodity, kg]) => ({ commodity, kg }))
      .sort((a, b) => b.kg - a.kg);
  },

  async overview() {
    const [fleet, ship, wh, trade] = await Promise.all([
      this.fleet(), this.shipments(), this.warehouses(), this.trade(),
    ]);
    return { fleet, shipments: ship, warehouses: wh, trade };
  },
};
