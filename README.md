# Legacy Code Intelligence

## Netlify visitor app

Visitors can analyze source ZIP archives in a browser worker or use the separate Python API. Browser mode keeps source code on the visitor's device and uses approximate text analysis. Python mode uses the FastAPI backend for deeper parsing, including Python syntax and function-length analysis. Findings require human review; scores do not certify security or production readiness.

Archive limits: 15 MB compressed, 40 MB expanded, 750 KB per entry, 2,000 entries, 30-second browser timeout. Unsafe paths are rejected; dependencies, generated folders, binary and invalid UTF-8 content are skipped.

### Deploy frontend and connect the Python API

Import this GitHub repository into Netlify, select `main`, and deploy. Root `netlify.toml` sets base `frontend`, build `npm ci && npm run build`, and publish `dist`.

Host the API separately using `Dockerfile.api` (repository root as build context; port `8000`; health check `/health`). Configure:

- On the API host, set `ALLOWED_ORIGINS` to the exact Netlify site origin, without a trailing slash. Comma-separated origins are supported for production and preview sites.
- In Netlify, set `VITE_API_URL` to the API's HTTPS origin, without a trailing slash, then trigger a new deploy.

When `VITE_API_URL` is present at build time, the app defaults to Python backend mode. Visitors can switch to limited Browser analysis. Without it, Browser analysis is used and the Python option is disabled. The built-in demo is always browser-based.

### Verify locally

```bash
cd frontend
npm ci
npm test
npm run build
npm run dev
```

Backend tests run with `cd backend && pytest`.
