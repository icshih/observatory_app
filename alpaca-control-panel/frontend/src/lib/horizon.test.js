import { describe, it, expect, vi } from "vitest";
import { getHorizonPoints, drawHorizon } from "./horizon.js";
import { angularSep } from "./projection.js";

const DEG = Math.PI / 180;

// Independent altitude formula: sin(alt) = sinφ·sinδ + cosφ·cosδ·cos(H), H = LST − RA.
function altitude(ra, dec, lat, lst) {
  const H = (lst - ra) * 15 * DEG;
  const s = Math.sin(lat * DEG) * Math.sin(dec * DEG)
    + Math.cos(lat * DEG) * Math.cos(dec * DEG) * Math.cos(H);
  return Math.asin(s) / DEG;
}

describe("getHorizonPoints", () => {
  it("returns `steps` points with RA in [0, 24) and Dec in [-90, 90]", () => {
    const pts = getHorizonPoints(48.8, 6.25, 90);
    expect(pts).toHaveLength(90);
    for (const { ra, dec } of pts) {
      expect(ra).toBeGreaterThanOrEqual(0);
      expect(ra).toBeLessThan(24);
      expect(dec).toBeGreaterThanOrEqual(-90);
      expect(dec).toBeLessThanOrEqual(90);
    }
  });

  it.each([
    [48.8, 6.25],
    [-33.9, 18.5],
    [0, 0],
    [70, 12],
  ])("every point has altitude 0° (lat %s°, LST %sh)", (lat, lst) => {
    for (const { ra, dec } of getHorizonPoints(lat, lst)) {
      expect(altitude(ra, dec, lat, lst)).toBeCloseTo(0, 6);
    }
  });

  it("north point (A=0) is at Dec = 90° − φ, on the meridian below the pole", () => {
    const lat = 48.8;
    const lst = 6.25;
    const [north] = getHorizonPoints(lat, lst);
    expect(north.dec).toBeCloseTo(90 - lat, 9);
    // H = 12h → RA = LST − 12h
    expect(north.ra).toBeCloseTo(((lst - 12) % 24 + 24) % 24, 9);
  });

  it("south point (A=180°) is at Dec = φ − 90°, on the meridian", () => {
    const lat = 48.8;
    const lst = 6.25;
    const pts = getHorizonPoints(lat, lst, 120);
    const south = pts[60];
    expect(south.dec).toBeCloseTo(lat - 90, 9);
    expect(south.ra).toBeCloseTo(lst, 9);
  });

  it("east/west points lie on the celestial equator, 6h from the meridian", () => {
    const lst = 10;
    const pts = getHorizonPoints(48.8, lst, 120);
    const east = pts[30]; // A = 90°
    const west = pts[90]; // A = 270°
    expect(east.dec).toBeCloseTo(0, 9);
    expect(west.dec).toBeCloseTo(0, 9);
    expect(east.ra).toBeCloseTo(lst + 6, 9); // rising: H = −6h
    expect(west.ra).toBeCloseTo(lst - 6, 9); // setting: H = +6h
  });

  it("at the equator the horizon passes through both celestial poles", () => {
    const pts = getHorizonPoints(0, 0, 120);
    expect(pts[0].dec).toBeCloseTo(90, 9);
    expect(pts[60].dec).toBeCloseTo(-90, 9);
  });

  it("at the north pole the horizon is the celestial equator", () => {
    for (const { dec } of getHorizonPoints(90, 3)) {
      expect(dec).toBeCloseTo(0, 9);
    }
  });

  it("is 90° from the zenith everywhere", () => {
    const lat = 48.8;
    const lst = 6.25;
    for (const { ra, dec } of getHorizonPoints(lat, lst)) {
      expect(angularSep(ra, dec, lst, lat)).toBeCloseTo(90, 6);
    }
  });
});

describe("drawHorizon", () => {
  function mockCtx() {
    return {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), setLineDash: vi.fn(),
    };
  }

  it("draws a closed path through every point", () => {
    const ctx = mockCtx();
    const pts = getHorizonPoints(48.8, 6, 10);
    drawHorizon(ctx, pts, (ra, dec) => [ra, dec]);
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(9);
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.save).toHaveBeenCalledBefore(ctx.restore);
  });

  it("does nothing for an empty horizon", () => {
    const ctx = mockCtx();
    drawHorizon(ctx, [], () => [0, 0]);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});
