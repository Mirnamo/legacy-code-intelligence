# Visitor workflows

## Working implementation on feature/change-impact-lab

- Upload a source ZIP up to 15 MB and inspect recognized files and findings.
- Read Python per-function estimated cyclomatic complexity, using a documented decision-count convention. Other languages retain heuristic inventory checks.
- Select a Python module and inspect direct imports, potentially affected dependent files, shortest dependency paths, and import-line evidence.
- Inspect unresolved imports and analysis boundaries instead of assuming complete coverage.
- Generate structural Markdown documentation from the uploaded code: inventory, symbols, parameter names, complexity, findings, and dependency evidence. Source docstrings and literal default values are omitted.
- Download the full JSON report and Markdown documentation.
- Receive explicit invalid-upload, no-matching-file, and empty-source messages.

This is deterministic static analysis, not a full security audit, business-purpose inference, or an automatic repair system. Dynamic imports and runtime dependency paths are unresolved. Health and review-priority thresholds are heuristics.

## Verification

Python 3.12: 20 backend tests passed, covering ZIP upload responses, unsafe archives, source analysis, Python complexity, documentation redaction, relative imports, dependency cycles, and impact evidence.

Five simulated-DOM frontend interaction tests passed for file selection, filtering, dependency inspection, documentation, visitor upload requests, downloads, and API errors. These use mocked HTTP responses; the backend upload tests exercise the actual API with ZIP bytes.

The Vite production build passed. Browser visual QA, Docker image execution, and public-hosted end-to-end verification have not been performed in this workspace.

## Production preparation

The root Dockerfile builds the React dashboard and serves its static files alongside the FastAPI routes on one origin. Production frontend requests no longer default to localhost. The render.yaml file describes a Docker web service with a /health check. These files prepare deployment; they do not establish that a public website is live.

Run backend tests from the repo root with PYTHONPATH=backend python -m pytest backend/tests -q. Run npm test and npm run build from frontend.

Still planned: Java/C/C++/PHP/REXX/COBOL AST adapters, verified GitHub OAuth ingestion, historical change analysis, AI-authored summaries, PDF export, and team workspaces. None is presented as an active control in the visitor dashboard.
