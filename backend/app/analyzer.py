from __future__ import annotations

import ast
import re
from collections import Counter
from pathlib import Path

from .models import Dependency, FileReport, Finding, Report, Summary, Symbol

LANGUAGES = {
    ".py": "Python", ".js": "JavaScript", ".jsx": "JavaScript",
    ".ts": "TypeScript", ".tsx": "TypeScript", ".php": "PHP",
    ".java": "Java", ".c": "C", ".h": "C", ".cpp": "C++",
    ".cc": "C++", ".hpp": "C++", ".rexx": "REXX", ".rex": "REXX",
    ".cbl": "COBOL", ".cob": "COBOL", ".sql": "SQL",
}
SKIP_DIRS = {".git", "node_modules", "vendor", "dist", "build", ".venv", "venv", "coverage"}
SKIP_FILES = {".env", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"}
MAX_TEXT_BYTES = 750_000

SECRET_PATTERN = re.compile(r"(?i)\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*['\"][^'\"]{8,}['\"]")
JS_SYMBOL = re.compile(r"^\s*(?:export\s+)?(?:async\s+)?(function|class)\s+([A-Za-z_$][\w$]*)", re.MULTILINE)
GENERIC_SYMBOL = re.compile(r"^\s*(?:public\s+|private\s+|protected\s+)?(?:function|class|def)\s+([A-Za-z_$][\w$]*)", re.MULTILINE)
IMPORT_PATTERN = re.compile(r"(?:from\s+['\"]([^'\"]+)['\"]|require\(['\"]([^'\"]+)['\"]\)|^\s*(?:from|import)\s+([\w.]+))", re.MULTILINE)


def _read_text(path: Path) -> str | None:
    if path.stat().st_size > MAX_TEXT_BYTES:
        return None
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def _python_details(text: str) -> tuple[list[Symbol], list[str], list[Finding]]:
    symbols: list[Symbol] = []
    imports: list[str] = []
    findings: list[Finding] = []
    try:
        tree = ast.parse(text)
    except SyntaxError as exc:
        return symbols, imports, [Finding(rule="syntax-error", severity="high", message=str(exc.msg), line=exc.lineno)]
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            kind = "class" if isinstance(node, ast.ClassDef) else "function"
            symbols.append(Symbol(name=node.name, kind=kind, line=node.lineno))
            if kind == "function" and getattr(node, "end_lineno", node.lineno) - node.lineno > 60:
                findings.append(Finding(rule="long-function", severity="medium", message=f"{node.name} spans more than 60 lines", line=node.lineno))
        elif isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            imports.append(node.module or "relative")
            if any(alias.name == "*" for alias in node.names):
                findings.append(Finding(rule="wildcard-import", severity="medium", message="Wildcard import obscures dependencies", line=node.lineno))
    return symbols, sorted(set(imports)), findings


def _generic_details(text: str) -> tuple[list[Symbol], list[str]]:
    symbols = []
    for match in JS_SYMBOL.finditer(text):
        symbols.append(Symbol(name=match.group(2), kind=match.group(1), line=text.count("\n", 0, match.start()) + 1))
    if not symbols:
        for match in GENERIC_SYMBOL.finditer(text):
            symbols.append(Symbol(name=match.group(1), kind="symbol", line=text.count("\n", 0, match.start()) + 1))
    imports = sorted({next(value for value in match.groups() if value) for match in IMPORT_PATTERN.finditer(text)})
    return symbols, imports


def _risk_findings(text: str, lines: int) -> list[Finding]:
    findings: list[Finding] = []
    if lines > 400:
        findings.append(Finding(rule="large-file", severity="high", message=f"File contains {lines} lines"))
    elif lines > 220:
        findings.append(Finding(rule="large-file", severity="medium", message=f"File contains {lines} lines"))
    for index, line in enumerate(text.splitlines(), 1):
        if re.search(r"\b(TODO|FIXME|HACK)\b", line, re.I):
            findings.append(Finding(rule="work-marker", severity="low", message="Unresolved maintenance marker", line=index))
        if re.search(r"\b(console\.log|print)\s*\(", line):
            findings.append(Finding(rule="debug-output", severity="low", message="Debug output in application code", line=index))
        if SECRET_PATTERN.search(line):
            key = SECRET_PATTERN.search(line).group(1)
            findings.append(Finding(rule="possible-secret", severity="high", message=f"Possible hard-coded {key}; value suppressed", line=index))
    return findings[:30]


def _score(findings: list[Finding]) -> int:
    penalty = {"high": 22, "medium": 10, "low": 3}
    return max(0, 100 - sum(penalty[item.severity] for item in findings))


def analyze_directory(root: Path, project_name: str | None = None) -> Report:
    root = root.resolve()
    reports: list[FileReport] = []
    dependencies: list[Dependency] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or any(part in SKIP_DIRS for part in path.parts) or path.name in SKIP_FILES:
            continue
        language = LANGUAGES.get(path.suffix.lower())
        if not language:
            continue
        text = _read_text(path)
        if text is None:
            continue
        relative = path.relative_to(root).as_posix()
        lines = len(text.splitlines())
        if language == "Python":
            symbols, imports, findings = _python_details(text)
        else:
            symbols, imports = _generic_details(text)
            findings = []
        findings.extend(_risk_findings(text, lines))
        reports.append(FileReport(path=relative, language=language, lines=lines, score=_score(findings), symbols=symbols, imports=imports, findings=findings))
        dependencies.extend(Dependency(source=relative, target=target) for target in imports)

    languages = Counter(report.language for report in reports)
    high_risks = sum(item.severity == "high" for report in reports for item in report.findings)
    average = round(sum(report.score for report in reports) / len(reports)) if reports else 100
    recommendations = _recommend(reports, high_risks)
    return Report(
        project=project_name or root.name,
        summary=Summary(files=len(reports), lines=sum(x.lines for x in reports), symbols=sum(len(x.symbols) for x in reports), dependencies=len(dependencies), high_risks=high_risks, average_score=average, languages=dict(languages)),
        files=sorted(reports, key=lambda item: (item.score, -item.lines)),
        dependencies=dependencies,
        recommendations=recommendations,
    )


def _recommend(reports: list[FileReport], high_risks: int) -> list[str]:
    recommendations = []
    if high_risks:
        recommendations.append("Triage high-severity findings before feature work and rotate any confirmed exposed credentials.")
    if any(any(f.rule in {"large-file", "long-function"} for f in report.findings) for report in reports):
        recommendations.append("Create characterization tests, then split oversized modules along stable responsibility boundaries.")
    if sum(len(report.imports) for report in reports) > len(reports) * 4:
        recommendations.append("Document dependency boundaries and introduce adapters around volatile external integrations.")
    if not any("test" in report.path.lower() for report in reports):
        recommendations.append("Add a test harness around critical behavior before changing implementation details.")
    recommendations.append("Modernize incrementally: measure behavior, isolate one boundary, migrate it, and compare results.")
    return recommendations

