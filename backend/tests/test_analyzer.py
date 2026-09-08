from pathlib import Path

from app.analyzer import analyze_directory


def test_extracts_python_symbols_and_risks(tmp_path: Path):
    (tmp_path / "service.py").write_text(
        'API_KEY = "not-a-real-secret-value"\nimport requests\n\ndef process():\n    # TODO remove debug\n    print("working")\n',
        encoding="utf-8",
    )
    report = analyze_directory(tmp_path, "test")
    assert report.summary.files == 1
    assert report.summary.symbols == 1
    assert report.summary.high_risks == 1
    assert report.files[0].imports == ["requests"]
    assert {finding.rule for finding in report.files[0].findings} >= {"possible-secret", "work-marker", "debug-output"}


def test_skips_dependencies_and_unknown_files(tmp_path: Path):
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "ignored.js").write_text("function ignored() {}")
    (tmp_path / "notes.txt").write_text("not source")
    assert analyze_directory(tmp_path).summary.files == 0

