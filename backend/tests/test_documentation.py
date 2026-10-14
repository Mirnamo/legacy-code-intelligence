from app.analyzer import analyze_directory
from app.documentation import python_metrics


def test_decisions_and_boolean_operators():
    result = python_metrics("def f(x):\n    if x and x > 2:\n        return 1\n    return 0\n")[0]
    assert result["cyclomatic_estimate"] == 3
    assert result["parameters"] == ["x"]


def test_nested_functions_are_separate():
    metrics = python_metrics("def outer():\n    def inner(x):\n        if x:\n            return 1\n    return inner\n")
    assert [(m["name"], m["cyclomatic_estimate"]) for m in metrics] == [("outer", 1), ("inner", 2)]


def test_complexity_handles_async_comprehension_and_match():
    source = "async def f(xs):\n    ys = [x for x in xs if x]\n    match ys:\n        case []:\n            return 0\n        case _ if len(ys) > 2:\n            return 2\n    return 1\n"
    assert python_metrics(source)[0]["cyclomatic_estimate"] == 5


def test_documentation_describes_upload_and_redacts_literals(tmp_path):
    (tmp_path / "core.py").write_text('def calculate(x, password="sensitive-literal"):\n    """sensitive-docstring"""\n    return x\n')
    (tmp_path / "api.py").write_text("import core\n")
    report = analyze_directory(tmp_path, "Visitor app")
    assert "Visitor app" in report.documentation
    assert "calculate(x, password)" in report.documentation
    assert "core.py → api.py" in report.documentation
    assert "sensitive-literal" not in report.documentation
    assert "sensitive-docstring" not in report.documentation
    assert report.model_dump()["documentation"]


def test_high_complexity_produces_real_finding(tmp_path):
    source = "def f(x):\n" + "".join(f"    if x == {i}:\n        return {i}\n" for i in range(10))
    (tmp_path / "branchy.py").write_text(source)
    report = analyze_directory(tmp_path)
    assert report.files[0].complexity[0]["cyclomatic_estimate"] == 11
    assert any(f.rule == "complex-function" and f.severity == "high" for f in report.files[0].findings)


def test_invalid_and_unsupported_code_is_not_given_complexity(tmp_path):
    (tmp_path / "invalid.py").write_text("def (")
    (tmp_path / "app.js").write_text("function hello() {}")
    report = analyze_directory(tmp_path)
    assert all(not file.complexity for file in report.files)
    assert "Other language" in report.documentation
