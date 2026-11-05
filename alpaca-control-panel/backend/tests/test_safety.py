"""Slew altitude guard (safety.py) and GET /api/mount/info.

The fake mount is at latitude 48.8° with LST 6.25h, so a target on the
meridian (RA 6.25h) has altitude 90° − |48.8° − Dec|.
"""
import pytest
from fastapi.testclient import TestClient

import main
import safety

LAT, LST = 48.8, 6.25


# ── altitude() ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "ra, dec, expected",
    [
        (LST, LAT, 90.0),               # zenith
        (LST, LAT - 90, 0.0),           # due south on the horizon
        (LST + 12, 90 - LAT, 0.0),      # due north on the horizon (lower meridian)
        (LST, 0.0, 90 - LAT),           # equator on the meridian
        (12.0, 90.0, LAT),              # celestial pole: altitude = latitude, any RA
        (LST + 12, 0.0, -(90 - LAT)),   # equator on the lower meridian
        (LST + 6, 0.0, 0.0),            # equator rising in the east
        (LST - 6, 0.0, 0.0),            # equator setting in the west
    ],
)
def test_altitude(ra, dec, expected):
    assert safety.altitude(ra, dec, LAT, LST) == pytest.approx(expected, abs=1e-9)


def test_altitude_southern_hemisphere():
    # From −33.9° the south celestial pole is at +33.9° altitude.
    assert safety.altitude(0, -90, -33.9, 5) == pytest.approx(33.9)


def test_altitude_is_periodic_in_ra():
    assert safety.altitude(1, 20, LAT, LST) == pytest.approx(safety.altitude(25, 20, LAT, LST))


# ── MIN_SLEW_ALTITUDE parsing ──────────────────────────────────────────────

def test_min_slew_altitude_default(monkeypatch):
    monkeypatch.delenv("MIN_SLEW_ALTITUDE", raising=False)
    assert safety.min_slew_altitude() == 10.0


@pytest.mark.parametrize("raw, expected", [("15", 15.0), ("0", 0.0), ("-5.5", -5.5), (" 20 ", 20.0)])
def test_min_slew_altitude_values(monkeypatch, raw, expected):
    monkeypatch.setenv("MIN_SLEW_ALTITUDE", raw)
    assert safety.min_slew_altitude() == expected


@pytest.mark.parametrize("raw", ["off", "OFF", "none", "", "false", "disabled"])
def test_min_slew_altitude_disabled(monkeypatch, raw):
    monkeypatch.setenv("MIN_SLEW_ALTITUDE", raw)
    assert safety.min_slew_altitude() is None


@pytest.mark.parametrize("raw", ["ten", "91", "-90.5", "10deg"])
def test_min_slew_altitude_invalid(monkeypatch, raw):
    monkeypatch.setenv("MIN_SLEW_ALTITUDE", raw)
    with pytest.raises(ValueError, match="MIN_SLEW_ALTITUDE"):
        safety.min_slew_altitude()


def test_invalid_config_fails_at_startup(monkeypatch, fake_alpaca):
    monkeypatch.setenv("MIN_SLEW_ALTITUDE", "ten")
    with pytest.raises(ValueError, match="MIN_SLEW_ALTITUDE"):
        with TestClient(main.app):
            pass


# ── POST /api/slew altitude guard ──────────────────────────────────────────

def slew(client, ra, dec):
    return client.post("/api/slew", json={"right_ascension": ra, "declination": dec})


def test_slew_below_horizon_refused(client, fake_alpaca):
    r = slew(client, (LST + 12) % 24, 0.0)  # −41.2°
    assert r.status_code == 409
    assert "-41.2°" in r.json()["detail"]
    assert "minimum slew altitude of 10°" in r.json()["detail"]
    assert not fake_alpaca.puts  # never reached the mount


def test_slew_just_below_limit_refused(client, fake_alpaca):
    # On the meridian, alt = 90 − (48.8 − dec) → dec −31.4 gives 9.8°.
    assert slew(client, LST, -31.4).status_code == 409
    assert not fake_alpaca.puts


def test_slew_just_above_limit_allowed(client, fake_alpaca):
    assert slew(client, LST, -31.0).status_code == 200  # 10.2°
    assert fake_alpaca.last_put("slewtocoordinatesasync")


def test_slew_limit_is_configurable(client, fake_alpaca, monkeypatch):
    monkeypatch.setenv("MIN_SLEW_ALTITUDE", "30")
    # On the meridian: Dec −5° → 36.2° (allowed), Dec −15° → 26.2° (refused).
    assert slew(client, LST, -5).status_code == 200
    assert slew(client, LST, -15).status_code == 409


def test_slew_guard_can_be_disabled(client, fake_alpaca, monkeypatch):
    monkeypatch.setenv("MIN_SLEW_ALTITUDE", "off")
    assert slew(client, (LST + 12) % 24, 0.0).status_code == 200
    # No LST/latitude lookups needed when disabled.
    assert not {"siderealtime", "sitelatitude"} & {a for a, _ in fake_alpaca.gets}


def test_slew_uses_mount_latitude(client, fake_alpaca):
    # Same target, southern-hemisphere mount → the target is now well up.
    fake_alpaca.values["sitelatitude"] = -33.9
    assert slew(client, LST, -60).status_code == 200


@pytest.mark.parametrize(
    "setup",
    [
        lambda f: f.errors.__setitem__("sitelatitude", (1024, "SiteLatitude not implemented")),
        lambda f: f.timeouts.add("siderealtime"),
        lambda f: f.values.__setitem__("sitelatitude", None),
    ],
    ids=["latitude-not-implemented", "lst-timeout", "latitude-null"],
)
def test_slew_fails_closed_when_altitude_unverifiable(client, fake_alpaca, setup):
    setup(fake_alpaca)
    r = slew(client, LST, LAT)  # zenith — would be fine if we could check
    assert r.status_code == 502
    assert r.json()["detail"].startswith("Cannot verify target altitude")
    assert not fake_alpaca.puts


# ── GET /api/mount/info ────────────────────────────────────────────────────

def test_mount_info(client, monkeypatch):
    monkeypatch.delenv("MIN_SLEW_ALTITUDE", raising=False)
    r = client.get("/api/mount/info")
    assert r.status_code == 200
    assert r.json() == {
        "site_latitude": 48.8,
        "site_longitude": 2.35,
        "site_elevation": 35.0,
        "can_slew_async": True,
        "can_park": True,
        "can_unpark": True,
        "can_set_tracking": True,
        "min_slew_altitude": 10.0,
    }


def test_mount_info_reports_limitations(client, fake_alpaca):
    fake_alpaca.values.update(canpark=False, canunpark=False, cansettracking=False)
    body = client.get("/api/mount/info").json()
    assert body["can_park"] is False
    assert body["can_unpark"] is False
    assert body["can_set_tracking"] is False
    assert body["can_slew_async"] is True


def test_mount_info_unknown_values_are_null(client, fake_alpaca):
    # Not implemented / failing / wrong type → null, never a 500.
    fake_alpaca.errors["sitelatitude"] = (1024, "not implemented")
    fake_alpaca.timeouts.add("canpark")
    fake_alpaca.values["sitelongitude"] = "east"
    fake_alpaca.values["canunpark"] = 1  # not a real bool
    body = client.get("/api/mount/info").json()
    assert body["site_latitude"] is None
    assert body["site_longitude"] is None
    assert body["can_park"] is None
    assert body["can_unpark"] is None
    assert body["can_set_tracking"] is True


def test_mount_info_reports_disabled_limit(client, monkeypatch):
    monkeypatch.setenv("MIN_SLEW_ALTITUDE", "off")
    assert client.get("/api/mount/info").json()["min_slew_altitude"] is None
