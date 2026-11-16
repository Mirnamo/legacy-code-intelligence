from __future__ import annotations

from pydantic import BaseModel


class Symbol(BaseModel):
    name: str
    kind: str
    line: int


class FileReport(BaseModel):
    path: str
    language: str
    lines: int
    symbols: list[Symbol]
    imports: list[str]


class Dependency(BaseModel):
    source: str
    target: str
    kind: str = "import"


class Summary(BaseModel):
    files: int
    lines: int
    symbols: int
    dependencies: int
    languages: dict[str, int]


class Report(BaseModel):
    project: str
    summary: Summary
    files: list[FileReport]
    dependencies: list[Dependency]
    recommendations: list[str]
