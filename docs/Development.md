# Local Development

This guide covers setting up jDuel for local development.

## Prerequisites

- Python 3.13+
- Node.js and npm
- uv package manager ([installation](https://astral.sh/uv))

## First-Time Setup

### Backend Setup

```bash
cd backend
uv sync

# Install spaCy language model (required for answer checking)
uv run python -m ensurepip --upgrade
uv run python -m spacy download en_core_web_sm
```

### Frontend Setup

```bash
cd frontend
npm install
```

### Import Questions

Load trivia questions from CSV:

```bash
cd backend
uv run python src/scripts/import_questions.py
```

## Running the Application

### Start Backend (Terminal 1)

```bash
cd backend
uv run uvicorn app.main:app --reload
```

Backend runs on `http://localhost:8000`

**Reduce RAM usage on GPU machines:**

```bash
CUDA_VISIBLE_DEVICES="" uv run uvicorn app.main:app --reload
```

> **Note:** Without CUDA ~850MB RAM, with CUDA ~3GB RAM

### Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:3000`

## Code Formatting

### Backend

```bash
cd backend
uv tool install ruff
ruff format .
ruff check .
```

### Frontend

```bash
cd frontend
npm run format
```

## Architecture

### Development Mode

- Frontend dev server (port 3000) with hot-reload
- Backend server (port 8000) with auto-reload
- Separate processes for faster iteration
- WebSocket connections go directly to backend

## Troubleshooting

**Port already in use:**

```bash
# Find process using port 8000 or 3000
lsof -i :8000
lsof -i :3000

# Kill if necessary
kill <PID>
```

**Module not found:**

```bash
# Re-sync backend dependencies
cd backend
uv sync

# Re-install frontend dependencies
cd frontend
npm install
```

**WebSocket connection fails:**

- Check backend is running on port 8000
- Verify frontend config points to `ws://localhost:8000/ws`
