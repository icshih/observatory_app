import { describe, it, expect } from "vitest";
import {
  altitudeOf, checkSlewTarget, effectiveLatitude, supports, DEFAULT_LATITUDE,
} from "./safety.js";
import { getHorizonPoints } from "./horizon.js";

const LAT = 48.8;
const LST = 6.25;

describe("altitudeOf", () => {
  it.each([
    [LST, LAT, 90],              // zenith
    [LST, LAT - 90, 0],          // south point
    [LST + 12, 90 - LAT, 0],     // north point
    [LST, 0, 90 - LAT],          // equator on meridian
    [3, 90, LAT],                // celestial pole = latitude
    [LST + 6, 0, 0],             // equator rising
    [LST + 12, 0, -(90 - LAT)],  // equator on lower meridian
  ])("alt(ra=%s, dec=%s) = %s°", (ra, dec, expected) => {
    expect(altitudeOf(ra, dec, LAT, LST)).toBeCloseTo(expected, 9);
  });

  it("agrees with the backend formula in the southern hemisphere", () => {
    expect(altitudeOf(0, -90, -33.9, 5)).toBeCloseTo(33.9, 9);
  });

  it("is consistent with the drawn horizon (every horizon point is at 0°)", () => {
    for (const { ra, dec } of getHorizonPoints(LAT, LST, 36)) {
      expect(altitudeOf(ra, dec, LAT, LST)).toBeCloseTo(0, 6);
    }
  });
});

describe("checkSlewTarget", () => {
  const base = { lat: LAT, lst: LST, minAltitude: 10 };

  it("allows targets above the limit", () => {
    const r = checkSlewTarget({ ...base, ra: LST, dec: LAT });
    expect(r.ok).toBe(true);
    expect(r.altitude).toBeCloseTo(90, 9);
    expect(r.reason).toBeNull();
  });

  it("refuses targets below the horizon with a horizon message", () => {
    const r = checkSlewTarget({ ...base, ra: LST + 12, dec: 0 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/below the horizon/);
    expect(r.reason).toContain("-41.2°");
  });

  it("refuses targets above the horizon but below the limit", () => {
    // On the meridian alt = 90 − (48.8 − dec) → dec −35 → 6.2°
    const r = checkSlewTarget({ ...base, ra: LST, dec: -35 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("Target altitude 6.2° is below the 10° limit");
  });

  it("matches the backend boundary (10.2° ok, 9.8° refused)", () => {
    expect(checkSlewTarget({ ...base, ra: LST, dec: -31.0 }).ok).toBe(true);
    expect(checkSlewTarget({ ...base, ra: LST, dec: -31.4 }).ok).toBe(false);
  });

  it("allows anything when the limit is disabled, but still reports altitude", () => {
    const r = checkSlewTarget({ ...base, minAltitude: null, ra: LST + 12, dec: 0 });
    expect(r.ok).toBe(true);
    expect(r.altitude).toBeCloseTo(-41.2, 1);
  });

  it.each([
    ["no LST yet", { lst: null }],
    ["no latitude", { lat: undefined }],
    ["NaN RA", { ra: NaN }],
  ])("defers to the backend when altitude is unknown (%s)", (_, override) => {
    const r = checkSlewTarget({ ...base, ra: LST, dec: 0, ...override });
    expect(r).toEqual({ altitude: null, ok: true, reason: null });
  });
});

describe("effectiveLatitude", () => {
  it("prefers the mount's site latitude", () => {
    expect(effectiveLatitude({ site_latitude: 51.0786 })).toBe(51.0786);
    expect(effectiveLatitude({ site_latitude: -33.9 })).toBe(-33.9);
    expect(effectiveLatitude({ site_latitude: 0 })).toBe(0);
  });

  it.each([null, undefined, {}, { site_latitude: null }, { site_latitude: 123 }, { site_latitude: "51" }])(
    "falls back to the default for %j",
    (info) => {
      expect(effectiveLatitude(info)).toBe(DEFAULT_LATITUDE);
    },
  );

  it("default is 48.8° unless VITE_OBSERVER_LATITUDE is set", () => {
    expect(Number.isFinite(DEFAULT_LATITUDE)).toBe(true);
  });
});

describe("supports", () => {
  it("is false only when the mount explicitly reports false", () => {
    expect(supports({ can_park: false }, "can_park")).toBe(false);
    expect(supports({ can_park: true }, "can_park")).toBe(true);
    expect(supports({ can_park: null }, "can_park")).toBe(true);
    expect(supports({}, "can_park")).toBe(true);
    expect(supports(null, "can_park")).toBe(true);
  });
});
