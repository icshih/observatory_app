// Split a non-negative value into [whole, minutes, seconds] after rounding the
// total to `decimals` places of seconds, so carries propagate correctly
// (e.g. 59.96 s never renders as "60.0").
function toSexagesimal(value, decimals) {
  const factor = 10 ** decimals;
  const totalUnits = Math.round(value * 3600 * factor); // integer seconds × factor
  const unitsPerMin = 60 * factor;
  const unitsPerWhole = 3600 * factor;
  const whole = Math.floor(totalUnits / unitsPerWhole);
  const min = Math.floor((totalUnits % unitsPerWhole) / unitsPerMin);
  const sec = (totalUnits % unitsPerMin) / factor;
  return [whole, min, sec];
}

const pad2 = (n) => String(n).padStart(2, "0");

export function formatRA(hours) {
  if (hours == null || !Number.isFinite(hours)) return "--";
  const wrapped = ((hours % 24) + 24) % 24;
  let [h, m, s] = toSexagesimal(wrapped, 1);
  h %= 24; // 23:59:59.96 rounds up to 24h → 00h
  return `${pad2(h)}h ${pad2(m)}m ${s.toFixed(1).padStart(4, "0")}s`;
}

export function formatDec(degrees) {
  if (degrees == null || !Number.isFinite(degrees)) return "--";
  const sign = degrees < 0 ? "-" : "+";
  const [d, m, s] = toSexagesimal(Math.abs(degrees), 0);
  return `${sign}${pad2(d)}° ${pad2(m)}' ${pad2(s)}"`;
}

export function formatDeg(deg, decimals = 1) {
  if (deg == null || !Number.isFinite(deg)) return "--";
  return deg.toFixed(decimals) + "°";
}

export function formatHMS(hours) {
  if (hours == null || !Number.isFinite(hours)) return "--";
  const wrapped = ((hours % 24) + 24) % 24;
  const [h, m, s] = toSexagesimal(wrapped, 0);
  return `${pad2(h % 24)}:${pad2(m)}:${pad2(s)}`;
}

// Strictly parse 1–3 sexagesimal components. Returns null if any component is
// not a plain number, if there are too many parts, or if minutes/seconds are
// out of range — so garbage input is rejected rather than silently becoming 0.
const NUM = /^\d+(\.\d+)?$|^\.\d+$/;

function parseParts(parts) {
  if (parts.length === 0 || parts.length > 3) return null;
  if (!parts.every((p) => NUM.test(p))) return null;
  const [a, m = 0, s = 0] = parts.map(Number);
  if (parts.length > 1 && !Number.isInteger(a)) return null; // "5.5 30" is ambiguous
  if (m >= 60 || s >= 60) return null;
  if (parts.length > 2 && !Number.isInteger(m)) return null;
  return a + m / 60 + s / 3600;
}

// Accepts decimal hours ("5.9"), or "HH MM SS.s", "HH:MM:SS", "05h 54m 00s".
// Returns decimal hours, or null if the input can't be parsed.
export function parseRA(str) {
  if (typeof str !== "string") return null;
  const t = str.trim().toLowerCase();
  if (!t) return null;
  const parts = t.split(/\s*[\s:hms]\s*/).filter(Boolean);
  return parseParts(parts);
}

// Accepts decimal degrees ("-16.7"), or "+DD MM SS", "DD:MM:SS", "-16° 42' 58\"", "45d 30m".
// Returns decimal degrees, or null if the input can't be parsed.
export function parseDec(str) {
  if (typeof str !== "string") return null;
  let t = str.trim().toLowerCase();
  if (!t) return null;
  let sign = 1;
  if (t[0] === "-" || t[0] === "+") {
    sign = t[0] === "-" ? -1 : 1;
    t = t.slice(1).trim();
  }
  const parts = t.split(/\s*[\s:dms°'′"″]\s*/).filter(Boolean);
  const value = parseParts(parts);
  return value == null ? null : sign * value;
}
