import { storage } from "../../utils/storage.js";

const KEY = "mkt:priceAlerts";

function getAll() {
  return storage.get(KEY, []);
}

function save(alerts) {
  storage.set(KEY, alerts);
}

export const priceAlertService = {
  getAll,

  add({ cropId, cropName, targetPrice, direction }) {
    const alerts = getAll();
    const alert = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      cropId,
      cropName,
      targetPrice: Number(targetPrice),
      direction,
      enabled: true,
      createdAt: Date.now(),
      triggeredAt: null,
    };
    alerts.push(alert);
    save(alerts);
    return alert;
  },

  remove(id) {
    save(getAll().filter((a) => a.id !== id));
  },

  toggle(id) {
    const alerts = getAll();
    const a = alerts.find((x) => x.id === id);
    if (a) a.enabled = !a.enabled;
    save(alerts);
    return a?.enabled;
  },

  markTriggered(id) {
    const alerts = getAll();
    const a = alerts.find((x) => x.id === id);
    if (a) a.triggeredAt = Date.now();
    save(alerts);
  },

  check(cropId, currentPrice) {
    return getAll().filter((a) =>
      a.cropId === cropId && a.enabled && !a.triggeredAt &&
      (a.direction === "above" ? currentPrice >= a.targetPrice : currentPrice <= a.targetPrice)
    );
  },

  forCrop(cropId) {
    return getAll().filter((a) => a.cropId === cropId);
  },
};
