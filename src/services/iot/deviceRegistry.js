/* IoT device registry — future-ready interface. Devices are registered with
   protocol metadata now; telemetry is manual entry until a backend exists.
   Live MQTT/LoRaWAN ingestion plugs into `recordTelemetry` without changing
   any consumer. */

import { repo } from "../erp/erpDb.js";

export const DEVICE_TYPES = [
  { id: "temp",      label: "Temperature Sensor", icon: "Thermometer", unit: "°C", i18n: { en: "Temperature Sensor", hi: "तापमान सेंसर", bn: "তাপমাত্রা সেন্সর" }  },
  { id: "humidity",  label: "Humidity Sensor",    icon: "Droplets",    unit: "%", i18n: { en: "Humidity Sensor", hi: "आर्द्रता सेंसर", bn: "আর্দ্রতা সেন্সর" }   },
  { id: "water",     label: "Water Level Sensor", icon: "Gauge",       unit: "cm", i18n: { en: "Water Level Sensor", hi: "जल स्तर सेंसर", bn: "জলস্তর সেন্সর" }  },
  { id: "feed",      label: "Feed Sensor",        icon: "Package",     unit: "kg", i18n: { en: "Feed Sensor", hi: "चारा सेंसर", bn: "খাদ্য সেন্সর" }  },
  { id: "weight",    label: "Weight Sensor",      icon: "Scale",       unit: "kg", i18n: { en: "Weight Sensor", hi: "वज़न सेंसर", bn: "ওজন সেন্সর" }  },
  { id: "gps",       label: "GPS Tracker",        icon: "MapPin",      unit: "", i18n: { en: "GPS Tracker", hi: "GPS ट्रैकर", bn: "GPS ট্র্যাকার" }    },
  { id: "rfid",      label: "RFID Reader",        icon: "ScanLine",    unit: "", i18n: { en: "RFID Reader", hi: "RFID रीडर", bn: "RFID রিডার" }    },
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
