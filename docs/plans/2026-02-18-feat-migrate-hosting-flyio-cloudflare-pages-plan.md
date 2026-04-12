My questions:
1. Will this architecture support stripe payments (or equivalent) in the future. How?
2. Will this support adding authentication and user login implementation in the future. How? Can we still use sqlite?
3. Will this support adding a non-sqlite database in the future? How?

---
title: "feat: Migrate hosting from EC2 to Fly.io + Cloudflare Pages"
type: feat
date: 2026-02-18
---

# feat: Migrate Hosting from EC2 to Fly.io + Cloudflare Pages

## Overview

Migrate jDuel from a manual EC2 + nginx + systemd deployment to a fully managed, auto-deploying stack: Fly.io (FastAPI backend with WebSockets) + Cloudflare Pages (React/Vite frontend). The result is zero manual SSH deploys, automatic TLS, push-to-deploy on `main`, and genuinely free hosting.

## Problem Statement

- EC2 free tier is expiring soon — continuing on EC2 will incur cost
- All deployments are manual (SSH → run `deploy.sh`) — error-prone and slow
- nginx, certbot, and systemd configuration must be managed by hand
- No path to adding auth, payments, or monitoring without significant ops work

## Proposed Solution

Split the monolith EC2 server into two independent, managed services:

| Component | Current | New |
|-----------|---------|-----|
| Backend (FastAPI + WS) | EC2 + systemd + nginx proxy | Fly.io (Docker) |
| Frontend (React/Vite) | EC2 + nginx static files | Cloudflare Pages |
| TLS | Certbot (manual) | Auto (both platforms) |
| Deploy | SSH + `deploy.sh` | GitHub Actions + Cloudflare Pages auto-build |
| Custom domain | jduel.xyz → EC2 IP | jduel.xyz → Cloudflare Pages, api.jduel.xyz → Fly.io |

---

## Technical Approach

### Architecture After Migration

```
Browser
  │
  ├── https://jduel.xyz  →  Cloudflare Pages (CDN edge)
  │       React/Vite static build
  │       SPA routing via _redirects
  │
  └── https://api.jduel.xyz  →  Fly.io machine
          FastAPI + uvicorn
          /api/*  (HTTP routes)
          /ws     (WebSocket, long-lived)
          /health (health check)
```

### Key Code Changes Required

**1. `frontend/src/config.ts`** — currently uses `window.location.host` assuming same-origin backend. Must switch to explicit env vars because frontend (Cloudflare Pages) and backend (Fly.io) are now different origins.

**2. `backend/src/app/config/environment.py`** — `CORS_ORIGINS` is a hardcoded list. Must add the Cloudflare Pages production URL and optionally support `allow_origin_regex` for Cloudflare preview deployments (`*.pages.dev`).

**3. `frontend/public/_redirects`** — Cloudflare Pages needs this file to handle SPA routing (so `/room/AB3D` serves `index.html` instead of a 404).

**4. `backend/Dockerfile`** — doesn't exist yet. Must be created for Fly.io deployment.

**5. `backend/.dockerignore`** — must exclude `.venv/`, `tests/`, `__pycache__/` from the image.

**6. `fly.toml`** — Fly.io app config. Defines machine size, internal port, health check path, WebSocket timeout, and environment variables.

**7. `.github/workflows/deploy-backend.yml`** — GitHub Actions workflow that runs `flyctl deploy` on push to `main`.

### WebSocket Idle Timeout (Critical Gotcha from External Research)

Fly.io's HTTP proxy has a **60-second idle timeout** for connections with no data in either direction. During jDuel's lobby phase, players can wait for minutes with zero WebSocket messages — Fly.io will silently drop the connection at 60s with no warning to the client. The fix is uvicorn's built-in `--ws-ping-interval 30` flag in the Dockerfile CMD — zero application code changes needed.

### Memory Constraint: NLP Models

The backend's actual RSS on EC2 is ~124MB (spaCy + sentence-transformers are memory-mapped, not fully resident). Fly.io's free tier gives 256MB RAM per machine. A Docker container does not carry EC2 OS overhead (~300MB), so the app should fit comfortably. **Start with 256MB and monitor; upgrade to 512MB (~$1.94/month) if OOM kills occur.**

The `CUDA_VISIBLE_DEVICES=""` environment variable must be set in the container to prevent GPU driver initialization (documented in `docs/solutions/configuration-issues/backend-lightweight-mode.md`).

### Single Instance Requirement

jDuel uses in-memory game state (no database). Fly.io must be configured with `min_machines_running = 1` and `max_machines = 1`. Scale-to-zero would evaporate all active rooms on idle. Horizontal scaling would require a shared state layer (Redis) — out of scope.

---

## Implementation Phases

### Phase 1: Code Changes (no deploy yet)

These are the source code changes that must land before the new infrastructure works.

#### 1a. Update `frontend/src/config.ts`

Switch from `window.location.host` to `import.meta.env.VITE_*` variables:

```typescript
// frontend/src/config.ts
function getWebSocketUrl(): string {
  if (import.meta.env.DEV) {
    return "ws://localhost:8000/ws";
  }
  const url = import.meta.env.VITE_WS_URL;
  if (!url) {
    throw new Error("VITE_WS_URL is not set. Check Cloudflare Pages environment variables.");
  }
  return url;
}

function getApiUrl(): string {
  if (import.meta.env.DEV) {
    return "http://localhost:8000/api";
  }
  const url = import.meta.env.VITE_API_URL;
  if (!url) {
    throw new Error("VITE_API_URL is not set. Check Cloudflare Pages environment variables.");
  }
  return url;
}

export const WS_URL = getWebSocketUrl();
export const API_URL = getApiUrl();
```

In development, `import.meta.env.DEV` is `true` so `localhost` still works with no changes needed. In production, missing env vars throw a clear error instead of silently returning `undefined`.

#### 1b. Update `backend/src/app/config/environment.py`

Add the Cloudflare Pages production domain. Use `allow_origin_regex` in `main.py` for `*.pages.dev` preview URLs:

```python
# backend/src/app/config/environment.py
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://jduel.xyz",
    "https://www.jduel.xyz",
]

# Regex to allow Cloudflare Pages preview deployments (project-scoped)
CORS_ORIGIN_REGEX = r"https://[a-z0-9-]+\.jduel\.pages\.dev"
```

Update `backend/src/app/config/__init__.py` to export the new constant:

```python
# Add to imports in config/__init__.py
from app.config.environment import CORS_ORIGINS, CORS_ORIGIN_REGEX

# Add to __all__
"CORS_ORIGIN_REGEX",
```

Update `backend/src/app/main.py` to import and pass both:

```python
# backend/src/app/main.py
from app.config import CORS_ORIGINS, CORS_ORIGIN_REGEX, ROOM_ID_PATTERN, setup_logging

# In create_app:
_app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 1c. Add `frontend/public/_redirects`

Cloudflare Pages needs this for SPA routing (otherwise direct-link URLs like `/room/AB3D` return 404):

```
/*    /index.html   200
```

#### ~~1d. WebSocket keepalive~~ — Handled by uvicorn flag (no code changes)

Fly.io's reverse proxy drops WebSocket connections after 60 seconds of inactivity. Instead of writing application-level keepalive code, use uvicorn's built-in `--ws-ping-interval` flag. This sends WebSocket protocol-level ping frames (invisible to application code, no frontend changes needed). See the Dockerfile CMD in Phase 2a.

---

### Phase 2: Backend Dockerization

#### 2a. Create `backend/Dockerfile`

```dockerfile
# backend/Dockerfile

# --- Builder stage: install deps (large, cached) ---
FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency files first (layer caching)
COPY pyproject.toml uv.lock ./

# Install production dependencies into .venv (no dev deps, no editable)
RUN uv sync --no-dev --frozen --no-editable

# Pre-download sentence-transformers model at build time (cached unless deps change)
# This MUST come after uv sync but before COPY src/ to maximize cache hits
# HF_HOME must be set so the model is stored in a known, copyable location
ENV CUDA_VISIBLE_DEVICES=""
ENV HF_HOME=/app/.hf_cache
RUN uv run python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# --- Production stage: slim image with just .venv + source + model cache ---
FROM python:3.13-slim

WORKDIR /app

# Copy the virtualenv from builder (includes all deps)
COPY --from=builder /app/.venv /app/.venv

# Copy the Hugging Face model cache (sentence-transformers model)
COPY --from=builder /app/.hf_cache /app/.hf_cache

# Copy application source last (changes most often, doesn't bust model cache)
COPY src/ ./src/

# Activate venv by prepending to PATH
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV CUDA_VISIBLE_DEVICES=""
ENV HF_HOME=/app/.hf_cache
ENV PYTHONPATH=/app/src

EXPOSE 8000

# --ws-ping-interval 30: sends WebSocket protocol pings every 30s to prevent
# Fly.io's 60s idle timeout from dropping lobby connections. Zero app code needed.
# --ws-ping-timeout 10: close connection if no pong received within 10s.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--ws-ping-interval", "30", "--ws-ping-timeout", "10"]
```

**Notes:**
- **Multi-stage build**: Builder installs deps + downloads NLP model; production copies `.venv`, `.hf_cache`, and source.
- **`HF_HOME=/app/.hf_cache`**: Critical — without this, the Hugging Face model downloads to `/root/.cache/` in the builder stage and is silently discarded. Setting `HF_HOME` ensures the model is stored in a copyable location.
- **Layer ordering**: Model download after `uv sync` but before `COPY src/`. Source changes (frequent) don't bust model cache (slow).
- **`--ws-ping-interval 30`**: Sends WebSocket protocol-level pings every 30s to prevent Fly.io's 60s idle timeout. Zero application code changes. Zero frontend changes.
- `--workers 1` is intentional — multiple workers would each have separate in-memory room state.
- `CUDA_VISIBLE_DEVICES=""` prevents GPU driver loading (saves ~1GB RAM headroom)
- `PYTHONPATH=/app/src` ensures `app.main` is importable
- spaCy's `en_core_web_sm` is installed as a pip package via direct URL in `pyproject.toml` — it lives in `.venv` and is copied automatically. Do NOT replace this with `python -m spacy download` which installs to a different location.

#### 2b. Create `backend/.dockerignore`

```
.venv/
tests/
__pycache__/
*.pyc
*.pyo
.pytest_cache/
.ruff_cache/
.mypy_cache/
```

#### 2c. Validate locally

```bash
cd backend
docker build -t jduel-backend .
docker run --rm -p 8000:8000 jduel-backend
curl http://localhost:8000/health
```

---

### Phase 3: Fly.io Setup

#### 3a. Install flyctl and create account

```bash
# Install flyctl (Linux/macOS)
curl -L https://fly.io/install.sh | sh

# Authenticate
flyctl auth login
```

#### 3b. Create the Fly.io app

Run from the repo root (Fly.io needs to see the Dockerfile):

```bash
cd backend
flyctl launch --name jduel-api --region iad --no-deploy
```

This generates a `fly.toml`. Then replace its contents with the configured version below.

#### 3c. Create `backend/fly.toml`

```toml
# backend/fly.toml
app = "jduel-api"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

# Env vars set in Dockerfile — no [env] section needed here to avoid duplication.

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = false      # Never stop — in-memory state would be lost
  auto_start_machines = true
  min_machines_running = 1        # Always keep 1 machine running

  [[http_service.checks]]
    grace_period = "30s"          # Allow NLP models time to load
    interval = "30s"
    method = "GET"
    path = "/health"
    timeout = "10s"

[machines]
  [machines.guest]
    cpu_kind = "shared"
    cpus = 1
    memory_mb = 256               # Start here; increase to 512 if OOM
```

**After first deploy, enforce single instance:**
```bash
flyctl scale count 1
```

**Critical settings:**
- `auto_stop_machines = false` — never stop; in-memory room state would be lost
- `min_machines_running = 1` — always keep 1 machine alive
- `flyctl scale count 1` — enforce single instance (fly.toml may not have a `max_machines` key; verify against current schema)
- `grace_period = "30s"` — NLP model loading takes time; don't fail health check too early

#### 3d. First manual deploy

```bash
cd backend
flyctl deploy
```

Verify:
```bash
flyctl status
curl https://jduel-api.fly.dev/health
```

#### 3e. Add custom domain for backend

```bash
flyctl certs add api.jduel.xyz
```

Fly.io will output a CNAME or A record to add to DNS (Step 6).

---

### Phase 4: Cloudflare Pages Setup

This is largely done through the Cloudflare dashboard (no config files needed beyond `_redirects`).

#### 4a. Connect GitHub repo

1. Go to Cloudflare Dashboard → Pages → Create a project
2. Connect GitHub and select the `jDuel` repository
3. Configure build settings:
   - **Build command:** `cd frontend && npm ci && npm run build`
   - **Build output directory:** `frontend/dist`
   - **Root directory:** `/` (repo root, not `frontend/`)

#### 4b. Set environment variables in Cloudflare Pages

In Pages → Settings → Environment Variables → Production:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://api.jduel.xyz/api` |
| `VITE_WS_URL` | `wss://api.jduel.xyz/ws` |

Also add to Preview environment (for non-production branches):

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://jduel-api.fly.dev/api` |
| `VITE_WS_URL` | `wss://jduel-api.fly.dev/ws` |

#### 4c. Trigger first build

Push any commit to `main` — Cloudflare Pages auto-builds and deploys. The result will be at `https://jduel.pages.dev` (temporary URL before custom domain).

---

### Phase 5: GitHub Actions for Backend Deploy

Cloudflare Pages handles frontend deploys automatically via GitHub integration. Only the backend needs an explicit GitHub Actions workflow.

#### 5a. Create `.github/workflows/deploy-backend.yml`

```yaml
# .github/workflows/deploy-backend.yml
name: Deploy Backend to Fly.io

on:
  push:
    branches: [main]
    paths:
      - "backend/**"
      - ".github/workflows/deploy-backend.yml"

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        working-directory: backend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

**Key design decisions:**
- `paths: backend/**` — only triggers when backend changes. Frontend auto-deploys via Cloudflare Pages.
- `--remote-only` — builds the Docker image on Fly.io's infrastructure (no local Docker needed in CI)
- Runs from `backend/` so `flyctl` finds `fly.toml`

#### 5b. Add `FLY_API_TOKEN` secret to GitHub

```bash
flyctl tokens create deploy -x 999999h
```

Copy the output token, then add it to GitHub: Settings → Secrets → Actions → New secret → `FLY_API_TOKEN`.

---

### Phase 6: DNS Migration and Cutover

#### 6a. Move jduel.xyz to Cloudflare DNS

If not already using Cloudflare DNS (required for Cloudflare Pages custom domains):
1. Add site `jduel.xyz` to Cloudflare
2. Update domain registrar nameservers to Cloudflare's nameservers
3. Wait for DNS propagation (usually minutes, up to 24h)

#### 6b. Add custom domain to Cloudflare Pages

1. Pages → jduel project → Custom domains → Add custom domain
2. Add `jduel.xyz` and `www.jduel.xyz`
3. Cloudflare automatically creates the DNS records and issues TLS cert

#### 6c. Add DNS record for backend API

In Cloudflare DNS, add:
- **Type:** CNAME
- **Name:** `api`
- **Target:** `jduel-api.fly.dev`
- **Proxy:** DNS only (grey cloud, **NOT orange cloud**)

> **Critical from external research:** Cloudflare's orange-cloud proxy can interfere with WebSocket upgrades on the free plan and has a 100-second timeout that resets on activity. Use DNS-only mode so WebSocket traffic goes directly to Fly.io, which handles TLS termination for this subdomain.

#### 6d. Update Cloudflare Pages env vars to use `api.jduel.xyz`

Once the CNAME propagates:
- `VITE_API_URL` → `https://api.jduel.xyz/api`
- `VITE_WS_URL` → `wss://api.jduel.xyz/ws`

Trigger a redeploy (push a commit or manually trigger in Cloudflare Pages dashboard).

---

### Phase 7: Smoke Testing and Cutover Validation

Run through the full game flow after DNS switches:

- [ ] `curl https://api.jduel.xyz/health` returns `{"status": "ok"}`
- [ ] `https://jduel.xyz` loads the React app
- [ ] Create a room from Home page (HTTP POST to `api.jduel.xyz`)
- [ ] Two players can join and connect via WebSocket
- [ ] Start game, answer questions, see results
- [ ] Play Again resets room to lobby
- [ ] Room closes after game over and players are redirected home
- [ ] Deep link (`https://jduel.xyz/room/AB3D`) works and shows join page
- [ ] Check Fly.io logs: `flyctl logs`
- [ ] WebSocket survives >60s idle in lobby (uvicorn ping keeps connection alive)

---

### Phase 8: EC2 Decommission and Cleanup

After confirming the new stack works for at least a few days:

- [ ] Terminate the EC2 instance (or stop it first as a safety net)
- [ ] Remove old DNS records pointing to EC2 IP
- [ ] Update `CLAUDE.md` deployment section to reference Fly.io + Cloudflare Pages
- [ ] Update `docs/DeploymentGuide.md` with the new deploy process
- [ ] `deploy.sh` can be kept for reference or deleted (it no longer applies)
- [ ] Remove nginx/systemd config references from docs

---

## Files Created or Modified

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/config.ts` | Modify | Use `VITE_API_URL` / `VITE_WS_URL` env vars |
| `backend/src/app/config/environment.py` | Modify | Add `CORS_ORIGIN_REGEX` for `*.pages.dev` |
| `backend/src/app/main.py` | Modify | Pass `allow_origin_regex` to CORSMiddleware |
| `backend/src/app/config/__init__.py` | Modify | Export `CORS_ORIGIN_REGEX` |
| `frontend/public/_redirects` | Create | SPA routing for Cloudflare Pages |
| `backend/Dockerfile` | Create | Multi-stage container build for Fly.io |
| `backend/.dockerignore` | Create | Exclude `.venv/`, caches from image |
| `backend/fly.toml` | Create | Fly.io app config (machine size, health check, no scale-to-zero) |
| `.github/workflows/deploy-backend.yml` | Create | Auto-deploy backend on push to `main` |

---

## Acceptance Criteria

### Functional

- [ ] Push to `main` automatically deploys backend to Fly.io (GitHub Actions)
- [ ] Push to `main` automatically deploys frontend to Cloudflare Pages
- [ ] `https://jduel.xyz` serves the React app with valid TLS (no Certbot involved)
- [ ] `https://api.jduel.xyz/health` returns `{"status": "ok"}`
- [ ] WebSocket connections work end-to-end through Fly.io proxy
- [ ] WebSocket connections survive >60s idle in lobby (keepalive ping working)
- [ ] Full game flow works: room create → join → play → results → play again
- [ ] SPA deep links (`/room/AB3D`) return `index.html` (not 404)
- [ ] Development environment still works unchanged (`localhost:3000` / `localhost:8000`)

### Operational

- [ ] No manual SSH required for any deploy
- [ ] Backend never stops (in-memory rooms preserved) — `auto_stop_machines = false`
- [ ] Single instance enforced — `max_machines_running = 1`
- [ ] Fly.io health check passes within 30s of deploy
- [ ] `flyctl logs` shows NLP model loaded successfully at startup

### Cost

- [ ] Total monthly cost is $0 on Fly.io free tier (or ≤$2 if 512MB machine needed)
- [ ] Cloudflare Pages is free forever

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| 256MB OOM on Fly.io from NLP models | Low | RSS was 124MB on EC2. If OOM occurs, upgrade to 512MB (~$1.94/month) |
| WebSocket drops after Fly.io 60s idle timeout | **High** | uvicorn `--ws-ping-interval 30` flag sends protocol-level pings. Without this, lobby connections **will** drop. |
| Cloudflare orange-cloud proxy strips WebSocket upgrades | Medium | Use DNS-only (grey cloud) for `api.jduel.xyz` CNAME. Fly.io handles TLS directly. |
| Hugging Face model download fails during Docker build | Low | `SentenceTransformer()` at build time bakes the model in; no runtime download needed |
| DNS propagation delay during cutover | Medium | Cutover during low-traffic period; EC2 can stay up in parallel until propagation completes |
| Cloudflare Pages preview deployments hit CORS errors | Low | `CORS_ORIGIN_REGEX = r"https://.*\.pages\.dev"` covers all preview URLs |
| Docker layer cache invalidation re-downloads NLP model | Low | Multi-stage Dockerfile with model download before `COPY src/`; source changes don't bust cache |

---

## Dependencies and Prerequisites

- Fly.io account (free, create at fly.io)
- `flyctl` CLI installed locally
- Cloudflare account (free, create at cloudflare.com)
- jduel.xyz domain registered (already exists) with ability to change nameservers
- `FLY_API_TOKEN` secret added to GitHub repository
- Current `main` branch must be clean before starting DNS cutover

---

## Future Considerations

The new stack is compatible with adding auth (Supabase), payments (Stripe), monitoring (Grafana Cloud), or horizontal scaling (Redis + multi-machine) later — no infrastructure changes needed.

---

## References

### Internal

- `frontend/src/config.ts:1` — current URL construction logic
- `backend/src/app/config/environment.py:1` — CORS origins
- `backend/src/app/main.py:29` — `create_app()` factory
- `backend/pyproject.toml` — Python 3.13 requirement, NLP dependencies
- `docs/solutions/configuration-issues/backend-lightweight-mode.md` — `CUDA_VISIBLE_DEVICES=""` pattern
- `docs/brainstorms/2026-02-18-hosting-migration-flyio-cloudflare-brainstorm.md` — decision rationale

### External

- [Fly.io Docs — FastAPI deployment](https://fly.io/docs/python/frameworks/fastapi/)
- [Fly.io Docs — fly.toml reference](https://fly.io/docs/reference/configuration/)
- [Cloudflare Pages — Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages — Environment variables](https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables)
- [Cloudflare Pages — SPA routing (_redirects)](https://developers.cloudflare.com/pages/configuration/redirects/)
- [superfly/flyctl-actions — GitHub Action](https://github.com/superfly/flyctl-actions)
