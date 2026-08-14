import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* In-memory storage so settings persistence is observable. */
const mem = {};
vi.mock("../../../utils/storage.js", () => ({
  storage: {
    get: (k, d) => (k in mem ? mem[k] : d),
    set: (k, v) => { mem[k] = v; },
    remove: (k) => { delete mem[k]; },
  },
}));

const { notificationService } = await import("../notificationService.js");

/* Stub the browser Notification API (the test env is node — no DOM). */
function stubNotification(permission = "granted", requestResult = permission) {
  const Mock = vi.fn(function (title, opts) { this.title = title; this.opts = opts; });
  Mock.permission = permission;
  Mock.requestPermission = vi.fn(async () => requestResult);
  vi.stubGlobal("Notification", Mock);
  vi.stubGlobal("window", { Notification: Mock });
  return Mock;
}

beforeEach(() => { for (const k of Object.keys(mem)) delete mem[k]; });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("notificationService — support + permission", () => {
  it("isSupported reflects presence of window.Notification", () => {
    stubNotification();
    expect(notificationService.isSupported()).toBe(true);
    vi.stubGlobal("window", {}); // no Notification
    expect(notificationService.isSupported()).toBe(false);
  });
  it("getPermission returns the browser value, or 'denied' when unsupported", () => {
    stubNotification("denied");
    expect(notificationService.getPermission()).toBe("denied");
    vi.stubGlobal("window", {});
    vi.stubGlobal("Notification", undefined);
    expect(notificationService.getPermission()).toBe("denied");
  });
});

describe("notificationService — requestPermission", () => {
  it("marks prompted and enables when granted", async () => {
    const Mock = stubNotification("default", "granted");
    expect(await notificationService.requestPermission()).toBe("granted");
    expect(Mock.requestPermission).toHaveBeenCalled();
    expect(notificationService.hasPrompted()).toBe(true);
    expect(mem["notif:on"]).toBe(true);
  });
  it("marks prompted but does not enable when denied", async () => {
    stubNotification("default", "denied");
    expect(await notificationService.requestPermission()).toBe("denied");
    expect(notificationService.hasPrompted()).toBe(true);
    expect(mem["notif:on"]).toBeUndefined();
  });
  it("returns 'denied' without prompting when unsupported", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("Notification", undefined);
    expect(await notificationService.requestPermission()).toBe("denied");
    expect(notificationService.hasPrompted()).toBe(false);
  });
});

describe("notificationService — enabled state", () => {
  it("requires granted permission and defaults on, honouring the toggle", () => {
    stubNotification("granted");
    expect(notificationService.isEnabled()).toBe(true); // default on
    notificationService.setEnabled(false);
    expect(notificationService.isEnabled()).toBe(false);
    notificationService.setEnabled(true);
    expect(notificationService.isEnabled()).toBe(true);
  });
  it("is false when permission is not granted", () => {
    stubNotification("denied");
    expect(notificationService.isEnabled()).toBe(false);
  });
  it("hasPrompted / markPrompted round-trip", () => {
    stubNotification();
    expect(notificationService.hasPrompted()).toBe(false);
    notificationService.markPrompted();
    expect(notificationService.hasPrompted()).toBe(true);
  });
});

describe("notificationService — dispatch", () => {
  it("constructs a Notification when enabled", () => {
    const Mock = stubNotification("granted");
    notificationService.dispatch("Hello", "World", "t1");
    expect(Mock).toHaveBeenCalledTimes(1);
    expect(Mock).toHaveBeenCalledWith("Hello", expect.objectContaining({ body: "World", tag: "t1" }));
  });
  it("does nothing when disabled", () => {
    const Mock = stubNotification("granted");
    notificationService.setEnabled(false);
    notificationService.dispatch("Hi", "there");
    expect(Mock).not.toHaveBeenCalled();
  });
  it("swallows constructor errors (restricted contexts)", () => {
    const Mock = vi.fn(() => { throw new Error("blocked"); });
    Mock.permission = "granted";
    vi.stubGlobal("Notification", Mock);
    vi.stubGlobal("window", { Notification: Mock });
    expect(() => notificationService.dispatch("x", "y")).not.toThrow();
  });
});
