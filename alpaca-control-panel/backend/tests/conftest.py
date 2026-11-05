"""Shared fixtures: an in-memory fake ASCOM Alpaca telescope and a TestClient
wired to it via httpx.MockTransport (no simulator or network required)."""
from urllib.parse import parse_qs

import httpx
import pytest
from fastapi.testclient import TestClient

import alpaca
import main


class FakeAlpaca:
    """Minimal fake of the Alpaca telescope device API.

    - ``values``      attribute → value returned by GET
    - ``errors``      attribute/action → (ErrorNumber, ErrorMessage) Alpaca error
    - ``http_errors`` attribute/action → (status_code, text body)
    - ``timeouts``    set of attributes/actions that raise a timeout
    - ``bad_json``    set of attributes/actions that return a non-JSON body
    - ``puts``        list of (action, form-params) received
    - ``gets``        list of (attribute, query-params) received
    """

    def __init__(self):
        self.values = {
            "connected": True,
            "name": "Fake Mount",
            "rightascension": 5.5,
            "declination": 10.0,
            "altitude": 45.0,
            "azimuth": 180.0,
            "siderealtime": 6.25,
            "tracking": True,
            "slewing": False,
            "athome": False,
            "atpark": False,
            "sideofpier": 1,
            "targetrightascension": 5.5,
            "targetdeclination": 10.0,
        }
        self.errors: dict[str, tuple[int, str]] = {}
        self.http_errors: dict[str, tuple[int, str]] = {}
        self.timeouts: set[str] = set()
        self.bad_json: set[str] = set()
        self.puts: list[tuple[str, dict[str, str]]] = []
        self.gets: list[tuple[str, dict[str, str]]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        name = request.url.path.rsplit("/", 1)[-1]

        if request.method == "GET":
            params = dict(request.url.params)
            self.gets.append((name, params))
        else:
            params = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
            self.puts.append((name, params))

        if name in self.timeouts:
            raise httpx.ReadTimeout("timed out", request=request)
        if name in self.http_errors:
            status, text = self.http_errors[name]
            return httpx.Response(status, text=text)
        if name in self.bad_json:
            return httpx.Response(200, text="<html>not json</html>")

        body = {
            "ClientTransactionID": int(params.get("ClientTransactionID", 0)),
            "ServerTransactionID": 1,
            "ErrorNumber": 0,
            "ErrorMessage": "",
        }
        if name in self.errors:
            body["ErrorNumber"], body["ErrorMessage"] = self.errors[name]
        elif request.method == "GET":
            if name not in self.values:
                body["ErrorNumber"], body["ErrorMessage"] = 1024, f"{name} not implemented"
            else:
                body["Value"] = self.values[name]
        return httpx.Response(200, json=body)

    def last_put(self, action: str) -> dict[str, str]:
        matches = [p for a, p in self.puts if a == action]
        assert matches, f"no PUT to {action!r}; got {[a for a, _ in self.puts]}"
        return matches[-1]


@pytest.fixture
def fake_alpaca(monkeypatch):
    fake = FakeAlpaca()

    def create_mock_client():
        alpaca._client = httpx.AsyncClient(transport=httpx.MockTransport(fake.handler))
        return alpaca._client

    # main.lifespan calls the name it imported, so patch it there.
    monkeypatch.setattr(main, "create_client", create_mock_client)
    return fake


@pytest.fixture
def client(fake_alpaca):
    with TestClient(main.app) as c:  # runs lifespan → mock client installed
        yield c
