const DEG = Math.PI / 180;
const HOURS_PER_RAD = 12 / Math.PI;

/**
 * Returns RA/Dec points tracing the horizon circle (altitude 0°).
 *
 * Exact alt-az → equatorial transform for alt=0:
 *   sin(Dec) = cos(φ) · cos(A)
 *   H        = atan2(−sin(A), −sin(φ) · cos(A))   [radians]
 *   RA       = LST − H                              [hours]
 *
 * @param {number} observerLat - Observer latitude in degrees
 * @param {number} lst         - Local sidereal time in hours (≈ chart centerRA)
 * @param {number} [steps=120]
 * @returns {{ra: number, dec: number}[]}
 */
export function getHorizonPoints(observerLat, lst, steps = 120) {
  const φ = observerLat * DEG;
  const sinφ = Math.sin(φ);
  const cosφ = Math.cos(φ);
  const horizon = [];

  for (let i = 0; i < steps; i++) {
    const A = (i / steps) * 2 * Math.PI; // azimuth: 0=N, π/2=E, π=S, 3π/2=W
    const dec = Math.asin(cosφ * Math.cos(A)) / DEG;
    const H_hours = Math.atan2(-Math.sin(A), -sinφ * Math.cos(A)) * HOURS_PER_RAD;
    const ra = ((lst - H_hours) % 24 + 24) % 24;
    horizon.push({ ra, dec });
  }

  return horizon;
}

/**
 * Renders the horizon on a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ra: number, dec: number}[]} horizon
 * @param {(ra: number, dec: number) => [number, number]} toCanvas
 */
export function drawHorizon(ctx, horizon, toCanvas) {
  if (horizon.length === 0) return;
  ctx.save();
  ctx.strokeStyle = "rgba(239, 68, 68, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  let first = true;
  for (const { ra, dec } of horizon) {
    const [px, py] = toCanvas(ra, dec);
    if (first) { ctx.moveTo(px, py); first = false; }
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}
