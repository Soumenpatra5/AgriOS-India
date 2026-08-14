import { describe, it, expect, beforeEach, vi } from "vitest";

/* In-memory storage; firebase mocked as unavailable so the local paths run
   without any real messaging/firestore. */
const mem = {};
vi.mock("../../../utils/storage.js", () => ({
  storage: {
    get: (k, d) => (k in mem ? mem[k] : d),
    set: (k, v) => { mem[k] = v; },
    remove: (k) => { delete mem[k]; },
  },
}));
vi.mock("../../firebase/config.js", () => ({
  getMessagingInstance: async () => null,
  fbEnabled: false,
  auth: { currentUser: null },
}));
vi.mock("../../firebase/firestore.js", () => ({ db: {} }));

const { fcmService } = await import("../fcmService.js");

beforeEach(() => { for (const k of Object.keys(mem)) delete mem[k]; });

describe("fcmService — graceful degradation (no messaging / firebase off)", () => {
  it("init resolves without error when messaging is unavailable", async () => {
    await expect(fcmService.init(() => {})).resolves.toBeUndefined();
  });
  it("requestToken returns null without messaging", async () => {
    expect(await fcmService.requestToken()).toBeNull();
  });
  it("saveToken is a no-op when firebase is disabled", async () => {
    await expect(fcmService.saveToken("uid-1")).resolves.toBeUndefined();
  });
  it("deleteToken resolves without messaging", async () => {
    await expect(fcmService.deleteToken()).resolves.toBeUndefined();
  });
});

describe("fcmService — topic preferences", () => {
  it("returns the default topics when nothing is stored", () => {
    expect(fcmService.getTopicPrefs()).toEqual({ order_updates: true, weather_alerts: true, price_changes: true });
  });
  it("setTopicPref updates and persists a single topic", async () => {
    mem["fcm:topics"] = { order_updates: true, weather_alerts: true, price_changes: true };
    await fcmService.setTopicPref("weather_alerts", false);
    expect(fcmService.getTopicPrefs()).toEqual({ order_updates: true, weather_alerts: false, price_changes: true });
  });
});
