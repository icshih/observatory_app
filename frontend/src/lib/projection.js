const DEG = Math.PI / 180;

// Stereographic projection centred on (centerRA h, centerDec °).
// Returns canvas-space {x, y} where (0,0) is the projection centre.
// scale: pixels per radian.
export function raDecToXY(ra, dec, centerRA, centerDec, scale) {
  const φ = dec * DEG;
  const φ0 = centerDec * DEG;
  const Δλ = (ra - centerRA) * 15 * DEG; // RA difference → longitude difference

  const sinφ = Math.sin(φ);
  const cosφ = Math.cos(φ);
  const sinφ0 = Math.sin(φ0);
  const cosφ0 = Math.cos(φ0);
  const cosΔλ = Math.cos(Δλ);

  const k = (2 * scale) / (1 + sinφ0 * sinφ + cosφ0 * cosφ * cosΔλ);

  // x increases East (RA increases East on sky, but canvas x goes right)
  // We flip x so East is right on the rendered chart.
  const x = -k * cosφ * Math.sin(Δλ);
  const y = -k * (cosφ0 * sinφ - sinφ0 * cosφ * cosΔλ);

  return { x, y };
}

// Inverse: canvas offset (dx, dy) from centre → {ra, dec} in (hours, degrees).
export function xyToRADec(dx, dy, centerRA, centerDec, scale) {
  const φ0 = centerDec * DEG;

  // undo the flip
  const x = -dx;
  const y = -dy;

  const ρ = Math.sqrt(x * x + y * y);
  if (ρ === 0) return { ra: centerRA, dec: centerDec };

  const c = 2 * Math.atan2(ρ, 2 * scale);
  const sinc = Math.sin(c);
  const cosc = Math.cos(c);

  const φ = Math.asin(cosc * Math.sin(φ0) + (y * sinc * Math.cos(φ0)) / ρ);
  const Δλ = Math.atan2(x * sinc, ρ * Math.cos(φ0) * cosc - y * Math.sin(φ0) * sinc);

  const dec = φ / DEG;
  let ra = centerRA + Δλ / (15 * DEG);
  ra = ((ra % 24) + 24) % 24;

  return { ra, dec };
}

// Angular separation in degrees between two RA/Dec points.
export function angularSep(ra1, dec1, ra2, dec2) {
  const φ1 = dec1 * DEG;
  const φ2 = dec2 * DEG;
  const Δλ = (ra1 - ra2) * 15 * DEG;
  const cosD =
    Math.sin(φ1) * Math.sin(φ2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.acos(Math.max(-1, Math.min(1, cosD))) / DEG;
}
