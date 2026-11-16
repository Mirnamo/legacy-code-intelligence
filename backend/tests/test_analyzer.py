from pathlib import Path

from app.analyzer import analyze_directory


def test_describes_python_structure_and_modernization_steps(tmp_path: Path):
    (tmp_path / "service.py").write_text(
        'API_KEY = "not-a-real-secret-value"\nimport requests\n\ndef process():\n    # TODO remove debug\n    print("working")\n',
        encoding="utf-8",
    )
    report = analyze_directory(tmp_path, "test")
    assert report.summary.files == 1
    assert report.summary.symbols == 1
    assert report.files[0].imports == ["requests"]
    assert [(symbol.name, symbol.kind, symbol.line) for symbol in report.files[0].symbols] == [
        ("process", "function", 4),
    ]
    assert report.dependencies[0].target == "requests"
    assert report.recommendations
    payload = report.model_dump()
    assert set(payload["files"][0]) == {"path", "language", "lines", "symbols", "imports"}
    assert "not-a-real-secret-value" not in report.model_dump_json()


def test_skips_dependencies_and_unknown_files(tmp_path: Path):
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "ignored.js").write_text("function ignored() {}")
    (tmp_path / "notes.txt").write_text("not source")
    assert analyze_directory(tmp_path).summary.files == 0

