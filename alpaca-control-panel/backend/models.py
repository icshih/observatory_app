from pydantic import BaseModel, Field


class MountStatus(BaseModel):
    connected: bool
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
