from pydantic import BaseModel, Field


class MountStatus(BaseModel):
    connected: bool
    # False when the Alpaca device can't be reached at all (network/timeout),
    # as opposed to reachable-but-disconnected.
    reachable: bool = True
    error: str | None = None  # why connected/reachable is False, if known
    name: str = ""
    right_ascension: float | None = None
    declination: float | None = None
    altitude: float | None = None
    azimuth: float | None = None
    sidereal_time: float | None = None
    tracking: bool = False
    slewing: bool = False
    at_home: bool = False
    at_park: bool = False
    side_of_pier: int | None = None  # 0=East, 1=West
    target_ra: float | None = None
    target_dec: float | None = None


class MountInfo(BaseModel):
    """Mostly-static mount properties, fetched once per connection.

    Capability flags are None when the mount didn't report them; clients
    should then treat the action as allowed and let the mount decide.
    """
    site_latitude: float | None = None    # degrees, +N
    site_longitude: float | None = None   # degrees, +E
    site_elevation: float | None = None   # metres
    can_slew_async: bool | None = None
    can_park: bool | None = None
    can_unpark: bool | None = None
    can_set_tracking: bool | None = None
    min_slew_altitude: float | None = None  # degrees; None = check disabled


class SlewRequest(BaseModel):
    right_ascension: float = Field(ge=0, lt=24)   # hours
    declination: float = Field(ge=-90, le=90)     # degrees


class TrackingRequest(BaseModel):
    enabled: bool


class CatalogEntry(BaseModel):
    name: str
    ra: float    # hours
    dec: float   # degrees
    magnitude: float
    object_type: str  # "star" | "messier"
