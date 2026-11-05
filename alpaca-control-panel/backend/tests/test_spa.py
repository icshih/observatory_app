"""SPA static serving: path-traversal guard and API 404 handling.

Uses a throwaway app + temporary dist/ so the tests don't depend on
`npm run build` having been run.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import main

INDEX = "<!doctype html><title>spa</title>"
SECRET = "TOP-SECRET"


@pytest.fixture
def spa(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text(INDEX)
    (dist / "favicon.svg").write_text("<svg/>")
    (dist / "assets" / "app.js").write_text("console.log('app')")
    # A sensitive file *outside* dist that traversal must not reach.
    (tmp_path / "secret.txt").write_text(SECRET)

    app = FastAPI()

    @app.get("/api/ping")
    async def ping():
        return {"pong": True}

    main.mount_frontend(app, dist)
    return TestClient(app)


def test_index_served_at_root(spa):
    r = spa.get("/")
    assert r.status_code == 200
    assert r.text == INDEX


def test_static_file_served(spa):
    r = spa.get("/favicon.svg")
    assert r.status_code == 200
    assert r.text == "<svg/>"


def test_assets_served(spa):
    r = spa.get("/assets/app.js")
    assert r.status_code == 200
    assert "app" in r.text


def test_unknown_route_falls_back_to_index(spa):
    r = spa.get("/some/client/route")
    assert r.status_code == 200
    assert r.text == INDEX


@pytest.mark.parametrize(
    "path",
    [
        "/..%2Fsecret.txt",
        "/%2E%2E%2Fsecret.txt",
        "/%2e%2e/secret.txt",
        "/foo/..%2F..%2Fsecret.txt",
        "/..%5Csecret.txt",
    ],
)
def test_path_traversal_blocked(spa, path):
    r = spa.get(path)
    assert SECRET not in r.text
    # Falls back to the SPA shell rather than erroring.
    assert r.status_code == 200
    assert r.text == INDEX


def test_absolute_path_blocked(spa, tmp_path):
    r = spa.get("/" + str(tmp_path / "secret.txt"))
    assert SECRET not in r.text


def test_real_api_route_still_works(spa):
    assert spa.get("/api/ping").json() == {"pong": True}


@pytest.mark.parametrize("path", ["/api", "/api/", "/api/does-not-exist", "/api/v1/x"])
def test_unknown_api_paths_404_json(spa, path):
    r = spa.get(path)
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")


def test_path_starting_with_api_but_not_api_dir_is_spa(spa):
    # "apixyz" is not under /api/ and should get the SPA shell.
    r = spa.get("/apixyz")
    assert r.status_code == 200
    assert r.text == INDEX
