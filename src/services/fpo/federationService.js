/* FPO Cooperative Federation Hub Service
 * Aggregates production yields across farm spaces, manages collective milk tanker
 * routing & cold-chain logistics, and prepares bulk lots for Mandi e-NAM & ONDC. */

import { repo, uid } from "./fpoDb.js";

const clusters = repo("clusters");
const pools    = repo("pools");
const tankers  = repo("tankers");

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const federationService = {
  // --- CLUSTER PROFILES ---
  async createCluster(data) {
    return clusters.add({
      name: data.name || "AgriOS Cooperative Federation",
      regNumber: data.regNumber || "",
      district: data.district || "",
      state: data.state || "West Bengal",
      contactPerson: data.contactPerson || "",
      phone: data.phone || "",
      memberCount: num(data.memberCount) || 1,
      commodities: Array.isArray(data.commodities) ? data.commodities : ["milk", "paddy"],
      bankAccount: data.bankAccount || "",
      ifsc: data.ifsc || "",
      status: "active",
      demo: Boolean(data.demo),
    });
  },

  getCluster(id) {
    return clusters.getById(id);
  },

  getAllClusters() {
    return clusters.getAll();
  },

  // --- YIELD POOLING ---
  async createYieldPool({ fpoId, commodity = "milk", unit = "L", date, targetVolume = 0, demo = false }) {
    const today = date || new Date().toISOString().slice(0, 10);
    return pools.add({
      fpoId,
      commodity,
      unit,
      date: today,
      targetVolume: num(targetVolume),
      totalVolume: 0,
      avgFat: null,
      avgSnf: null,
      avgMoisture: null,
      status: "collecting", // collecting | pooled | tendered | dispatched
      contributions: [],
      demo: Boolean(demo),
    });
  },

  async getPools(fpoId) {
    const all = await pools.getAll();
    return all
      .filter((p) => !fpoId || p.fpoId === fpoId)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },

  getPool(id) {
    return pools.getById(id);
  },

  async addContribution(poolId, { farmSpaceId, farmerName, village = "", volume, unit, fat, snf, moisture }) {
    const p = await pools.getById(poolId);
    if (!p) throw new Error("Yield pool not found");

    const vol = num(volume);
    if (vol <= 0) throw new Error("Volume must be greater than zero");

    const contrib = {
      id: uid(),
      farmSpaceId: farmSpaceId || "unassigned",
      farmerName: farmerName || "Member Farmer",
      village,
      volume: vol,
      unit: unit || p.unit,
      fat: fat !== undefined && fat !== null ? num(fat) : null,
      snf: snf !== undefined && snf !== null ? num(snf) : null,
      moisture: moisture !== undefined && moisture !== null ? num(moisture) : null,
      at: new Date().toISOString(),
    };

    const nextContribs = [...(p.contributions || []), contrib];
    const newTotalVolume = nextContribs.reduce((acc, c) => acc + c.volume, 0);

    // Compute weighted averages
    let weightedFatSum = 0;
    let fatWeight = 0;
    let weightedSnfSum = 0;
    let snfWeight = 0;
    let weightedMoistSum = 0;
    let moistWeight = 0;

    for (const c of nextContribs) {
      if (c.fat !== null) {
        weightedFatSum += c.fat * c.volume;
        fatWeight += c.volume;
      }
      if (c.snf !== null) {
        weightedSnfSum += c.snf * c.volume;
        snfWeight += c.volume;
      }
      if (c.moisture !== null) {
        weightedMoistSum += c.moisture * c.volume;
        moistWeight += c.volume;
      }
    }

    const avgFat = fatWeight > 0 ? Number((weightedFatSum / fatWeight).toFixed(2)) : null;
    const avgSnf = snfWeight > 0 ? Number((weightedSnfSum / snfWeight).toFixed(2)) : null;
    const avgMoisture = moistWeight > 0 ? Number((weightedMoistSum / moistWeight).toFixed(2)) : null;

    return pools.update(poolId, {
      contributions: nextContribs,
      totalVolume: Number(newTotalVolume.toFixed(2)),
      avgFat,
      avgSnf,
      avgMoisture,
    });
  },

  updatePoolStatus(poolId, status) {
    return pools.update(poolId, { status });
  },

  // --- COLLECTIVE TANKER & ROUTE SCHEDULING ---
  async scheduleTanker({ fpoId, date, tankerNumber, driverName, driverPhone, capacityL = 5000, stops = [], demo = false }) {
    return tankers.add({
      fpoId,
      date: date || new Date().toISOString().slice(0, 10),
      tankerNumber: tankerNumber || "WB-TANKER-01",
      driverName: driverName || "Fleet Driver",
      driverPhone: driverPhone || "",
      capacityL: num(capacityL),
      collectedVolume: 0,
      temperatureC: 4.0, // Insulated chilled milk benchmark
      status: "scheduled", // scheduled | en_route | completed
      stops: stops.map((s, idx) => ({
        stopIndex: idx,
        farmSpaceId: s.farmSpaceId || "",
        farmName: s.farmName || `Stop ${idx + 1}`,
        village: s.village || "",
        expectedVolumeL: num(s.expectedVolumeL),
        actualVolumeL: 0,
        tempC: null,
        qualityPassed: false,
        status: "pending", // pending | collected | skipped
        collectedAt: null,
      })),
      demo: Boolean(demo),
    });
  },

  async getTankers(fpoId) {
    const all = await tankers.getAll();
    return all
      .filter((t) => !fpoId || t.fpoId === fpoId)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },

  getTanker(id) {
    return tankers.getById(id);
  },

  async recordStopPickup(tankerId, stopIndex, { actualVolumeL, tempC = 4.2, qualityPassed = true }) {
    const t = await tankers.getById(tankerId);
    if (!t) throw new Error("Tanker schedule not found");

    const stops = [...(t.stops || [])];
    if (!stops[stopIndex]) throw new Error("Stop index not found");

    const vol = num(actualVolumeL);
    stops[stopIndex] = {
      ...stops[stopIndex],
      actualVolumeL: vol,
      tempC: num(tempC),
      qualityPassed: Boolean(qualityPassed),
      status: "collected",
      collectedAt: new Date().toISOString(),
    };

    const newCollected = stops.reduce((sum, s) => sum + (s.status === "collected" ? s.actualVolumeL : 0), 0);
    const allDone = stops.every((s) => s.status === "collected" || s.status === "skipped");

    return tankers.update(tankerId, {
      stops,
      collectedVolume: Number(newCollected.toFixed(2)),
      temperatureC: num(tempC),
      status: allDone ? "completed" : "en_route",
    });
  },

  updateTankerStatus(tankerId, status) {
    return tankers.update(tankerId, { status });
  },

  // --- DEMO SEEDING & TEARDOWN ---
  async seedDemoData() {
    // 1. Cluster
    const cluster = await this.createCluster({
      name: "Nadia Krishi Utthan Cooperative FPO",
      regNumber: "FPO-WB-NAD-2024-041",
      district: "Nadia",
      state: "West Bengal",
      contactPerson: "Prabir Mondal (CEO)",
      phone: "+91 98301 23456",
      memberCount: 142,
      commodities: ["milk", "paddy", "mustard"],
      bankAccount: "987654321012",
      ifsc: "PUNB0123400",
      demo: true,
    });

    // 2. Milk Pool
    const pool = await this.createYieldPool({
      fpoId: cluster.id,
      commodity: "milk",
      unit: "L",
      targetVolume: 3500,
      demo: true,
    });

    await this.addContribution(pool.id, {
      farmSpaceId: "space-hanskhali-01",
      farmerName: "Ananda Biswas",
      village: "Hanskhali",
      volume: 850,
      unit: "L",
      fat: 4.5,
      snf: 8.8,
    });
    await this.addContribution(pool.id, {
      farmSpaceId: "space-ranaghat-02",
      farmerName: "Balaram Ghosh",
      village: "Ranaghat",
      volume: 1100,
      unit: "L",
      fat: 4.3,
      snf: 8.6,
    });
    await this.addContribution(pool.id, {
      farmSpaceId: "space-shantipur-03",
      farmerName: "Dipankar Halder",
      village: "Shantipur",
      volume: 900,
      unit: "L",
      fat: 4.6,
      snf: 8.9,
    });

    // 3. Tanker Schedule
    await this.scheduleTanker({
      fpoId: cluster.id,
      tankerNumber: "WB-52-T-9812 (Insulated Chilled)",
      driverName: "Ramesh Ghosh",
      driverPhone: "+91 94332 55678",
      capacityL: 5000,
      demo: true,
      stops: [
        { farmSpaceId: "space-hanskhali-01", farmName: "Hanskhali Chilling Point", village: "Hanskhali", expectedVolumeL: 850 },
        { farmSpaceId: "space-ranaghat-02", farmName: "Ranaghat Gaushala Center", village: "Ranaghat", expectedVolumeL: 1100 },
        { farmSpaceId: "space-shantipur-03", farmName: "Shantipur Dairy Cluster", village: "Shantipur", expectedVolumeL: 900 },
        { farmSpaceId: "space-krishnanagar-04", farmName: "Krishnanagar Bulk Depot", village: "Krishnanagar", expectedVolumeL: 650 },
      ],
    });

    return cluster;
  },

  async clearDemoData() {
    const [allClusters, allPools, allTankers] = await Promise.all([
      clusters.getAll(),
      pools.getAll(),
      tankers.getAll(),
    ]);

    for (const c of allClusters.filter((x) => x.demo)) await clusters.remove(c.id);
    for (const p of allPools.filter((x) => x.demo)) await pools.remove(p.id);
    for (const t of allTankers.filter((x) => x.demo)) await tankers.remove(t.id);
  },

  async hasData() {
    const list = await clusters.getAll();
    return list.length > 0;
  },
};
