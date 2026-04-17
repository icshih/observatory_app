export function formatRA(hours) {
  if (hours == null) return "--";
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = ((hours - h) * 3600 - m * 60).toFixed(1);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(4, "0")}s`;
}

export function formatDec(degrees) {
  if (degrees == null) return "--";
  const sign = degrees < 0 ? "-" : "+";
  const abs = Math.abs(degrees);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = Math.round((abs - d) * 3600 - m * 60);
  return `${sign}${String(d).padStart(2, "0")}° ${String(m).padStart(2, "0")}' ${String(s).padStart(2, "0")}"`;
}

export function formatDeg(deg, decimals = 1) {
  if (deg == null) return "--";
  return deg.toFixed(decimals) + "°";
}

export function formatHMS(hours) {
  if (hours == null) return "--";
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  const s = Math.round(((hours - Math.floor(hours)) * 3600 - m * 60));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// "HH MM SS.s" or "HH:MM:SS" or decimal hours → decimal hours
export function parseRA(str) {
  if (!str || !str.trim()) return null;
  const num = parseFloat(str);
  if (!isNaN(num) && !/[:hm]/.test(str)) return num;
  const parts = str.trim().split(/[\s:hm]+/).filter(Boolean);
  if (parts.length === 0) return null;
  const h = parseFloat(parts[0]) || 0;
  const m = parseFloat(parts[1]) || 0;
  const s = parseFloat(parts[2]) || 0;
  return h + m / 60 + s / 3600;
}

// "+DD MM SS" or "DD:MM:SS" or decimal degrees → decimal degrees
export function parseDec(str) {
  if (!str || !str.trim()) return null;
  const num = parseFloat(str);
  if (!isNaN(num) && !/[:dm°']/.test(str)) return num;
  const sign = str.trim().startsWith("-") ? -1 : 1;
  const parts = str.trim().replace(/^[+-]/, "").split(/[\s:dm°']+/).filter(Boolean);
  if (parts.length === 0) return null;
  const d = parseFloat(parts[0]) || 0;
  const m = parseFloat(parts[1]) || 0;
  const s = parseFloat(parts[2]) || 0;
  return sign * (d + m / 60 + s / 3600);
}
