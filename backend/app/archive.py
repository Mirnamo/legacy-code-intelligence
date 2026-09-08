from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

MAX_ARCHIVE_BYTES = 15 * 1024 * 1024
MAX_FILES = 750
MAX_EXPANDED_BYTES = 40 * 1024 * 1024


class UnsafeArchive(ValueError):
    pass


def extract_safely(archive: Path, destination: Path) -> None:
    if archive.stat().st_size > MAX_ARCHIVE_BYTES:
        raise UnsafeArchive("Archive exceeds the 15 MB upload limit")
    with zipfile.ZipFile(archive) as bundle:
        entries = bundle.infolist()
        if len(entries) > MAX_FILES:
            raise UnsafeArchive("Archive contains too many files")
        if sum(entry.file_size for entry in entries) > MAX_EXPANDED_BYTES:
            raise UnsafeArchive("Expanded archive would exceed 40 MB")
        root = destination.resolve()
        for entry in entries:
            target = (destination / entry.filename).resolve()
            if root not in target.parents and target != root:
                raise UnsafeArchive("Archive contains an unsafe path")
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with bundle.open(entry) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)

