import zipfile
from pathlib import Path

import pytest

from app.archive import UnsafeArchive, extract_safely


def test_rejects_path_traversal(tmp_path: Path):
    archive = tmp_path / "unsafe.zip"
    with zipfile.ZipFile(archive, "w") as bundle:
        bundle.writestr("../escape.py", "print('no')")
    with pytest.raises(UnsafeArchive):
        extract_safely(archive, tmp_path / "out")

