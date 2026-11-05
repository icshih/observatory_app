import { describe, it, expect } from "vitest";
import { raDecToXY, xyToRADec, angularSep } from "./projection.js";

const SCALE = 280;
// angularSep uses acos, which loses precision for tiny angles (~1e-6°), so
// round-trip checks via angularSep use 1e-5° (0.04 arcsec) tolerance.
const SEP_TOL = 1e-5;

// Smallest difference between two RAs (hours), accounting for 0/24 wrap.
function raDiff(a, b) {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}

describe("raDecToXY", () => {
  it("maps the centre to the origin", () => {
    const { x, y } = raDecToXY(6, 20, 6, 20, SCALE);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(0, 9);
  });

  it("puts north up (negative canvas y) and east to the left", () => {
    expect(raDecToXY(6, 30, 6, 20, SCALE).y).toBeLessThan(0); // higher Dec → up
    expect(raDecToXY(7, 20, 6, 20, SCALE).x).toBeLessThan(0); // higher RA (east) → left
  });

  it("is a stereographic projection: distance from centre = 2·scale·tan(θ/2)", () => {
    for (const [ra, dec] of [[6, 50], [9, 0], [3, -30]]) {
      const { x, y } = raDecToXY(ra, dec, 6, 20, SCALE);
      const theta = (angularSep(ra, dec, 6, 20) * Math.PI) / 180;
      expect(Math.hypot(x, y)).toBeCloseTo(2 * SCALE * Math.tan(theta / 2), 6);
    }
  });

  it("is periodic in RA (24h)", () => {
    const a = raDecToXY(1, 10, 23, 40, SCALE);
    const b = raDecToXY(25, 10, 23, 40, SCALE);
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.y).toBeCloseTo(b.y, 9);
  });
});

describe("xyToRADec", () => {
  it("returns the centre for (0,0)", () => {
    expect(xyToRADec(0, 0, 5.5, 48.8, SCALE)).toEqual({ ra: 5.5, dec: 48.8 });
  });

  it("always returns RA in [0, 24)", () => {
    for (const dx of [-500, -100, 100, 500]) {
      const { ra } = xyToRADec(dx, 0, 0.1, 0, SCALE);
      expect(ra).toBeGreaterThanOrEqual(0);
      expect(ra).toBeLessThan(24);
    }
  });
});

describe("forward/inverse round-trip", () => {
  const centres = [
    [0, 0],
    [6.25, 48.8],
    [18, -35],
    [12, 85],
    [23.9, -60],
  ];
  const offsets = [
    [0.5, 5],
    [-1.5, -10],
    [3, 20],
    [-4, 30],
    [0, -45],
  ];

  for (const [cra, cdec] of centres) {
    it(`round-trips points around centre (${cra}h, ${cdec}°)`, () => {
      for (const [dra, ddec] of offsets) {
        const ra = (((cra + dra) % 24) + 24) % 24;
        const dec = Math.max(-89, Math.min(89, cdec + ddec));
        const { x, y } = raDecToXY(ra, dec, cra, cdec, SCALE);
        const back = xyToRADec(x, y, cra, cdec, SCALE);
        expect(back.dec).toBeCloseTo(dec, 6);
        // RA is degenerate at the poles; compare via angular separation.
        expect(angularSep(back.ra, back.dec, ra, dec)).toBeLessThan(SEP_TOL);
        if (Math.abs(dec) < 89) expect(raDiff(back.ra, ra)).toBeLessThan(1e-6);
      }
    });
  }

  it("round-trips across different zoom levels", () => {
    for (const scale of [80, 280, 2000]) {
      const { x, y } = raDecToXY(7.2, 15, 6, 20, scale);
      const back = xyToRADec(x, y, 6, 20, scale);
      expect(angularSep(back.ra, back.dec, 7.2, 15)).toBeLessThan(SEP_TOL);
    }
  });
});

describe("angularSep", () => {
  it.each([
    [0, 0, 0, 0, 0],
    [0, 90, 12, -90, 180],
    [0, 0, 6, 0, 90],   // 6h of RA on the equator = 90°
    [0, 0, 12, 0, 180],
    [3, 45, 15, 45, 90],
  ])("sep(%s,%s ; %s,%s) = %s°", (ra1, d1, ra2, d2, expected) => {
    expect(angularSep(ra1, d1, ra2, d2)).toBeCloseTo(expected, 6);
  });

  it("is symmetric and handles the 0/24h wrap", () => {
    expect(angularSep(23.9, 10, 0.1, 10)).toBeCloseTo(angularSep(0.1, 10, 23.9, 10), 12);
    expect(angularSep(23.9, 0, 0.1, 0)).toBeCloseTo(3, 6); // 0.2h = 3°
  });
});
