from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .analyzer import analyze_directory
from .archive import UnsafeArchive, extract_safely
from .models import Report

app = FastAPI(title="Legacy Code Intelligence", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["GET", "POST"], allow_headers=["*"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/demo", response_model=Report)
def demo() -> Report:
    return analyze_directory(Path(__file__).parent.parent / "demo", "Atlas Billing (demo)")


@app.post("/api/analyze", response_model=Report)
async def analyze(file: UploadFile = File(...)) -> Report:
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(415, "Upload a ZIP archive")
    with tempfile.TemporaryDirectory(prefix="lci-") as temp:
        workspace = Path(temp)
        archive = workspace / "upload.zip"
        with archive.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                output.write(chunk)
                if output.tell() > 15 * 1024 * 1024:
                    raise HTTPException(413, "Archive exceeds the 15 MB upload limit")
        source = workspace / "source"
        try:
            extract_safely(archive, source)
        except (UnsafeArchive, zipfile.BadZipFile) as exc:
            raise HTTPException(400, str(exc)) from exc
        finally:
            await file.close()
        return analyze_directory(source, Path(file.filename).stem)
