import { describe, it, expect } from "vitest";
import { mapsService } from "../mapsService.js";

const coords = { lat: 22.45, lon: 87.02 };

describe("mapsService.provider", () => {
  it("returns the named provider", () => {
    expect(mapsService.provider("google").id).toBe("google");
    expect(mapsService.provider("osm").id).toBe("osm");
  });
  it("defaults to OSM, including for an unknown id", () => {
    expect(mapsService.provider().id).toBe("osm");
    expect(mapsService.provider("does-not-exist").id).toBe("osm");
  });
});

describe("mapsService.embedUrl", () => {
  it("builds an OSM embed URL with a bbox and marker", () => {
    // Mirror the provider maths so the float bbox matches exactly.
    const { lat, lon } = coords;
    const delta = 0.04;
    const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join("%2C");
    const expected = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
    expect(mapsService.embedUrl(coords)).toBe(expected);
    expect(mapsService.embedUrl(coords)).toContain("layer=mapnik");
    expect(mapsService.embedUrl(coords)).toContain("marker=22.45%2C87.02");
  });

  it("falls back to OSM embed for an unknown provider", () => {
    expect(mapsService.embedUrl(coords, "nope")).toContain("openstreetmap.org/export/embed.html");
  });

  it("returns null when the provider has no embed (google)", () => {
    expect(mapsService.embedUrl(coords, "google")).toBeNull();
  });
});

describe("mapsService.directionsUrl", () => {
  it("builds OSM directions", () => {
    expect(mapsService.directionsUrl(coords, "osm")).toBe("https://www.openstreetmap.org/directions?to=22.45%2C87.02");
  });
  it("builds Google directions", () => {
    expect(mapsService.directionsUrl(coords, "google")).toBe("https://www.google.com/maps/dir/?api=1&destination=22.45,87.02");
  });
});

describe("mapsService.viewUrl", () => {
  it("builds an OSM view URL at the default zoom", () => {
    expect(mapsService.viewUrl(coords, "osm")).toBe("https://www.openstreetmap.org/?mlat=22.45&mlon=87.02#map=14/22.45/87.02");
  });
  it("builds a Google view URL", () => {
    expect(mapsService.viewUrl(coords, "google")).toBe("https://www.google.com/maps/search/?api=1&query=22.45,87.02");
  });
});
