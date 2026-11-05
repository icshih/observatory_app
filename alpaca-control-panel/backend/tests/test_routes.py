"""/api/* endpoint behaviour against the fake Alpaca device."""
import pytest


# ── /api/status ────────────────────────────────────────────────────────────

def test_status_connected_maps_all_attributes(client):
    r = client.get("/api/status")
    assert r.status_code == 200
    assert r.json() == {
        "connected": True,
        "reachable": True,
        "error": None,
        "name": "Fake Mount",
        "right_ascension": 5.5,
        "declination": 10.0,
        "altitude": 45.0,
        "azimuth": 180.0,
        "sidereal_time": 6.25,
        "tracking": True,
        "slewing": False,
        "at_home": False,
        "at_park": False,
        "side_of_pier": 1,
        "target_ra": 5.5,
        "target_dec": 10.0,
    }


def test_status_disconnected_skips_attribute_fetches(client, fake_alpaca):
    fake_alpaca.values["connected"] = False
    r = client.get("/api/status")
    assert r.status_code == 200
    assert r.json()["connected"] is False
    assert [a for a, _ in fake_alpaca.gets] == ["connected"]


def test_status_disconnected_is_still_reachable(client, fake_alpaca):
    fake_alpaca.values["connected"] = False
    body = client.get("/api/status").json()
    assert body["reachable"] is True
    assert body["error"] is None


@pytest.mark.parametrize("failure", ["timeouts", "refused"])
def test_status_device_unreachable(client, fake_alpaca, failure):
    getattr(fake_alpaca, failure).add("connected")
    r = client.get("/api/status")
    assert r.status_code == 200
    body = r.json()
    assert body["connected"] is False
    assert body["reachable"] is False
    assert body["error"]


def test_status_device_error_is_reachable_but_disconnected(client, fake_alpaca):
    # The device answered, just with an error → it is reachable.
    fake_alpaca.errors["connected"] = (1031, "Driver not initialised")
    body = client.get("/api/status").json()
    assert body["connected"] is False
    assert body["reachable"] is True
    assert body["error"] == "Driver not initialised: mount not connected (Alpaca error 1031)"


def test_status_device_http_error_is_reachable(client, fake_alpaca):
    fake_alpaca.http_errors["connected"] = (500, "boom")
    body = client.get("/api/status").json()
    assert body["reachable"] is True
    assert "boom" in body["error"]


def test_status_one_failing_attribute_does_not_break_status(client, fake_alpaca):
    # e.g. target RA is unset before the first slew → Alpaca error 1026.
    fake_alpaca.errors["targetrightascension"] = (1026, "Target RA not set")
    fake_alpaca.http_errors["altitude"] = (500, "driver crashed")
    r = client.get("/api/status")
    assert r.status_code == 200
    body = r.json()
    assert body["target_ra"] is None
    assert body["altitude"] is None
    assert body["right_ascension"] == 5.5  # others unaffected


# ── Commands ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "path, action, expected",
    [
        ("/api/connect", "connected", {"Connected": "true"}),
        ("/api/disconnect", "connected", {"Connected": "false"}),
        ("/api/abort", "abortslew", {}),
        ("/api/park", "park", {}),
        ("/api/unpark", "unpark", {}),
    ],
)
def test_simple_commands_put_to_device(client, fake_alpaca, path, action, expected):
    r = client.post(path)
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    params = fake_alpaca.last_put(action)
    for k, v in expected.items():
        assert params[k].lower() == v
    assert params["ClientID"] == "1"
    assert "ClientTransactionID" in params


@pytest.mark.parametrize("enabled, sent", [(True, "true"), (False, "false")])
def test_tracking_command(client, fake_alpaca, enabled, sent):
    r = client.post("/api/tracking", json={"enabled": enabled})
    assert r.status_code == 200
    assert fake_alpaca.last_put("tracking")["Tracking"].lower() == sent


def test_slew_sends_coordinates(client, fake_alpaca):
    r = client.post("/api/slew", json={"right_ascension": 5.9194, "declination": -16.7161})
    assert r.status_code == 200
    params = fake_alpaca.last_put("slewtocoordinatesasync")
    assert float(params["RightAscension"]) == pytest.approx(5.9194)
    assert float(params["Declination"]) == pytest.approx(-16.7161)


@pytest.mark.parametrize(
    "body",
    [
        {"right_ascension": 24, "declination": 0},
        {"right_ascension": -0.1, "declination": 0},
        {"right_ascension": 5, "declination": 90.01},
        {"right_ascension": 5, "declination": -91},
        {"right_ascension": "abc", "declination": 0},
        {"declination": 0},
    ],
)
def test_slew_rejects_invalid_coordinates(client, fake_alpaca, body):
    r = client.post("/api/slew", json=body)
    assert r.status_code == 422
    assert not fake_alpaca.puts  # never reaches the mount


@pytest.mark.parametrize("ra, dec", [(0, -90), (23.9999, 90)])
def test_slew_accepts_boundary_coordinates(client, monkeypatch, ra, dec):
    # Range validation only — disable the altitude guard (Dec −90 is below
    # the horizon from the fake mount's 48.8°N site).
    monkeypatch.setenv("MIN_SLEW_ALTITUDE", "off")
    r = client.post("/api/slew", json={"right_ascension": ra, "declination": dec})
    assert r.status_code == 200


def test_transaction_ids_increase(client, fake_alpaca):
    client.post("/api/park")
    client.post("/api/unpark")
    ids = [int(p["ClientTransactionID"]) for _, p in fake_alpaca.puts]
    assert ids == sorted(ids) and len(set(ids)) == len(ids)


# ── /api/catalog ───────────────────────────────────────────────────────────

def test_catalog_shape(client):
    r = client.get("/api/catalog")
    assert r.status_code == 200
    data = r.json()
    assert set(data) == {"stars", "messier", "constellation_lines"}
    assert data["stars"] and data["messier"]
    for entry in data["stars"][:5] + data["messier"][:5]:
        assert set(entry) == {"name", "ra", "dec", "magnitude", "object_type"}
        assert 0 <= entry["ra"] < 24
        assert -90 <= entry["dec"] <= 90
    assert {e["object_type"] for e in data["stars"]} == {"star"}
    assert {e["object_type"] for e in data["messier"]} == {"messier"}
    n = len(data["stars"])
    for i, j in data["constellation_lines"]:
        assert 0 <= i < n and 0 <= j < n
