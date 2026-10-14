"""Serve the built dashboard and API from one public origin."""
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from .main import app

static_dir = Path(__file__).resolve().parents[2] / "frontend" / "dist"
app.mount("/", StaticFiles(directory=static_dir, html=True), name="dashboard")
