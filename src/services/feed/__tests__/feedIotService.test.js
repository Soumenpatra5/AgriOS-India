import { describe, it, expect } from "vitest";
import { latestFeedReadings } from "../feedIotService.js";
import { deviceRegistry } from "../../iot/deviceRegistry.js";

describe("latestFeedReadings", () => {
  it("only includes feed and weight sensor types, not others", async () => {
    const farmId = "iot-test-farm";
    await deviceRegistry.register({ name: "Temp Sensor", type: "temp", farmId });
    const feedDevice = await deviceRegistry.register({ name: "Feed Scale", type: "feed", farmId });
    await deviceRegistry.register({ name: "GPS Tracker", type: "gps", farmId });

    const readings = await latestFeedReadings(farmId);
    expect(readings.every((r) => r.device.type === "feed" || r.device.type === "weight")).toBe(true);
    expect(readings.some((r) => r.device.id === feedDevice.id)).toBe(true);
  });

  it("includes devices with no telemetry yet as latest:null, not throwing", async () => {
    const farmId = "iot-empty-farm";
    await deviceRegistry.register({ name: "New Weight Sensor", type: "weight", farmId });
    const readings = await latestFeedReadings(farmId);
    expect(readings[0].latest).toBeNull();
  });

  it("surfaces the recorded telemetry value for a feed sensor", async () => {
    const farmId = "iot-value-farm";
    const device = await deviceRegistry.register({ name: "Feed Sensor A", type: "feed", farmId });
    await deviceRegistry.recordTelemetry(device.id, 42.5, "auto reading");
    const readings = await latestFeedReadings(farmId);
    const match = readings.find((r) => r.device.id === device.id);
    expect(match.latest.value).toBe(42.5);
  });
});
