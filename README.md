# How to run/deploy

## Development (separate servers)

```
# Terminal 1 - Frontend dev server
cd frontend && npm run dev

# Terminal 2 - Backend
cd backend && uvicorn app.main:app --reload
```

Frontend runs on port 5173, backend on 8000.

## Production (single server)

```
# Build frontend once
cd frontend && npm run build

# Run backend (serves both)
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Everything served from port 8000. The if BUILD_DIR.exists() check means you can still run the backend alone during development without errors.
