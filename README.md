# Alpaca Control Panel

A browser-based mount control panel for ASCOM Alpaca telescopes.

```
Browser ↔ FastAPI (:8000) ↔ ASCOM Alpaca device (:32323)
```

## Requirements

- Python ≥ 3.13 with [uv](https://docs.astral.sh/uv/)
- Node.js ≥ 18
- An ASCOM Alpaca device or simulator running on port 32323

## Quick start (dev)

```bash
# 1. Backend
cd alpaca-control-panel
uv sync
uv run uvicorn backend.main:app --reload --port 8000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

## Production build

```bash
cd frontend
npm run build      # outputs frontend/dist/

# Backend then serves the built UI at http://localhost:8000
cd ..
uv run uvicorn backend.main:app --port 8000
```

## Configuration

| Env var         | Default     | Description              |
|-----------------|-------------|--------------------------|
| `ALPACA_HOST`   | `localhost` | Alpaca device host       |
| `ALPACA_PORT`   | `32323`     | Alpaca device port       |
| `DEVICE_NUMBER` | `0`         | Telescope device number  |

## Features

- Live mount status (RA/Dec, Alt/Az, LST, tracking, slew, park, pier side) polled every second
- Interactive sky chart: 50 bright stars + 30 Messier objects + constellation lines
- Stereographic projection auto-centred on local sidereal time — drag to pan, scroll to zoom, double-click to re-centre
- Click anywhere on the chart to read coordinates; click a catalog object to fill the slew form
- Manual slew (decimal or sexagesimal input), abort, tracking toggle, park/unpark
