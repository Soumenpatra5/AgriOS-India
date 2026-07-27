/* IoT device registry — future-ready interface. Devices are registered with
   protocol metadata now; telemetry is manual entry until a backend exists.
   Live MQTT/LoRaWAN ingestion plugs into `recordTelemetry` without changing
   any consumer. */

import { repo } from "../erp/erpDb.js";

export const DEVICE_TYPES = [
  { id: "temp",      label: "Temperature Sensor", icon: "Thermometer", unit: "°C"  },
  { id: "humidity",  label: "Humidity Sensor",    icon: "Droplets",    unit: "%"   },
  { id: "water",     label: "Water Level Sensor", icon: "Gauge",       unit: "cm"  },
  { id: "feed",      label: "Feed Sensor",        icon: "Package",     unit: "kg"  },
  { id: "weight",    label: "Weight Sensor",      icon: "Scale",       unit: "kg"  },
  { id: "gps",       label: "GPS Tracker",        icon: "MapPin",      unit: ""    },
  { id: "rfid",      label: "RFID Reader",        icon: "ScanLine",    unit: ""    },
];

export const PROTOCOLS = ["Manual entry", "Bluetooth", "WiFi", "LoRaWAN", "NB-IoT", "MQTT"];

const devices   = repo("devices");
const telemetry = repo("telemetry");

export const deviceRegistry = {
  register: (data) => devices.add({ status: "active", ...data }),
  getAll:   (farmId) => (farmId ? devices.getBy("farmId", farmId) : devices.getAll()),
  update:   (id, patch) => devices.update(id, patch),
  remove:   (id) => devices.remove(id),

  /* Single ingestion point — manual today, live transport later. */
  recordTelemetry: (deviceId, value, note = "") =>
    telemetry.add({ deviceId, value: Number(value), note,
      date: new Date().toISOString().slice(0, 10),
      at: new Date().toISOString() }),

  getTelemetry: (deviceId, limit = 50) => telemetry.getBy("deviceId", deviceId)
    .then((l) => l.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)),

  async latestReadings(farmId) {
    const list = await this.getAll(farmId);
    const out = [];
    for (const d of list) {
      const t = await this.getTelemetry(d.id, 1);
      out.push({ device: d, latest: t[0] || null });
    }
    return out;
  },

  typeMeta: (id) => DEVICE_TYPES.find((t) => t.id === id) || DEVICE_TYPES[0],
};
