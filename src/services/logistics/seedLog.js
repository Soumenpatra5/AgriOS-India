/* Demo data for the logistics & commerce module — explorable before a backend
   exists. Every seeded record carries demo:true for selective clearing. */

import { repo } from "./logisticsDb.js";
import { telemetryService } from "./telemetryService.js";
import { trackingService } from "./trackingService.js";
import { routingService } from "./routingService.js";
import { CONTRACT_TEMPLATES } from "./contractService.js";
import { EXPORT_DOCS } from "./constantsLog.js";

const providers = repo("transportProviders");
const vehicles = repo("vehicles");
const drivers = repo("drivers");
const shipments = repo("shipments");
const warehouses = repo("warehouses");
const storageBookings = repo("storageBookings");
const contracts = repo("contracts");
const auctions = repo("auctions");
const bids = repo("bids");
const procurements = repo("procurements");
const exportOrders = repo("exportOrders");
const telemetry = repo("telemetry");
const tracking = repo("tracking");

/* West Bengal geo anchors */
const GEO = {
  barasat:  { name: "Barasat",  lat: 22.72, lon: 88.48 },
  kolkata:  { name: "Kolkata Wholesale Mkt", lat: 22.57, lon: 88.36 },
  hooghly:  { name: "Hooghly",  lat: 22.90, lon: 88.39 },
  burdwan:  { name: "Burdwan",  lat: 23.24, lon: 87.86 },
  siliguri: { name: "Siliguri", lat: 26.72, lon: 88.39 },
  durgapur: { name: "Durgapur", lat: 23.55, lon: 87.29 },
  nadia:    { name: "Nadia",    lat: 23.47, lon: 88.55 },
  haldia:   { name: "Haldia Port", lat: 22.06, lon: 88.06 },
};

const PROVIDERS = [
  { name: "Bengal Agri Transport", type: "fleet",       village: "Barasat", district: "North 24 Parganas", state: "West Bengal", tagline: "Refrigerated & dry haulage", verificationStatus: "verified", completedTrips: 340, rating: 4.6, reviewCount: 52, serviceAreas: ["North 24 Parganas", "Kolkata", "Nadia"] },
  { name: "Kisan Logistics Co-op",  type: "cooperative", village: "Hooghly", district: "Hooghly",           state: "West Bengal", tagline: "Farmer-owned mini-truck pool", verificationStatus: "verified", completedTrips: 180, rating: 4.3, reviewCount: 31, serviceAreas: ["Hooghly", "Burdwan"] },
  { name: "GreenLine 3PL",          type: "logistics",   village: "Durgapur",district: "Paschim Bardhaman", state: "West Bengal", tagline: "Cold chain specialists", verificationStatus: "verified", completedTrips: 420, rating: 4.7, reviewCount: 68, serviceAreas: ["Paschim Bardhaman", "Kolkata", "Haldia"] },
  { name: "Nadia Farm Carriers",    type: "individual",  village: "Nadia",   district: "Nadia",             state: "West Bengal", tagline: "Owner-operator, tractor & pickup", verificationStatus: "pending",  completedTrips: 60,  rating: 4.1, reviewCount: 12, serviceAreas: ["Nadia"] },
];

/* [providerIdx, category, regNumber, model, insMonths, fitMonths, permitMonths] */
const VEHICLES = [
  [0, "coldChain",    "WB-24-AB-1234", "Tata LPT Reefer 16T", 8,  10, 14],
  [0, "truck",        "WB-24-AB-5678", "Ashok Leyland 12T",   -1, 6,  12],
  [0, "container",    "WB-24-CD-9012", "20ft Container Rig",  20, 18, 24],
  [1, "miniTruck",    "WB-16-EF-3344", "Tata Ace Gold",       5,  3,  9],
  [1, "miniTruck",    "WB-16-EF-3355", "Mahindra Jeeto",      11, 12, 15],
  [1, "pickupVan",    "WB-16-GH-7788", "Isuzu D-Max",         2,  8,  10],
  [2, "coldChain",    "WB-38-IJ-1010", "Reefer 8T",           14, 16, 20],
  [2, "truck",        "WB-38-IJ-2020", "BharatBenz 14T",      9,  11, 13],
  [3, "tractor",      "WB-52-KL-4545", "Sonalika 45 + Trolley", 4, 5, 7],
  [3, "threeWheeler", "WB-52-KL-6767", "Piaggio Ape",         1,  -1, 6],
];

/* [providerIdx, name, phone, licenseNumber, licVerified, idVerified, langs, completedTrips, rating] */
const DRIVERS = [
  [0, "Subhas Mondal",  "9800011111", "WB1420190001234", true,  true,  ["Bengali", "Hindi"], 210, 4.7],
  [0, "Rafiqul Islam",  "9800022222", "WB1420180005678", true,  false, ["Bengali"],          140, 4.4],
  [1, "Gopal Das",      "9800033333", "WB1620200009012", true,  true,  ["Bengali"],          95,  4.5],
  [2, "Vikram Singh",   "9800044444", "WB3820170003344", true,  true,  ["Hindi", "English"], 260, 4.8],
  [2, "Anwar Sheikh",   "9800055555", "WB3820210007788", false, false, ["Bengali", "Hindi"], 40,  4.0],
  [3, "Nitai Ghosh",    "9800066666", "WB5220220001212", true,  false, ["Bengali"],          55,  4.2],
];

/* [providerIdx, vehicleIdx, driverIdx, commodity, qtyKg, from, to, price, term, status, withTrail] */
const SHIPMENTS = [
  [0, 0, 0, "Potato",  9000, "barasat", "kolkata",  8500,  "onDelivery", "delivered",  true],
  [2, 6, 3, "Tomato",  6000, "durgapur","kolkata",  7200,  "escrow",     "in_transit", true],
  [1, 3, 2, "Paddy",   2800, "hooghly", "burdwan",  3200,  "advance",    "assigned",   false],
  [0, 1, 1, "Onion",   10000,"nadia",   "siliguri", 15000, "credit30",   "picked_up",  true],
  [3, 8, 5, "Jute",    4500, "nadia",   "kolkata",  5000,  "onDelivery", "pending",    false],
  [2, 7, 4, "Mango",   5000, "burdwan", "haldia",   9000,  "milestone",  "pending",    false],
];

/* [name, type, owner, place, capacityKg, pricePerTonneMonth] */
const WAREHOUSES = [
  ["Barasat Cold Store",     "cold",       "Bengal Cold Chain",  "barasat", 500000, 900],
  ["Durgapur Reefer Hub",    "cold",       "GreenLine 3PL",      "durgapur",300000, 1100],
  ["Hooghly Dry Warehouse",  "dry",        "Kisan Co-op",        "hooghly", 800000, 350],
  ["Burdwan Grain Silo",     "silo",       "State Warehousing",  "burdwan", 1200000,280],
  ["Nadia Pack House",       "packhouse",  "Nadia FPO",          "nadia",   150000, 600],
];

const CONTRACTS = [
  { title: "Basmati Seasonal Supply", buyerName: "ITC Agri", farmerName: "Nadia FPO", commodity: "Paddy", quantityKg: 50000, pricePerKg: 32, qualityGrade: "Export Grade", templateId: "seasonal", done: 2 },
  { title: "Potato Buyback 2026",     buyerName: "PepsiCo India", farmerName: "Hooghly Growers", commodity: "Potato", quantityKg: 120000, pricePerKg: 14, qualityGrade: "A / FAQ", templateId: "advance", done: 3 },
  { title: "Tomato Spot Deal",        buyerName: "BigBasket", farmerName: "Burdwan Cluster", commodity: "Tomato", quantityKg: 8000, pricePerKg: 22, qualityGrade: "B / Standard", templateId: "spot", done: 1 },
];

/* [title, type, commodity, qtyKg, basePrice, seller, bids:[[name,price]...]] */
const AUCTIONS = [
  ["Premium Mustard Lot",  "forward", "Mustard", 15000, 56, "Nadia FPO", [["Emami Agrotech", 58], ["Local Miller", 60], ["Adani Wilmar", 62]]],
  ["Onion Bulk 20T",       "forward", "Onion",   20000, 18, "Hooghly Growers", [["NAFED", 19], ["Retail Chain", 21]]],
  ["Transport Tender KOL", "reverse", "Haulage", 0,     16000, "GreenLine 3PL", [["Bengal Agri Transport", 15000], ["Kisan Co-op", 14200]]],
];

/* [title, type, commodity, qtyKg, targetPrice, buyer, quotes:[[supplier,price,note]...]] */
const PROCUREMENTS = [
  ["MSP Paddy Procurement", "government", "Paddy", 100000, 23, "FCI West Bengal", [["Nadia FPO", 22, "FAQ grade"], ["Hooghly Co-op", 23, "Bagged"]]],
  ["FPO Wheat Bulk",        "fpo",        "Wheat", 40000,  25, "Sundarban FPO",  [["Burdwan Growers", 24, "Cleaned"]]],
  ["Retail Potato Supply",  "private",    "Potato",30000,  15, "Spencer's Retail", []],
];

const EXPORTS = [
  { buyerName: "Dubai Fresh LLC", destinationCountry: "UAE", commodity: "Mango", quantityKg: 12000, value: 28000, docsChecked: 5 },
  { buyerName: "Tesco UK",        destinationCountry: "United Kingdom", commodity: "Basmati Rice", quantityKg: 50000, value: 65000, docsChecked: EXPORT_DOCS.length },
];

const mkDocs = (n) => Object.fromEntries(EXPORT_DOCS.map((d, i) => [d, i < n]));
const isoAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
const isoIn = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export const seedLog = {
  async hasData() {
    return (await shipments.count()) > 0 || (await warehouses.count()) > 0;
  },

  async load() {
    // Providers
    const provRecs = [];
    for (const p of PROVIDERS) {
      provRecs.push(await providers.add({ icon: "Truck", accent: "primary", role: "transporter", languages: [], kycStatus: "submitted", ...p, demo: true }));
    }

    // Vehicles
    const vehRecs = [];
    for (const [pi, category, regNumber, model, ins, fit, permit] of VEHICLES) {
      vehRecs.push(await vehicles.add({
        providerId: provRecs[pi].id, providerName: provRecs[pi].name,
        category, regNumber, model,
        capacityKg: { truck: 10000, miniTruck: 3000, pickupVan: 1500, tractor: 5000, threeWheeler: 500, coldChain: 8000, container: 25000, railReady: 60000 }[category] || 0,
        status: "available", available: true,
        documents: { insuranceExpiry: isoIn(ins * 30), fitnessExpiry: isoIn(fit * 30), permitExpiry: isoIn(permit * 30) },
        maintenance: [{ date: isoIn(-40).slice(0, 10), note: "Oil & filter change", cost: 3500 }],
        fuelLogs: [
          { date: isoIn(-20).slice(0, 10), litres: 120, cost: 11400, odometer: 84000 },
          { date: isoIn(-8).slice(0, 10),  litres: 110, cost: 10450, odometer: 84680 },
        ],
        odometer: 84680, healthScore: 92, demo: true,
      }));
    }

    // Drivers
    const drvRecs = [];
    for (const [pi, name, phone, lic, licV, idV, langs, trips, rating] of DRIVERS) {
      drvRecs.push(await drivers.add({
        providerId: provRecs[pi].id, providerName: provRecs[pi].name,
        name, phone, licenseNumber: lic, licenseExpiry: isoIn(600),
        status: "available", licenseVerified: licV, identityVerified: idV,
        languages: langs, rating, reviewCount: Math.round(trips / 20),
        trips: [], completedTrips: trips, demo: true,
      }));
    }

    // Shipments (+ tracking trails)
    const shipRecs = [];
    for (const [pi, vi, di, commodity, qty, from, to, price, term, status, withTrail] of SHIPMENTS) {
      const pickup = GEO[from], drop = GEO[to];
      const assigned = status !== "pending";
      const est = routingService.estimate(pickup, drop);
      const s = await shipments.add({
        ref: "SHP-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
        commodity, quantityKg: qty, pickup, drop,
        distanceKm: est.distanceKm, etaMinutes: est.etaMinutes, fuelCost: est.fuelCost,
        status,
        providerId: assigned ? provRecs[pi].id : null,
        providerName: assigned ? provRecs[pi].name : null,
        vehicleId: assigned ? vehRecs[vi].id : null,
        vehicleReg: assigned ? vehRecs[vi].regNumber : null,
        driverId: assigned ? drvRecs[di].id : null,
        driverName: assigned ? drvRecs[di].name : null,
        price, paymentTerm: term, paid: status === "delivered",
        pickupDate: isoIn(status === "pending" ? 1 : -2).slice(0, 10),
        notes: "",
        pod: status === "delivered" ? { receivedBy: "Market Agent", at: isoAgo(1) } : null,
        damage: [],
        timeline: [{ status: "pending", at: isoAgo(4) }].concat(
          assigned ? [{ status: "assigned", at: isoAgo(3) }] : [],
          ["picked_up", "in_transit", "delivered"].includes(status) ? [{ status: "picked_up", at: isoAgo(2) }] : [],
          ["in_transit", "delivered"].includes(status) ? [{ status: "in_transit", at: isoAgo(1) }] : [],
          status === "delivered" ? [{ status: "delivered", at: isoAgo(1) }] : [],
        ),
        demo: true,
      });
      shipRecs.push(s);
      if (withTrail) await trackingService.simulateTrail(s.id, 4);
    }

    // Warehouses (+ cold telemetry)
    const whRecs = [];
    for (const [name, type, owner, place, cap, price] of WAREHOUSES) {
      const g = GEO[place];
      const cold = ["cold", "controlled"].includes(type);
      const w = await warehouses.add({
        name, type, cold, ownerName: owner,
        village: g.name, district: g.name, state: "West Bengal", lat: g.lat, lon: g.lon,
        capacityKg: cap, allocatedKg: Math.round(cap * (0.3 + Math.random() * 0.4)),
        pricePerTonneMonth: price,
        icon: cold ? "Snowflake" : type === "silo" ? "Boxes" : type === "packhouse" ? "Package" : "Warehouse",
        accent: cold ? "blue" : type === "silo" ? "yellow" : "orange",
        tempBand: cold ? { min: 2, max: 8 } : null,
        humidityBand: cold ? { min: 50, max: 70 } : null,
        status: "active", rating: Math.round((4 + Math.random()) * 10) / 10, reviewCount: 8,
        demo: true,
      });
      whRecs.push(w);
      if (cold) {
        await telemetryService.simulate(w.id, "temperature", { base: 5, jitter: 1.5, count: 6 });
        await telemetryService.simulate(w.id, "humidity", { base: 60, jitter: 5, count: 6 });
      }
    }

    // Storage bookings
    await storageBookings.add({
      warehouseId: whRecs[0].id, warehouseName: whRecs[0].name,
      commodity: "Potato", quantityKg: 20000, months: 3,
      price: 54000, startDate: isoIn(-30).slice(0, 10), expiryDate: isoIn(60).slice(0, 10),
      status: "active", paymentTerm: "advance", paid: true,
      timeline: [{ status: "active", at: isoAgo(30) }], demo: true,
    });
    await storageBookings.add({
      warehouseId: whRecs[2].id, warehouseName: whRecs[2].name,
      commodity: "Wheat", quantityKg: 40000, months: 2,
      price: 28000, startDate: isoIn(-5).slice(0, 10), expiryDate: isoIn(4).slice(0, 10),
      status: "active", paymentTerm: "milestone", paid: false,
      timeline: [{ status: "active", at: isoAgo(5) }], demo: true,
    });

    // Contracts
    for (const c of CONTRACTS) {
      const tpl = CONTRACT_TEMPLATES.find((t) => t.id === c.templateId) || CONTRACT_TEMPLATES[0];
      const milestones = tpl.milestones.map((label, i) => ({
        label, due: "", done: i < c.done, doneAt: i < c.done ? isoAgo(10 - i) : null,
      }));
      await contracts.add({
        title: c.title, buyerName: c.buyerName, farmerName: c.farmerName,
        commodity: c.commodity, quantityKg: c.quantityKg, pricePerKg: c.pricePerKg,
        value: c.quantityKg * c.pricePerKg,
        qualityGrade: c.qualityGrade, deliveryDate: isoIn(45), paymentTerm: "milestone",
        status: "active", milestones,
        inspection: c.done >= 2 ? { status: "passed", note: "Sample cleared", at: isoAgo(6) } : null,
        disputeNote: "",
        timeline: [{ status: "offered", at: isoAgo(12) }, { status: "active", at: isoAgo(11) }],
        demo: true,
      });
    }

    // Auctions + bids
    for (const [title, type, commodity, qty, base, seller, bidList] of AUCTIONS) {
      const a = await auctions.add({
        title, type, commodity, quantityKg: qty, unit: "kg",
        basePrice: base, currentPrice: base, status: "live", sellerName: seller,
        endsAt: isoIn(2), winnerBidId: null, winnerName: null, winnerPrice: null, demo: true,
      });
      let cur = base;
      for (const [bidderName, price] of bidList) {
        await bids.add({ auctionId: a.id, bidderName, price, at: isoAgo(1), valid: true, demo: true });
        cur = price;
      }
      await auctions.update(a.id, { currentPrice: cur });
    }

    // Procurements + quotations
    for (const [title, type, commodity, qty, target, buyer, quotes] of PROCUREMENTS) {
      await procurements.add({
        title, type, buyerName: buyer, commodity, quantityKg: qty, targetPrice: target,
        status: quotes.length ? "reviewing" : "open", closeDate: isoIn(10),
        quotations: quotes.map(([supplierName, price, note], i) => ({
          id: "q" + i + Math.random().toString(36).slice(2, 6), supplierName, price, note, at: isoAgo(2),
        })),
        awardedTo: null, poNumber: null, demo: true,
      });
    }

    // Export orders
    for (const e of EXPORTS) {
      const docs = mkDocs(e.docsChecked);
      const allDone = Object.values(docs).every(Boolean);
      await exportOrders.add({
        buyerName: e.buyerName, destinationCountry: e.destinationCountry,
        commodity: e.commodity, quantityKg: e.quantityKg, value: e.value, currency: "USD",
        status: allDone ? "documented" : "preparing",
        containerNo: allDone ? "MSKU" + Math.floor(1000000 + Math.random() * 8999999) : "",
        portOfLoading: "Haldia", docs, demo: true,
      });
    }

    return { providers: provRecs.length, vehicles: vehRecs.length, shipments: shipRecs.length, warehouses: whRecs.length };
  },

  async clear() {
    // Tracking points and telemetry readings are written by shared service
    // helpers that don't tag demo:true, so clear them by reference to the demo
    // shipments / warehouses they belong to.
    const demoShipmentIds = new Set((await shipments.getAll()).filter((x) => x.demo).map((x) => x.id));
    const demoWarehouseIds = (await warehouses.getAll()).filter((x) => x.demo).map((x) => x.id);

    const trackList = await tracking.getAll();
    await Promise.all(trackList.filter((t) => t.demo || demoShipmentIds.has(t.shipmentId)).map((t) => tracking.remove(t.id)));

    const telemetryList = await telemetry.getAll();
    await Promise.all(telemetryList
      .filter((t) => t.demo || demoWarehouseIds.some((wid) => String(t.deviceId).startsWith(wid + ":")))
      .map((t) => telemetry.remove(t.id)));

    const stores = [providers, vehicles, drivers, shipments, warehouses, storageBookings,
      contracts, auctions, bids, procurements, exportOrders];
    for (const r of stores) {
      const list = await r.getAll();
      await Promise.all(list.filter((x) => x.demo).map((x) => r.remove(x.id)));
    }
  },
};
