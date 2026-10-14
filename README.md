# Legacy Code Intelligence

## Netlify visitor app

Visitors can analyze source ZIP archives directly in a browser worker without a backend. Source code is not uploaded or executed. Reports include language/file inventories, approximate symbols and imports, import relationships, branch-density signals, maintenance/possible-secret findings, rule-based health scores, modernization suggestions, and JSON export. A built-in demo works offline after loading the site.

Browser analysis uses text patterns, not Python AST parsing. It does not validate Python syntax or measure function lengths. Results require human review; scores do not certify security or production readiness. Potential credential values are omitted from findings.

Archive limits: 15 MB compressed, 40 MB expanded, 750 KB per entry, 2,000 entries, 30-second timeout. Unsafe paths are rejected; dependencies, generated folders, binary and invalid UTF-8 content are skipped. Archives are read in memory without filesystem extraction.

### Deploy to Netlify

Import this GitHub repository, select `main`, and deploy. Root `netlify.toml` sets base `frontend`, build `npm ci && npm run build`, publish `dist`. No API URL or secret environment variables are needed.

### Verify locally

```bash
cd frontend
npm ci
npm test
npm run build
npm run dev
```

## Original Python backend

The FastAPI backend remains available for local use and Docker deployment. Its Python analyzer uses AST parsing; it is separate from the standalone Netlify browser app.
