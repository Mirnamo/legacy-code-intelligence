from __future__ import annotations

from pydantic import BaseModel, Field


class Symbol(BaseModel):
    name: str
    kind: str
    line: int


class Finding(BaseModel):
    rule: str
    severity: str
    message: str
    line: int | None = None


class FileReport(BaseModel):
    path: str
    language: str
    lines: int
    score: int = Field(ge=0, le=100)
    symbols: list[Symbol]
    imports: list[str]
    findings: list[Finding]


class Dependency(BaseModel):
    source: str
    target: str
    kind: str = "import"


class Summary(BaseModel):
    files: int
    lines: int
    symbols: int
    dependencies: int
    high_risks: int
    average_score: int
    languages: dict[str, int]


class Report(BaseModel):
    project: str
    summary: Summary
    files: list[FileReport]
    dependencies: list[Dependency]
    recommendations: list[str]

