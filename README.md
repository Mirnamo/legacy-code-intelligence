# Legacy Code Intelligence

## Netlify visitor app

Upload a source ZIP for a walkthrough of its languages, files, named definitions, and import relationships. The report includes modernization recommendations and a JSON download. Browser mode uses text patterns and keeps the ZIP on the visitor's device. The optional Python API parses Python source for more accurate definitions and imports.

Archive limits: 15 MB compressed, 40 MB expanded, 750 KB per entry, 2,000 entries, 30-second browser timeout. Unsafe paths are rejected; dependencies, generated folders, binary and invalid UTF-8 content are skipped.

### Deploy frontend and connect the Python API

Import this GitHub repository into Netlify, select `main`, and deploy. Root `netlify.toml` sets base `frontend`, build `npm ci && npm run build`, and publish `dist`.

Host the API separately using `Dockerfile.api` (repository root as build context; port `8000`; health check `/health`). Configure:

- On the API host, set `ALLOWED_ORIGINS` to the exact Netlify site origin, without a trailing slash. Comma-separated origins are supported for production and preview sites.
- In Netlify, set `VITE_API_URL` to the API's HTTPS origin, without a trailing slash, then trigger a new deploy.

When `VITE_API_URL` is present at build time, the app defaults to Python backend mode. Visitors can switch to limited Browser analysis. Without it, Browser analysis is used and the Python option is disabled.

### Verify locally

```bash
cd frontend
npm ci
npm test
npm run build
npm run dev
```

Backend tests run with `cd backend && pytest`.
