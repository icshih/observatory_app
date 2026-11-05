// Client-side slew safety and capability helpers.
//
// The backend enforces the altitude limit authoritatively (HTTP 409); these
// helpers give immediate feedback in the UI using the same formula.

const DEG = Math.PI / 180;

// Fallback when the mount doesn't report its site latitude.
const ENV_LAT = parseFloat(import.meta.env?.VITE_OBSERVER_LATITUDE);
export const DEFAULT_LATITUDE = Number.isFinite(ENV_LAT) ? ENV_LAT : 48.8;

/**
 * Altitude (degrees) of an equatorial position.
 *   sin(alt) = sinφ·sinδ + cosφ·cosδ·cos(H),  H = LST − RA
 * @param {number} ra  hours
 * @param {number} dec degrees
 * @param {number} lat observer latitude, degrees
 * @param {number} lst local sidereal time, hours
 */
export function altitudeOf(ra, dec, lat, lst) {
  const H = (lst - ra) * 15 * DEG;
  const s =
    Math.sin(lat * DEG) * Math.sin(dec * DEG) +
    Math.cos(lat * DEG) * Math.cos(dec * DEG) * Math.cos(H);
  return Math.asin(Math.max(-1, Math.min(1, s))) / DEG;
}

/**
 * Latitude to use for the chart/horizon: the mount's site latitude when it
 * reports one, otherwise the VITE_OBSERVER_LATITUDE / 48.8° fallback.
 */
export function effectiveLatitude(mountInfo) {
  const lat = mountInfo?.site_latitude;
  return typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 90
    ? lat
    : DEFAULT_LATITUDE;
}

/**
 * Evaluate a slew target against the minimum-altitude limit.
 *
 * @returns {{ altitude: number|null, ok: boolean, reason: string|null }}
 *   altitude is null when it can't be computed (no LST/latitude yet).
 *   ok is false only when the target is known to be below the limit —
 *   unknown altitude is left to the backend, which fails closed.
 */
export function checkSlewTarget({ ra, dec, lat, lst, minAltitude }) {
  if (![ra, dec, lat, lst].every((v) => typeof v === "number" && Number.isFinite(v))) {
    return { altitude: null, ok: true, reason: null };
  }
  const altitude = altitudeOf(ra, dec, lat, lst);
  if (minAltitude != null && altitude < minAltitude) {
    return {
      altitude,
      ok: false,
      reason:
        altitude < 0
          ? `Target is below the horizon (alt ${altitude.toFixed(1)}°)`
          : `Target altitude ${altitude.toFixed(1)}° is below the ${minAltitude}° limit`,
    };
  }
  return { altitude, ok: true, reason: null };
}

/**
 * Whether the mount supports a capability. Unknown (null/undefined) counts
 * as supported — the mount will reject it and the error will be shown.
 * @param {object|null} mountInfo
 * @param {"can_slew_async"|"can_park"|"can_unpark"|"can_set_tracking"} flag
 */
export function supports(mountInfo, flag) {
  return mountInfo?.[flag] !== false;
}

export const NOT_SUPPORTED = "Not supported by this mount";
