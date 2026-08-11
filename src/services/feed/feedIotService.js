/* Feed <-> IoT bridge — reuses the existing device registry
   (src/services/iot/deviceRegistry.js) rather than a separate IoT layer.
   That registry already has "feed" and "weight" sensor types and a manual
   recordTelemetry() ingestion point (live MQTT/LoRaWAN would plug into the
   same function without any consumer here changing). This module only
   reads the latest reading per relevant device so a consumption log can be
   pre-filled from it — never fabricates a reading. */

import { deviceRegistry } from "../iot/deviceRegistry.js";

/* Latest reading for every registered feed-quantity or weight sensor on
   this farm, most-recently-updated first. Devices with no telemetry yet
   are included with latest:null so the UI can show "no reading yet". */
export async function latestFeedReadings(farmId) {
  const all = await deviceRegistry.latestReadings(farmId);
  return all
    .filter((r) => r.device.type === "feed" || r.device.type === "weight")
    .sort((a, b) => (b.latest?.at || "").localeCompare(a.latest?.at || ""));
}
