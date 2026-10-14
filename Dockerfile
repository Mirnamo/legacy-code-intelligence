FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/
COPY --from=frontend /build/dist ./frontend/dist
WORKDIR /app/backend
ENV PORT=10000
EXPOSE 10000
CMD ["sh", "-c", "exec uvicorn app.hosted:app --host 0.0.0.0 --port ${PORT}"]
