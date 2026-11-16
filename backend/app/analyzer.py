from __future__ import annotations

import ast
import re
from collections import Counter
from pathlib import Path

from .models import Dependency, FileReport, Report, Summary, Symbol

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

JS_SYMBOL = re.compile(r"^\s*(?:export\s+)?(?:async\s+)?(function|class)\s+([A-Za-z_$][\w$]*)", re.MULTILINE)
GENERIC_SYMBOL = re.compile(r"^\s*(?:public\s+|private\s+|protected\s+)?(?:function|class|def)\s+([A-Za-z_$][\w$]*)", re.MULTILINE)
LEGACY_SYMBOLS = {
    "COBOL": (re.compile(r"^\s*(?:\d{6}\s+)?([\w-]+)\s+SECTION\s*\.", re.I | re.M), "section"),
    "REXX": (re.compile(r"^\s*([\w!?]+):", re.M), "label"),
}
IMPORT_PATTERN = re.compile(r"(?:from\s+['\"]([^'\"]+)['\"]|require\(['\"]([^'\"]+)['\"]\)|^\s*(?:from|import)\s+([\w.]+))", re.MULTILINE)


def _read_text(path: Path) -> str | None:
    if path.stat().st_size > MAX_TEXT_BYTES:
        return None
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def _python_details(text: str) -> tuple[list[Symbol], list[str]]:
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return _generic_details(text)

    symbols: list[Symbol] = []
    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            kind = "class" if isinstance(node, ast.ClassDef) else "function"
            symbols.append(Symbol(name=node.name, kind=kind, line=node.lineno))
        elif isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            prefix = "." * node.level
            if node.module:
                imports.append(prefix + node.module)
            else:
                imports.extend(prefix + alias.name for alias in node.names)
    return sorted(symbols, key=lambda symbol: symbol.line), sorted(set(imports))


def _generic_details(text: str, language: str = "") -> tuple[list[Symbol], list[str]]:
    symbols = []
    for match in JS_SYMBOL.finditer(text):
        symbols.append(Symbol(name=match.group(2), kind=match.group(1), line=text.count("\n", 0, match.start()) + 1))
    if not symbols:
        for match in GENERIC_SYMBOL.finditer(text):
            symbols.append(Symbol(name=match.group(1), kind="symbol", line=text.count("\n", 0, match.start()) + 1))
    if language in LEGACY_SYMBOLS:
        pattern, kind = LEGACY_SYMBOLS[language]
        for match in pattern.finditer(text):
            symbols.append(Symbol(name=match.group(1), kind=kind, line=text.count("\n", 0, match.start(1)) + 1))
    imports = sorted({next(value for value in match.groups() if value) for match in IMPORT_PATTERN.finditer(text)})
    return symbols, imports


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
            symbols, imports = _python_details(text)
        else:
            symbols, imports = _generic_details(text, language)
        reports.append(FileReport(path=relative, language=language, lines=lines, symbols=symbols, imports=imports))
        dependencies.extend(Dependency(source=relative, target=target) for target in imports)

    languages = Counter(report.language for report in reports)
    recommendations = ["Use the file inventory to find the entry point for one behavior you want to modernize."]
    if dependencies:
        recommendations.append("Follow that file's imports to decide which modules belong in the first migration slice.")
    recommendations.append("Record how the behavior works today, then compare the same inputs and outputs after you migrate it.")
    return Report(
        project=project_name or root.name,
        summary=Summary(
            files=len(reports),
            lines=sum(file.lines for file in reports),
            symbols=sum(len(file.symbols) for file in reports),
            dependencies=len(dependencies),
            languages=dict(languages),
        ),
        files=reports,
        dependencies=dependencies,
        recommendations=recommendations,
    )
