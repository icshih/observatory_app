from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from alpaca import create_client, close_client
from routes import router

DIST = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_client()
    yield
    await close_client()


app = FastAPI(title="Alpaca Control Panel", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


def mount_frontend(app: FastAPI, dist: Path) -> None:
    """Serve the built SPA from `dist`. Must be registered after API routes."""
    dist_root = dist.resolve()
    if (dist_root / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist_root / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        # Unknown API routes must 404 rather than fall through to the SPA.
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        # Resolve and confine to dist to prevent path traversal (e.g. ..%2F).
        file = (dist_root / full_path).resolve()
        if file.is_relative_to(dist_root) and file.is_file():
            return FileResponse(file)
        return FileResponse(dist_root / "index.html")


if DIST.exists():
    mount_frontend(app, DIST)
