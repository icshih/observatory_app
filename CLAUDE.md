# CLAUDE.md

Project documentation lives in [README.md](README.md) — read it first. It covers
architecture, commands, configuration, API endpoints, tests and important behaviours.

Quick reminders:

- Backend commands run from `alpaca-control-panel/backend/` (flat imports, own uv project);
  frontend commands from `alpaca-control-panel/frontend/`.
- Run tests before committing: `uv run pytest` (backend) and `npm test` (frontend).
- Never weaken the slew safety checks (`backend/safety.py`, `frontend/src/lib/safety.js`)
  or block the Abort button.
- Keep README.md up to date when changing behaviour, endpoints or configuration.
