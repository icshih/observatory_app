"""Slew safety: refuse targets below a minimum altitude.

The check runs server-side (in addition to the UI warning) so that no API
client can drive the mount below the horizon. It uses the mount's own
sidereal time and site latitude, so it always agrees with the mount.
"""
import asyncio
import math
import os

from alpaca import AlpacaError, alpaca_get

DEFAULT_MIN_SLEW_ALTITUDE = 10.0  # degrees
_DISABLED = {"", "off", "none", "false", "disabled"}


def min_slew_altitude() -> float | None:
    """Minimum allowed target altitude in degrees, from MIN_SLEW_ALTITUDE.

    Unset → 10°. "off"/"none"/"" → check disabled (returns None).
    Raises ValueError for anything else that isn't a number in [-90, 90].
    """
    raw = os.getenv("MIN_SLEW_ALTITUDE")
    if raw is None:
        return DEFAULT_MIN_SLEW_ALTITUDE
    if raw.strip().lower() in _DISABLED:
        return None
    try:
        value = float(raw)
    except ValueError:
        raise ValueError(f"MIN_SLEW_ALTITUDE must be a number of degrees or 'off', got {raw!r}")
    if not -90 <= value <= 90:
        raise ValueError(f"MIN_SLEW_ALTITUDE must be within [-90, 90], got {value}")
    return value


def altitude(ra_hours: float, dec_deg: float, lat_deg: float, lst_hours: float) -> float:
    """Altitude (degrees) of an equatorial position for an observer.

    sin(alt) = sin(φ)·sin(δ) + cos(φ)·cos(δ)·cos(H),  H = LST − RA
    """
    phi = math.radians(lat_deg)
    dec = math.radians(dec_deg)
    h = math.radians((lst_hours - ra_hours) * 15.0)
    s = math.sin(phi) * math.sin(dec) + math.cos(phi) * math.cos(dec) * math.cos(h)
    return math.degrees(math.asin(max(-1.0, min(1.0, s))))


class BelowHorizonLimit(AlpacaError):
    """Target is below the configured minimum altitude (HTTP 409)."""

    def __init__(self, alt: float, limit: float):
        super().__init__(
            f"Target altitude {alt:.1f}° is below the minimum slew altitude of {limit:g}°",
            status_code=409,
        )
        self.altitude = alt
        self.limit = limit


async def check_slew_target(ra_hours: float, dec_deg: float) -> float | None:
    """Raise if the target is below the limit; return its altitude.

    Fails closed: if the mount's LST or latitude can't be read, the slew is
    refused (502) rather than performed blind. Returns None when disabled.
    """
    limit = min_slew_altitude()
    if limit is None:
        return None
    try:
        lst, lat = await asyncio.gather(alpaca_get("siderealtime"), alpaca_get("sitelatitude"))
    except AlpacaError as exc:
        raise AlpacaError(f"Cannot verify target altitude: {exc.detail}", status_code=502)
    if not isinstance(lst, (int, float)) or not isinstance(lat, (int, float)):
        raise AlpacaError("Cannot verify target altitude: mount returned no LST/latitude")
    alt = altitude(ra_hours, dec_deg, float(lat), float(lst))
    if alt < limit:
        raise BelowHorizonLimit(alt, limit)
    return alt
