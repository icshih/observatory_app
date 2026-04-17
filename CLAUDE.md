# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

```
Browser ↔ FastAPI (:8000) ↔ ASCOM Alpaca Simulator (:32323)
```

Single-process in production: FastAPI serves the API **and** `frontend/dist/` static files. During development, Vite (:5173) proxies `/api` → FastAPI (:8000).

## Commands

All commands must be run from the `alpaca-control-panel/` directory.

```bash
# Install Python deps (requires uv)
uv sync

# Run backend (dev, with reload)
uv run uvicorn backend.main:app --reload --port 8000

# Install frontend deps
cd frontend && npm install

# Run frontend dev server (proxies /api → :8000)
npm run dev

# Build frontend for production
npm run build          # output: frontend/dist/
```

## Key files

| File | Purpose |
|------|---------|
| `backend/alpaca.py` | Shared `httpx.AsyncClient` + `alpaca_get` / `alpaca_put` helpers. Env vars: `ALPACA_HOST`, `ALPACA_PORT`, `DEVICE_NUMBER`. |
| `backend/routes.py` | All `/api/*` endpoints. Status route uses `asyncio.gather` for 13 concurrent Alpaca attribute fetches. |
| `backend/catalog.py` | ~50 stars + ~30 Messier objects as plain Python lists. Constellation lines are index pairs into the `STARS` list. |
| `frontend/src/lib/projection.js` | Stereographic projection (`raDecToXY` / `xyToRADec`). RA in hours, Dec in degrees. |
| `frontend/src/lib/format.js` | `formatRA`, `formatDec`, `parseRA`, `parseDec` — parse both decimal and sexagesimal. |
| `frontend/src/lib/horizon.js` | `getHorizonPoints(lat, lst, steps=120)` — exact alt-az→equatorial transform for alt=0°. `drawHorizon` renders the dashed red horizon on the canvas. |
| `frontend/src/components/CelestialChart.jsx` | Canvas sky map. Chart auto-centres on LST until user drags; double-click resets. `stateRef` holds pan/zoom/centre state between renders. |

## pyproject.toml note

Hatchling requires an explicit `packages` entry because the source directory is named `backend`, not the project name. This is already set:

```toml
[tool.hatch.build.targets.wheel]
packages = ["backend"]
```

Do not remove this — `uv sync` will fail without it.

## Important behaviours

- `alpaca_get_safe` swallows errors and returns a default — used in the status batch so one failed attribute doesn't break the whole status response.
- The canvas in `CelestialChart` is sized in CSS pixels; pixel ratio scaling is applied once in the `ResizeObserver` callback. Don't call `ctx.scale` outside that callback.
- `draggedRef` tracks whether the user has manually panned the chart; when `false` the chart auto-follows LST updates from the status poll.
- Observer latitude defaults to 48.8° (Paris) but is overridable via `VITE_OBSERVER_LATITUDE` env var in `frontend/.env`.
- Horizon is drawn using an exact spherical-astronomy transform in `horizon.js`: `Dec = arcsin(cos(φ)·cos(A))`, `H = atan2(−sin(A), −sin(φ)·cos(A))`, `RA = LST − H`. Pass the chart's `centerRA` as LST.
- `CONSTELLATION_LABELS` in `CelestialChart.jsx` is a static array of `{name, ra, dec}` for the 10 constellations present in the catalog; labels render at `scale > 150`.
