import io
import stat
import zipfile

from fastapi.testclient import TestClient
from app.main import app


def bundle(files):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        for path, content in files.items():
            archive.writestr(path, content)
    return stream.getvalue()


def test_real_zip_returns_complexity_docs_and_impact():
    with TestClient(app) as client:
        response = client.post("/api/analyze", files={"file": ("project.zip", bundle({"project/core.py": "def core(x):\n    if x:\n        return 1\n    return 0", "project/api.py": "import core"}), "application/zip")})
    assert response.status_code == 200
    report = response.json()
    assert report["summary"]["files"] == 2
    assert "core.py" in report["documentation"]
    core = next(m for m in report["change_impact"]["modules"] if m["changed_file"] == "core.py")
    assert core["affected_count"] == 1
    assert next(f for f in report["files"] if f["path"] == "core.py")["complexity"][0]["cyclomatic_estimate"] == 2


def test_bad_zip_and_wrong_extension_are_explained():
    with TestClient(app) as client:
        assert client.post("/api/analyze", files={"file": ("bad.zip", b"invalid")}).status_code == 400
        assert client.post("/api/analyze", files={"file": ("bad.txt", b"invalid")}).status_code == 415


def test_symlink_is_rejected():
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        entry = zipfile.ZipInfo("link.py")
        entry.create_system = 3
        entry.external_attr = (stat.S_IFLNK | 0o777) << 16
        archive.writestr(entry, "outside.py")
    with TestClient(app) as client:
        assert client.post("/api/analyze", files={"file": ("link.zip", stream.getvalue())}).status_code == 400


def test_no_supported_sources_returns_explicit_empty_inventory():
    with TestClient(app) as client:
        response = client.post("/api/analyze", files={"file": ("notes.zip", bundle({"notes.txt": "hello"}))})
    assert response.status_code == 200
    assert response.json()["summary"]["files"] == 0
