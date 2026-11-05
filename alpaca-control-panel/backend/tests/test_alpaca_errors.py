"""Mapping of Alpaca/HTTP failures to API errors (via the command endpoints)."""
import pytest

import alpaca


def test_alpaca_error_number_becomes_502_with_message(client, fake_alpaca):
    fake_alpaca.errors["slewtocoordinatesasync"] = (
        1025, "SlewToCoordinatesAsync set - '25' is an invalid value.",
    )
    r = client.post("/api/slew", json={"right_ascension": 5, "declination": 0})
    assert r.status_code == 502
    assert "'25' is an invalid value" in r.json()["detail"]


def test_alpaca_error_without_message_has_fallback(client, fake_alpaca):
    fake_alpaca.errors["park"] = (1035, "")
    r = client.post("/api/park")
    assert r.status_code == 502
    # Devices may send an empty ErrorMessage; the detail must still be useful.
    assert r.json()["detail"] == "Invalid operation (Alpaca error 1035)"


def test_http_error_includes_device_body(client, fake_alpaca):
    fake_alpaca.http_errors["park"] = (400, "Park is not supported by this mount")
    r = client.post("/api/park")
    assert r.status_code == 502
    detail = r.json()["detail"]
    assert "park" in detail
    assert "HTTP 400" in detail
    assert "Park is not supported by this mount" in detail


def test_http_error_with_empty_body(client, fake_alpaca):
    fake_alpaca.http_errors["unpark"] = (500, "")
    r = client.post("/api/unpark")
    assert r.status_code == 502
    assert r.json()["detail"] == "unpark: HTTP 500"


def test_timeout_becomes_504(client, fake_alpaca):
    fake_alpaca.timeouts.add("abortslew")
    r = client.post("/api/abort")
    assert r.status_code == 504
    assert "abortslew" in r.json()["detail"]


def test_invalid_json_becomes_502(client, fake_alpaca):
    fake_alpaca.bad_json.add("park")
    r = client.post("/api/park")
    assert r.status_code == 502
    assert "invalid JSON" in r.json()["detail"]


def test_parked_error_is_explained(client, fake_alpaca):
    # Real ASCOM simulator response when slewing while parked: the message
    # is only the method name, the meaning is in ErrorNumber 1032 (0x408).
    fake_alpaca.errors["slewtocoordinatesasync"] = (1032, "SlewToCoordinatesAsync")
    r = client.post("/api/slew", json={"right_ascension": 6.25, "declination": 48.8})
    assert r.status_code == 502
    assert r.json()["detail"] == (
        "SlewToCoordinatesAsync: not allowed while the mount is parked (Alpaca error 1032)"
    )


@pytest.mark.parametrize(
    "code, message, expected",
    [
        (0x400, "", "Not implemented by this mount (Alpaca error 1024)"),
        (0x407, None, "Mount not connected (Alpaca error 1031)"),
        (0x408, "Park", "Park: not allowed while the mount is parked (Alpaca error 1032)"),
        (0x500, "Motor stalled", "Motor stalled: driver error (Alpaca error 1280)"),
        (0x6FF, "", "Driver error (Alpaca error 1791)"),
        (9999, "Custom failure", "Custom failure"),
        (9999, "", "Alpaca error 9999"),
    ],
)
def test_format_alpaca_error(code, message, expected):
    assert alpaca._format_alpaca_error(code, message) == expected
