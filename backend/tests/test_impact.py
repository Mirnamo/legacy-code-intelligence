from app.analyzer import analyze_directory


def analyze(tmp_path, files):
    for path, text in files.items():
        target = tmp_path / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
    return analyze_directory(tmp_path).change_impact


def module(report, path):
    return next(item for item in report["modules"] if item["changed_file"] == path)


def test_transitive_paths_and_line_evidence(tmp_path):
    report = analyze(tmp_path, {"core.py": "", "service.py": "import core\n", "api.py": "\nimport service\n"})
    result = module(report, "core.py")
    assert result["affected_count"] == 2
    indirect = next(x for x in result["affected"] if x["file"] == "api.py")
    assert indirect["path"] == ["core.py", "service.py", "api.py"]
    assert [e["line"] for e in indirect["evidence"]] == [1, 2]


def test_cycles_terminate_and_exclude_changed_file(tmp_path):
    report = analyze(tmp_path, {"a.py": "import b", "b.py": "import a"})
    assert module(report, "a.py")["affected_count"] == 1


def test_relative_imports_and_from_submodule(tmp_path):
    report = analyze(tmp_path, {"pkg/__init__.py": "", "pkg/core.py": "", "pkg/api.py": "from . import core", "main.py": "from pkg import core"})
    assert {x["file"] for x in module(report, "pkg/core.py")["affected"]} == {"pkg/api.py", "main.py"}


def test_duplicate_imports_do_not_duplicate_affected_files(tmp_path):
    report = analyze(tmp_path, {"core.py": "", "api.py": "import core\nimport core"})
    assert module(report, "core.py")["affected_count"] == 1


def test_unresolved_and_unsupported_are_explicit(tmp_path):
    report = analyze(tmp_path, {"api.py": "import requests", "ui.js": "import x from './x'"})
    assert report["unresolved_imports"][0]["import"] == "requests"
    assert report["unsupported_files"] == ["ui.js"]


def test_invalid_python_and_no_execution(tmp_path):
    report = analyze(tmp_path, {"bad.py": "def broken(", "safe.py": "raise RuntimeError('must not execute')"})
    assert report["syntax_error_files"] == ["bad.py"]
    assert module(report, "safe.py")["affected_count"] == 0


def test_does_not_guess_same_basename(tmp_path):
    report = analyze(tmp_path, {"pkg/core.py": "", "api.py": "import core"})
    assert report["edges"] == []
    assert report["unresolved_imports"]
