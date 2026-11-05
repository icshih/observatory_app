# ASCOM Alpaca Mount Control Panel

A browser-based mount control panel for ASCOM Alpaca telescopes.

```
Browser ↔ FastAPI (:8000) ↔ ASCOM Alpaca device (:32323)
```

Single-process in production: FastAPI serves the API **and** `frontend/dist/` static files. During development, Vite (:5173) proxies `/api` → FastAPI (:8000).

## Requirements

- Python ≥ 3.14 with [uv](https://docs.astral.sh/uv/)
- Node.js ≥ 18
- An ASCOM Alpaca device or simulator running on port 32323

## ASCOM Alpaca simulator

Simulator can be launched from `ascom.alpaca.simulators.macos-arm64/`

```bash
./ascom.alpaca.simulators
```

## Commands

The backend is a self-contained uv project in `alpaca-control-panel/backend/`
(its own `pyproject.toml`, `uv.lock`, `.venv`). Modules use flat imports
(`from alpaca import …`), so backend commands must be run **from `backend/`**.

```bash
# ── Backend (from alpaca-control-panel/backend/) ──
uv sync                                          # install Python deps
uv run uvicorn main:app --reload --port 8000     # run backend (dev, with reload)
uv run python fetch_catalog.py                   # populate star/Messier CSVs (run once)
uv run pytest                                    # run backend tests

# ── Frontend (from alpaca-control-panel/frontend/) ──
npm install

# Run frontend dev server (proxies /api → :8000)
npm run dev        # http://localhost:5173

# Build frontend for production
npm run build      # outputs frontend/dist/
# Backend then serves the built UI at http://localhost:8000

# Run frontend tests
npm test           # vitest run (npm run test:watch for watch mode)
```

## Tests

CI (`.github/workflows/ci.yml`) runs both suites plus `npm run build` on every push to `main` and on PRs.

- **Backend** (`backend/tests/`, pytest): no simulator needed — `conftest.py` provides a `FakeAlpaca` device served through `httpx.MockTransport` (patched in via `main.create_client`). Set `fake_alpaca.values / errors / http_errors / timeouts / refused / bad_json` to script device behaviour; inspect `fake_alpaca.puts / gets`. SPA tests build a temp `dist/` and call `main.mount_frontend(app, dist)`. `stars.csv` is gitignored, so the real-data catalog test is skipped in CI. An autouse fixture clears `MIN_SLEW_ALTITUDE` so tests always see the 10° default; the fake mount sits at 48.8°N with LST 6.25h.
- **Frontend** (`src/lib/*.test.js`, vitest): pure-function tests for `format.js`, `projection.js`, `horizon.js`, `safety.js`, `connection.js` (horizon points are checked against an independent altitude formula; `safety.js` boundaries match the backend's).

## Configuration

| Env var              | Default     | Description                          |
|----------------------|-------------|--------------------------------------|
| `ALPACA_HOST`        | `localhost` | Alpaca device host                   |
| `ALPACA_PORT`        | `32323`     | Alpaca device port                   |
| `DEVICE_NUMBER`      | `0`         | Telescope device number              |
| `MIN_SLEW_ALTITUDE`  | `10`        | Minimum target altitude (degrees) for `/api/slew`; `off` disables. Invalid values fail at startup. |
| `VITE_OBSERVER_LATITUDE` | `48.8`  | **Fallback** observer latitude (frontend), used only if the mount doesn't report `SiteLatitude` |

## Key files

| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app. SPA fallback serves files from `frontend/dist/` — paths are resolved and confined to `dist/` (path-traversal guard); unknown `/api/*` paths return 404. |
| `backend/alpaca.py` | Shared `httpx.AsyncClient` + `alpaca_get` / `alpaca_put` helpers. Reads `ALPACA_HOST`, `ALPACA_PORT`, `DEVICE_NUMBER`. Raises `AlpacaUnreachableError` (timeout → 504, connection failure → 502) or `AlpacaError` (device answered with an error → 502). HTTP error bodies are included in `detail`; ASCOM error numbers are translated (`ASCOM_ERRORS`, e.g. 1032 → "not allowed while the mount is parked") because devices often send only the method name. |
| `backend/routes.py` | All `/api/*` endpoints. Status route uses `asyncio.gather` for 13 concurrent Alpaca attribute fetches and reports `reachable`/`error`. |
| `backend/safety.py` | `altitude()`, `min_slew_altitude()` (parses `MIN_SLEW_ALTITUDE`), `check_slew_target()` — server-side slew guard using the mount's own LST + site latitude. **Fails closed**: if they can't be read the slew is refused. |
| `backend/catalog.py` | Loads stars from `backend/data/stars.csv` (HYG v4.1, mag ≤ 6.5, ~8.9k stars; the Sun is excluded). Names: proper name → Bayer/Flamsteed (e.g. `α¹ Cru`, `19 Ori`) → `HIP n`. Messier from `backend/data/messier.csv`. Falls back to hardcoded 50-star list if CSVs are absent. Constellation lines defined as Hipparcos ID pairs; resolved to list indices at startup. |
| `backend/fetch_catalog.py` | One-shot script to populate `backend/data/`: downloads HYG v4.1 from GitHub, filters to mag ≤ 6.5 (excluding the Sun), writes `stars.csv`; also writes `messier.csv`. |
| `frontend/src/lib/projection.js` | Stereographic projection (`raDecToXY` / `xyToRADec`). RA in hours, Dec in degrees. |
| `frontend/src/lib/format.js` | `formatRA`, `formatDec`, `parseRA`, `parseDec` — parse both decimal and sexagesimal. Parsers are strict: invalid input returns `null` (never silently 0). Formatters round the total before splitting so `60s` can't appear. |
| `frontend/src/lib/api.js` | `apiPost(path, body)` — throws an `Error` with the backend's `detail` on non-2xx. Commands go through `runCommand(name, path, body)` in `App.jsx`, which allows one command at a time (others disabled, label shows e.g. "Slewing…") — **except abort, which is never blocked**. Failures surface as a "Command failed" toast. |
| `frontend/src/lib/safety.js` | `altitudeOf`, `checkSlewTarget` (live altitude preview + blocks below-limit slews in the UI), `effectiveLatitude` (mount site latitude → env fallback), `supports(mountInfo, flag)` (unknown capability = allowed). |
| `frontend/src/lib/connection.js` | `connectionState(status)` → `unknown` / `unreachable` / `disconnected` / `connected` for the status badge. |
| `frontend/src/lib/horizon.js` | `getHorizonPoints(lat, lst, steps=120)` — exact alt-az→equatorial transform for alt=0°. `drawHorizon` renders the dashed red horizon on the canvas. |
| `frontend/src/components/CelestialChart.jsx` | Canvas sky map. Chart auto-centres on LST until user drags; double-click resets. `stateRef` holds pan/zoom/centre state between renders. |

## File structure

```
alpaca-control-panel/
├── backend/
│   ├── pyproject.toml   # backend uv project (deps, Python pin)
│   ├── uv.lock
│   ├── main.py          # FastAPI app, lifespan, static file mount
│   ├── alpaca.py        # Alpaca HTTP client helpers
│   ├── routes.py        # /api/* endpoints
│   ├── models.py        # Pydantic models (MountStatus, SlewRequest, …)
│   ├── catalog.py       # Stars, Messier objects, constellation lines
│   ├── safety.py        # Slew altitude guard (MIN_SLEW_ALTITUDE)
│   ├── fetch_catalog.py # One-shot catalog downloader
│   ├── data/            # stars.csv, messier.csv (generated)
│   └── tests/           # pytest suite (conftest.py: FakeAlpaca)
└── frontend/
    ├── vite.config.js   # Proxy /api → :8000
    └── src/
        ├── App.jsx
        ├── styles.css
        ├── hooks/
        │   ├── useMountStatus.js   # Polls /api/status every 1 s (skips a tick while a request is in flight; 8 s timeout)
        │   ├── useMountInfo.js     # Fetches /api/mount/info on each connect
        │   └── useCatalog.js       # Fetches /api/catalog once
        ├── components/
        │   ├── StatusPanel.jsx     # Left sidebar: RA/Dec, Alt/Az, LST, …
        │   ├── CelestialChart.jsx  # Canvas sky map
        │   ├── CommandPanel.jsx    # Slew form, abort, tracking, park
        │   └── ObjectPicker.jsx    # Catalog search + slew shortcut
        └── lib/
            ├── projection.js       # Stereographic projection
            ├── format.js           # RA/Dec formatting & parsing
            ├── api.js              # apiPost helper with error reporting
            ├── safety.js           # Altitude check, site latitude, capabilities
            ├── connection.js       # Connection state classification
            ├── horizon.js          # Horizon transform & drawing
            └── *.test.js           # vitest unit tests
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Returns `MountStatus` (13 attrs via `asyncio.gather`) plus `reachable` (false = device can't be reached at all) and `error` |
| `GET` | `/api/mount/info` | Returns `MountInfo`: site lat/lon/elevation, `can_slew_async` / `can_park` / `can_unpark` / `can_set_tracking` (null = unknown), `min_slew_altitude`. Fetched once per connection, not polled. |
| `POST` | `/api/connect` / `/api/disconnect` | Toggle connection |
| `POST` | `/api/slew` | Accepts `SlewRequest` (RA hours `0 ≤ ra < 24`, Dec degrees `−90 ≤ dec ≤ 90`; 422 otherwise). **409** if the target is below `MIN_SLEW_ALTITUDE`; **502** if altitude can't be verified. |
| `POST` | `/api/abort` | Abort current slew |
| `POST` | `/api/tracking` | Accepts `TrackingRequest` (enabled bool) |
| `POST` | `/api/park` / `/api/unpark` | Park commands |
| `GET` | `/api/catalog` | Stars, Messier objects, constellation lines |

## pyproject.toml note

`backend/pyproject.toml` has no `[build-system]` — the backend is run as a plain
script directory, not installed as a package. Keep imports flat (`from alpaca import …`)
unless the project is restructured into an installable package.

## Important behaviours

- `alpaca_get_safe` swallows errors and returns a default — used in the status batch so one failed attribute doesn't break the whole status response.
- The canvas in `CelestialChart` is sized in CSS pixels; pixel ratio scaling is applied once in the `ResizeObserver` callback. Don't call `ctx.scale` outside that callback, and in `draw()`/hit-testing always use `canvas.clientWidth/clientHeight` (CSS px), never `canvas.width/height` (device px).
- Long-lived canvas listeners (`ResizeObserver`, wheel) call `drawRef.current()` so they aren't re-registered on every status poll. Wheel zoom is a native `{ passive: false }` listener because React's `onWheel` is passive and can't `preventDefault()`.
- Pan/click use pointer events with pointer capture; a click is a pointerup within 4 px of the pointerdown position.
- `draggedRef` tracks whether the user has manually panned the chart; when `false` the chart auto-follows LST updates from the status poll.
- Observer latitude comes from the mount (`SiteLatitude` via `/api/mount/info`). Only if the mount doesn't report it does the chart fall back to `VITE_OBSERVER_LATITUDE` (default 48.8°); the Site panel marks this as "(default)".
- Slew altitude limit is enforced twice: the UI previews altitude and disables Slew below the limit (`checkSlewTarget`), and the backend refuses with 409 regardless of client. Both use `sin(alt) = sinφ·sinδ + cosφ·cosδ·cos(LST − RA)`.
- Capabilities: buttons are disabled only when the mount explicitly reports `false`; unknown (`null`) is treated as supported so the mount can decide.
- Horizon is drawn using an exact spherical-astronomy transform in `horizon.js`: `Dec = arcsin(cos(φ)·cos(A))`, `H = atan2(−sin(A), −sin(φ)·cos(A))`, `RA = LST − H`.
- `CONSTELLATION_LABELS` in `CelestialChart.jsx` is a static array of `{name, ra, dec}` for the 10 constellations present in the catalog; labels render at `scale > 150`.

## Frontend sky chart reference

### Projection (`projection.js`)

Stereographic projection centred on `(centerRA, centerDec)`:

```
k  = (2 * scale) / (1 + sinφ0·sinφ + cosφ0·cosφ·cosΔλ)
x  = -k · cosφ · sin(Δλ)
y  = -k · (cosφ0·sinφ − sinφ0·cosφ·cosΔλ)
```

Inverse (`xyToRADec`):
```
ρ  = sqrt(x² + y²)
c  = 2 · atan2(ρ, 2·scale)
φ  = asin(cos(c)·sinφ0 + (y·sin(c)·cosφ0) / ρ)
Δλ = atan2(x·sin(c), ρ·cosφ0·cos(c) − y·sinφ0·sin(c))
```

### Magnitude to radius

```js
radius = max(1, 5 - (mag + 1.5) * (4 / 7.5))
```

### Canvas rendering order

1. RA/Dec grid (every 1 h RA, every 15° Dec) — faint dashed gray
2. Horizon — dashed red line
3. Constellation lines — semi-transparent blue `rgba(31,65,100,0.5)`
4. Stars — warm-white circles, sized by magnitude
5. Messier objects — cyan diamonds
6. Mount crosshair — orange with glow
7. Target indicator — dashed cyan circle (during slew)
8. Labels — shown at sufficient zoom level

### User interactions

| Action | Behaviour |
|--------|-----------|
| Drag | Pan (`offsetX`, `offsetY` in `stateRef`) |
| Scroll | Zoom (scale clamped to `MIN_SCALE=80` … `MAX_SCALE=2000`) |
| Click | Read coordinates via `xyToRADec`, show tooltip |
| Double-click | Reset pan/zoom, re-centre on LST |
| Catalog click | Fill slew form via `fillFromObject` |

### Theme

Dark observatory aesthetic — background `#0a0e17`, panels `#111827`, amber accent `#f59e0b`, cyan deep-sky `#06b6d4`. Monospaced coordinates in JetBrains Mono; headings in Oxanium.
