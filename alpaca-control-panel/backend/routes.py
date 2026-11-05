import asyncio
from fastapi import APIRouter
from alpaca import AlpacaError, AlpacaUnreachableError, alpaca_get, alpaca_get_safe, alpaca_put
from models import MountInfo, MountStatus, SlewRequest, TrackingRequest, CatalogEntry
from catalog import STARS, MESSIER, CONSTELLATION_LINES
from safety import check_slew_target, min_slew_altitude

router = APIRouter(prefix="/api")


def _as_bool(value) -> bool | None:
    return value if isinstance(value, bool) else None


def _as_float(value) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


@router.get("/status", response_model=MountStatus)
async def get_status():
    try:
        connected = await alpaca_get("connected")
    except AlpacaUnreachableError as exc:
        return MountStatus(connected=False, reachable=False, error=exc.detail)
    except AlpacaError as exc:
        return MountStatus(connected=False, error=exc.detail)
    if not connected:
        return MountStatus(connected=False)

    (
        name, ra, dec, alt, az, lst,
        tracking, slewing, at_home, at_park, pier,
        target_ra, target_dec,
    ) = await asyncio.gather(
        alpaca_get_safe("name", ""),
        alpaca_get_safe("rightascension"),
        alpaca_get_safe("declination"),
        alpaca_get_safe("altitude"),
        alpaca_get_safe("azimuth"),
        alpaca_get_safe("siderealtime"),
        alpaca_get_safe("tracking", False),
        alpaca_get_safe("slewing", False),
        alpaca_get_safe("athome", False),
        alpaca_get_safe("atpark", False),
        alpaca_get_safe("sideofpier"),
        alpaca_get_safe("targetrightascension"),
        alpaca_get_safe("targetdeclination"),
    )
    return MountStatus(
        connected=True,
        name=name or "",
        right_ascension=ra,
        declination=dec,
        altitude=alt,
        azimuth=az,
        sidereal_time=lst,
        tracking=tracking,
        slewing=slewing,
        at_home=at_home,
        at_park=at_park,
        side_of_pier=pier,
        target_ra=target_ra,
        target_dec=target_dec,
    )


@router.post("/connect")
async def connect():
    await alpaca_put("connected", Connected=True)
    return {"ok": True}


@router.post("/disconnect")
async def disconnect():
    await alpaca_put("connected", Connected=False)
    return {"ok": True}


@router.get("/mount/info", response_model=MountInfo)
async def get_mount_info():
    """Site location and capabilities. Clients fetch this once per connection
    rather than on every status poll. Unavailable values come back as null."""
    lat, lon, elev, can_slew_async, can_park, can_unpark, can_set_tracking = (
        await asyncio.gather(
            alpaca_get_safe("sitelatitude"),
            alpaca_get_safe("sitelongitude"),
            alpaca_get_safe("siteelevation"),
            alpaca_get_safe("canslewasync"),
            alpaca_get_safe("canpark"),
            alpaca_get_safe("canunpark"),
            alpaca_get_safe("cansettracking"),
        )
    )
    return MountInfo(
        site_latitude=_as_float(lat),
        site_longitude=_as_float(lon),
        site_elevation=_as_float(elev),
        can_slew_async=_as_bool(can_slew_async),
        can_park=_as_bool(can_park),
        can_unpark=_as_bool(can_unpark),
        can_set_tracking=_as_bool(can_set_tracking),
        min_slew_altitude=min_slew_altitude(),
    )


@router.post("/slew")
async def slew(req: SlewRequest):
    # Refuses (409) targets below MIN_SLEW_ALTITUDE; fails closed (502) if
    # the mount's LST/latitude can't be read.
    await check_slew_target(req.right_ascension, req.declination)
    await alpaca_put(
        "slewtocoordinatesasync",
        RightAscension=req.right_ascension,
        Declination=req.declination,
    )
    return {"ok": True}


@router.post("/abort")
async def abort():
    await alpaca_put("abortslew")
    return {"ok": True}


@router.post("/tracking")
async def set_tracking(req: TrackingRequest):
    await alpaca_put("tracking", Tracking=req.enabled)
    return {"ok": True}


@router.post("/park")
async def park():
    await alpaca_put("park")
    return {"ok": True}


@router.post("/unpark")
async def unpark():
    await alpaca_put("unpark")
    return {"ok": True}


@router.get("/catalog")
async def get_catalog():
    stars = [
        CatalogEntry(name=s[0], ra=s[1], dec=s[2], magnitude=s[3], object_type="star")
        for s in STARS
    ]
    messier = [
        CatalogEntry(name=m[0], ra=m[1], dec=m[2], magnitude=m[3], object_type="messier")
        for m in MESSIER
    ]
    return {
        "stars": [e.model_dump() for e in stars],
        "messier": [e.model_dump() for e in messier],
        "constellation_lines": CONSTELLATION_LINES,
    }
