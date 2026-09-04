import { describe, it, expect } from "vitest";
import { availabilityService } from "../availabilityService.js";
import { bookingService } from "../bookingService.js";
import { providerService } from "../providerService.js";
import { svcCatalogService } from "../svcCatalogService.js";

async function setupProvider() {
  const p = await providerService.register({ name: "Avail Test", type: "individual" });
  const svc = await svcCatalogService.add({
    providerId: p.id, providerName: p.name, title: "Test Svc",
    category: "vet", pricingType: "fixed", price: 100, duration: 60, status: "published",
  });
  return { provider: p, service: svc };
}

describe("availabilityService", () => {
  it("sets and retrieves weekly availability", async () => {
    const { provider } = await setupProvider();
    const slots = [{ start: "09:00", end: "10:00" }, { start: "10:00", end: "11:00" }];
    await availabilityService.setForDay(provider.id, 1, slots, 15);

    const day = await availabilityService.getForDay(provider.id, 1);
    expect(day.slots).toHaveLength(2);
    expect(day.bufferMinutes).toBe(15);

    const all = await availabilityService.getForProvider(provider.id);
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it("upserts existing day instead of creating duplicate", async () => {
    const { provider } = await setupProvider();
    await availabilityService.setForDay(provider.id, 2, [{ start: "09:00", end: "10:00" }]);
    await availabilityService.setForDay(provider.id, 2, [{ start: "08:00", end: "09:00" }, { start: "09:00", end: "10:00" }]);

    const all = await availabilityService.getForProvider(provider.id);
    const day2 = all.filter((a) => a.dayOfWeek === 2);
    expect(day2).toHaveLength(1);
    expect(day2[0].slots).toHaveLength(2);
  });

  it("getAvailableSlots subtracts booked times", async () => {
    const { provider, service } = await setupProvider();
    /* Derive the weekday FROM the date string, the same way the service does
       (new Date("YYYY-MM-DD").getDay()). Mixing a local getDay() with a UTC
       toISOString() date made this fail when run between 00:00 and 05:30 IST,
       where the local calendar day is already ahead of the UTC one. */
    const dateStr = new Date().toISOString().slice(0, 10);
    const dayOfWeek = new Date(dateStr).getDay();

    await availabilityService.setForDay(provider.id, dayOfWeek, [
      { start: "09:00", end: "10:00" },
      { start: "10:00", end: "11:00" },
      { start: "11:00", end: "12:00" },
    ], 0);

    await bookingService.create({
      serviceId: service.id, serviceName: service.title,
      providerId: provider.id, providerName: provider.name,
      date: dateStr, startTime: "10:00", endTime: "11:00",
      pricingType: "fixed", price: 100,
    });

    const slots = await availabilityService.getAvailableSlots(provider.id, dateStr);
    expect(slots).toHaveLength(3);
    expect(slots.find((s) => s.start === "09:00").available).toBe(true);
    expect(slots.find((s) => s.start === "10:00").available).toBe(false);
    expect(slots.find((s) => s.start === "11:00").available).toBe(true);
  });

  it("hasConflict detects overlapping bookings", async () => {
    const { provider, service } = await setupProvider();
    /* Same weekday derivation as above, for the same midnight-window reason. */
    const dateStr = new Date().toISOString().slice(0, 10);
    const dayOfWeek = new Date(dateStr).getDay();

    await availabilityService.setForDay(provider.id, dayOfWeek, [
      { start: "14:00", end: "15:00" },
      { start: "15:00", end: "16:00" },
    ], 0);

    await bookingService.create({
      serviceId: service.id, serviceName: service.title,
      providerId: provider.id, providerName: provider.name,
      date: dateStr, startTime: "14:00", endTime: "15:00",
      pricingType: "fixed", price: 100,
    });

    const conflict = await availabilityService.hasConflict(provider.id, dateStr, "14:00", "15:00");
    expect(conflict).toBe(true);

    const noConflict = await availabilityService.hasConflict(provider.id, dateStr, "15:00", "16:00");
    expect(noConflict).toBe(false);
  });
});
