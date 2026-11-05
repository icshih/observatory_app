import { describe, it, expect } from "vitest";
import { formatRA, formatDec, formatDeg, formatHMS, parseRA, parseDec } from "./format.js";

describe("formatRA", () => {
  it.each([
    [0, "00h 00m 00.0s"],
    [5.9194, "05h 55m 09.8s"],
    [12.5, "12h 30m 00.0s"],
    [23.5, "23h 30m 00.0s"],
  ])("formatRA(%s) = %s", (h, expected) => {
    expect(formatRA(h)).toBe(expected);
  });

  it("carries rounding into minutes/hours instead of showing 60.0s", () => {
    expect(formatRA(5.9999999)).toBe("06h 00m 00.0s");
    expect(formatRA(1 + 59 / 60 + 59.96 / 3600)).toBe("02h 00m 00.0s");
  });

  it("wraps 24h and negative values into [0, 24)", () => {
    expect(formatRA(23.99999999)).toBe("00h 00m 00.0s");
    expect(formatRA(24)).toBe("00h 00m 00.0s");
    expect(formatRA(-1)).toBe("23h 00m 00.0s");
  });

  it.each([null, undefined, NaN, Infinity])("returns -- for %s", (v) => {
    expect(formatRA(v)).toBe("--");
  });
});

describe("formatDec", () => {
  it.each([
    [0, "+00° 00' 00\""],
    [7.40694, "+07° 24' 25\""],
    [-16.7161, "-16° 42' 58\""],
    [90, "+90° 00' 00\""],
    [-90, "-90° 00' 00\""],
  ])("formatDec(%s) = %s", (d, expected) => {
    expect(formatDec(d)).toBe(expected);
  });

  it("carries rounding instead of showing 60\"", () => {
    expect(formatDec(-16.99999999)).toBe("-17° 00' 00\"");
    expect(formatDec(89.99999)).toBe("+90° 00' 00\"");
  });

  it("keeps the sign for small negative values", () => {
    expect(formatDec(-0.5)).toBe("-00° 30' 00\"");
  });

  it.each([null, undefined, NaN])("returns -- for %s", (v) => {
    expect(formatDec(v)).toBe("--");
  });
});

describe("formatHMS / formatDeg", () => {
  it("formats sidereal time and wraps at 24h", () => {
    expect(formatHMS(6.25)).toBe("06:15:00");
    expect(formatHMS(23.99999)).toBe("00:00:00");
    expect(formatHMS(null)).toBe("--");
  });

  it("formats degrees", () => {
    expect(formatDeg(45.678)).toBe("45.7°");
    expect(formatDeg(45.678, 2)).toBe("45.68°");
    expect(formatDeg(undefined)).toBe("--");
  });
});

describe("parseRA", () => {
  it.each([
    ["5.9", 5.9],
    ["05 54 00", 5.9],
    ["05:54:00", 5.9],
    ["05h 54m 00.0s", 5.9],
    ["5h54m", 5.9],
    ["12 30", 12.5],
    ["  7  ", 7],
    [".5", 0.5],
  ])("parseRA(%j) = %s", (s, expected) => {
    expect(parseRA(s)).toBeCloseTo(expected, 9);
  });

  it.each([
    "", "   ", "abc", "5 61 0", "5 30 60", "1 2 3 4", "5.5 30", "1e3", "-5", "5x", null, undefined, 5,
  ])("rejects %j (returns null, never 0)", (s) => {
    expect(parseRA(s)).toBeNull();
  });
});

describe("parseDec", () => {
  it.each([
    ["-16.7", -16.7],
    ["+45", 45],
    ["-16 42 00", -16.7],
    ["16:42:00", 16.7],
    ["+07° 24' 25\"", 7 + 24 / 60 + 25 / 3600],
    ["-0 30 00", -0.5],
    ["45d 30m", 45.5],
    ["-16d42m00s", -16.7],
    ["- 10", -10],
  ])("parseDec(%j) = %s", (s, expected) => {
    expect(parseDec(s)).toBeCloseTo(expected, 9);
  });

  it.each(["", "xyz", "+", "10 60", "1 2 3 4", "--5", null])("rejects %j", (s) => {
    expect(parseDec(s)).toBeNull();
  });
});

describe("format → parse round-trips", () => {
  it("RA survives formatRA → parseRA within display precision (0.1s)", () => {
    for (let h = 0; h < 24; h += 0.3721) {
      expect(Math.abs(parseRA(formatRA(h)) - h) * 3600).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });

  it("Dec survives formatDec → parseDec within display precision (1\")", () => {
    for (let d = -90; d <= 90; d += 2.137) {
      expect(Math.abs(parseDec(formatDec(d)) - d) * 3600).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });
});
