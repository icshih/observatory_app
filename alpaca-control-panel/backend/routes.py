import asyncio
from fastapi import APIRouter
from alpaca import alpaca_get, alpaca_get_safe, alpaca_put
from models import MountStatus, SlewRequest, TrackingRequest, CatalogEntry
from catalog import STARS, MESSIER, CONSTELLATION_LINES

router = APIRouter(prefix="/api")


@router.get("/status", response_model=MountStatus)
async def get_status():
    connected = await alpaca_get_safe("connected", False)
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


@router.post("/slew")
async def slew(req: SlewRequest):
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
