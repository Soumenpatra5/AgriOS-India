import { describe, it, expect, beforeEach } from "vitest";
import { federationService } from "../federationService.js";

describe("federationService", () => {
  beforeEach(async () => {
    await federationService.clearDemoData();
  });

  it("creates and retrieves an FPO cluster profile", async () => {
    const cluster = await federationService.createCluster({
      name: "Burdwan Farmers Cooperative",
      regNumber: "FPO-WB-BDN-2025-012",
      district: "Purba Bardhaman",
      memberCount: 85,
      commodities: ["milk", "paddy"],
      demo: true,
    });

    expect(cluster.id).toBeDefined();
    expect(cluster.name).toBe("Burdwan Farmers Cooperative");
    expect(cluster.status).toBe("active");

    const fetched = await federationService.getCluster(cluster.id);
    expect(fetched.regNumber).toBe("FPO-WB-BDN-2025-012");
  });

  it("aggregates milk contributions with weighted average FAT and SNF", async () => {
    const cluster = await federationService.createCluster({
      name: "Dairy Federation Unit",
      demo: true,
    });

    const pool = await federationService.createYieldPool({
      fpoId: cluster.id,
      commodity: "milk",
      unit: "L",
      targetVolume: 3000,
      demo: true,
    });

    expect(pool.totalVolume).toBe(0);
    expect(pool.status).toBe("collecting");

    // Farm 1: 1000L with 4.0% FAT, 8.5% SNF
    const after1 = await federationService.addContribution(pool.id, {
      farmSpaceId: "farm-1",
      farmerName: "Farmer A",
      volume: 1000,
      fat: 4.0,
      snf: 8.5,
    });

    expect(after1.totalVolume).toBe(1000);
    expect(after1.avgFat).toBe(4.0);
    expect(after1.avgSnf).toBe(8.5);

    // Farm 2: 2000L with 5.5% FAT, 9.1% SNF
    // Weighted avg FAT = (1000*4.0 + 2000*5.5) / 3000 = (4000 + 11000) / 3000 = 15000 / 3000 = 5.0
    // Weighted avg SNF = (1000*8.5 + 2000*9.1) / 3000 = (8500 + 18200) / 3000 = 26700 / 3000 = 8.9
    const after2 = await federationService.addContribution(pool.id, {
      farmSpaceId: "farm-2",
      farmerName: "Farmer B",
      volume: 2000,
      fat: 5.5,
      snf: 9.1,
    });

    expect(after2.totalVolume).toBe(3000);
    expect(after2.avgFat).toBe(5.0);
    expect(after2.avgSnf).toBe(8.9);
    expect(after2.contributions).toHaveLength(2);
  });

  it("aggregates crop contributions with weighted average moisture", async () => {
    const pool = await federationService.createYieldPool({
      fpoId: "fpo-crop",
      commodity: "paddy",
      unit: "quintal",
      demo: true,
    });

    await federationService.addContribution(pool.id, {
      farmSpaceId: "farm-c1",
      farmerName: "Partha Das",
      volume: 50,
      moisture: 12.0,
    });

    const updated = await federationService.addContribution(pool.id, {
      farmSpaceId: "farm-c2",
      farmerName: "Sunil Roy",
      volume: 50,
      moisture: 14.0,
    });

    expect(updated.totalVolume).toBe(100);
    expect(updated.avgMoisture).toBe(13.0);
  });

  it("schedules tanker routes and updates stop collection status", async () => {
    const tanker = await federationService.scheduleTanker({
      fpoId: "fpo-dairy",
      tankerNumber: "WB-24-9988",
      capacityL: 4000,
      demo: true,
      stops: [
        { farmSpaceId: "sp-1", farmName: "Dairy 1", expectedVolumeL: 1200 },
        { farmSpaceId: "sp-2", farmName: "Dairy 2", expectedVolumeL: 1800 },
      ],
    });

    expect(tanker.status).toBe("scheduled");
    expect(tanker.collectedVolume).toBe(0);

    // Stop 0 collected
    const progress = await federationService.recordStopPickup(tanker.id, 0, {
      actualVolumeL: 1250,
      tempC: 4.1,
      qualityPassed: true,
    });

    expect(progress.status).toBe("en_route");
    expect(progress.collectedVolume).toBe(1250);
    expect(progress.stops[0].status).toBe("collected");

    // Stop 1 collected -> marks completed
    const completed = await federationService.recordStopPickup(tanker.id, 1, {
      actualVolumeL: 1800,
      tempC: 4.2,
      qualityPassed: true,
    });

    expect(completed.status).toBe("completed");
    expect(completed.collectedVolume).toBe(3050);
  });

  it("loads and clears demo FPO data seamlessly", async () => {
    await federationService.seedDemoData();
    expect(await federationService.hasData()).toBe(true);

    const pools = await federationService.getPools();
    expect(pools.length).toBeGreaterThan(0);

    await federationService.clearDemoData();
    const remaining = await federationService.getAllClusters();
    expect(remaining.filter((c) => c.demo)).toHaveLength(0);
  });
});
