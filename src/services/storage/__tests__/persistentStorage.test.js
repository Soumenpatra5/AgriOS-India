import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requestPersistentStorage, checkStorageEstimate } from "../persistentStorage.js";

describe("persistentStorage", () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it("requests persistence when not already persisted", async () => {
    const persistMock = vi.fn().mockResolvedValue(true);
    const persistedMock = vi.fn().mockResolvedValue(false);

    Object.defineProperty(globalThis, "navigator", {
      value: {
        storage: {
          persist: persistMock,
          persisted: persistedMock,
        },
      },
      configurable: true,
      writable: true,
    });

    const result = await requestPersistentStorage();
    expect(persistedMock).toHaveBeenCalled();
    expect(persistMock).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("does not call persist if already persisted", async () => {
    const persistMock = vi.fn();
    const persistedMock = vi.fn().mockResolvedValue(true);

    Object.defineProperty(globalThis, "navigator", {
      value: {
        storage: {
          persist: persistMock,
          persisted: persistedMock,
        },
      },
      configurable: true,
      writable: true,
    });

    const result = await requestPersistentStorage();
    expect(persistedMock).toHaveBeenCalled();
    expect(persistMock).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("returns storage estimate with usage and quota", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        storage: {
          estimate: vi.fn().mockResolvedValue({ usage: 25000000, quota: 100000000 }),
        },
      },
      configurable: true,
      writable: true,
    });

    const est = await checkStorageEstimate();
    expect(est).toEqual({
      usageBytes: 25000000,
      quotaBytes: 100000000,
      percentUsed: 25,
    });
  });
});
