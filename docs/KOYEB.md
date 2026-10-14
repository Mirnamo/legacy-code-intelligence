# Koyeb backend + Netlify frontend

Create a Koyeb Web Service from Mirnamo/legacy-code-intelligence, branch main. Select Docker builder, repository root build context, and Dockerfile.api (not the root full-stack Dockerfile). Select the free instance if available. Expose HTTP port 8000 at / and use /health as the HTTP health check. Set PORT=8000 and ALLOWED_ORIGINS to the exact Netlify site origin (https://your-site.netlify.app), without a trailing slash. Multiple origins can be comma-separated.

After the backend is healthy, set VITE_API_URL in Netlify to the Koyeb public HTTPS origin and rebuild/redeploy the frontend. The upload mode defaults to Python when that variable is present. ZIP uploads are sent to the backend only in Python mode. Errors do not silently upload elsewhere or switch analysis methods; visitors can explicitly select the limited browser option. The built-in demo remains browser-only.

Verify /health, a ZIP containing an invalid Python file (syntax-error finding), and a function longer than 60 lines (long-function finding). Confirm temporary upload cleanup and CORS from the deployed frontend.
