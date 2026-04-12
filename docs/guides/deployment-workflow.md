# Deployment Workflow

How code gets from your machine to production in the new architecture.

---

## Architecture Overview

```
GitHub (main branch)
  │
  ├── backend/** changed  ──>  GitHub Actions  ──>  Fly.io (Docker container)
  │                              runs flyctl deploy     api.jduel.xyz
  │
  └── anything changed    ──>  Cloudflare Pages  ──>  CDN Edge (static files)
                                auto-builds              jduel.xyz
```

Two completely independent deploy pipelines. A backend-only change does NOT redeploy the frontend (and vice versa... mostly -- see note below).

---

## Frontend Deployment (Cloudflare Pages)

### How it works

Cloudflare Pages has a direct GitHub integration (not GitHub Actions). It watches your repo and builds on every push.

### Trigger
**Any push to `main`** triggers a Cloudflare Pages build. There is no path filter -- even a README change triggers a build. This is fine because builds are fast (~30s) and free.

Pushes to **non-main branches** create preview deployments at `<branch-hash>.jduel.pages.dev`.

### What happens on deploy

```
1. You push to main
2. Cloudflare detects the push (via GitHub app integration)
3. Cloudflare runs: cd frontend && npm ci && npm run build
4. Vite builds the React app, baking in VITE_* env vars at build time
5. Cloudflare uploads frontend/dist/ to its global CDN
6. Site is live at jduel.xyz within ~30 seconds
```

### Key detail: Environment variables are baked at build time

`VITE_API_URL` and `VITE_WS_URL` are injected by Vite during the build step. They become hardcoded strings in the JavaScript bundle. Changing an env var in Cloudflare Pages requires a **rebuild** (trigger one manually or push a commit).

### How to trigger a manual redeploy

Cloudflare Pages dashboard > your project > **Deployments** > **Retry deployment** on the latest build.

### Rollback

Cloudflare Pages dashboard > **Deployments** > click any previous deployment > **Rollback to this deploy**. Instant, no rebuild needed.

---

## Backend Deployment (Fly.io via GitHub Actions)

### How it works

A GitHub Actions workflow runs `flyctl deploy` which builds a Docker image and deploys it to Fly.io.

### Trigger
Push to `main` **where `backend/**` files changed**. The workflow has a path filter:

```yaml
on:
  push:
    branches: [main]
    paths:
      - "backend/**"
      - ".github/workflows/deploy-backend.yml"
```

Frontend-only changes do NOT trigger a backend deploy.

### What happens on deploy

```
1. You push to main (with backend/ changes)
2. GitHub Actions triggers the deploy-backend workflow
3. Workflow checks out code and runs: flyctl deploy --remote-only
4. --remote-only means the Docker image builds on Fly.io's servers (not in GitHub Actions)
5. Fly.io builds the Docker image:
   a. Installs Python dependencies (uv sync)
   b. Downloads the sentence-transformers NLP model
   c. Copies source code
   d. Creates a slim production image
6. Fly.io starts the new machine with the new image
7. Health check hits /health -- waits up to 30s for NLP models to load
8. If healthy, old machine is replaced. If unhealthy, rollback to previous version.
9. api.jduel.xyz is serving the new code
```

### How to deploy manually (without pushing)

```bash
cd backend
flyctl deploy
```

This builds and deploys from your local machine. Useful for first deploy or debugging.

### Rollback

```bash
flyctl releases
flyctl deploy --image <previous-image-ref>
```

Or from the Fly.io dashboard: **Machines** > select the machine > **Rollback**.

### Monitoring

```bash
flyctl logs          # Stream live logs
flyctl status        # Machine status, uptime, region
flyctl ssh console   # SSH into the running container (for debugging)
```

---

## Day-to-Day Workflow

### Normal development

```
1. Work on a feature branch
2. Push to GitHub, open a PR
   - Cloudflare Pages creates a preview deploy (frontend)
   - No backend preview (it's a single shared instance)
3. Merge PR to main
   - Cloudflare Pages auto-deploys frontend
   - GitHub Actions auto-deploys backend (if backend/ changed)
4. Done. No SSH, no scripts, no manual steps.
```

### Backend-only change (e.g., new API endpoint)

```
Push to main with backend/ changes
  → GitHub Actions deploys to Fly.io (~2-3 min)
  → Frontend is untouched
```

### Frontend-only change (e.g., UI tweak)

```
Push to main with frontend/ changes
  → Cloudflare Pages rebuilds and deploys (~30s)
  → Backend is untouched
```

### Both changed (e.g., new WebSocket message type)

```
Push to main with both backend/ and frontend/ changes
  → GitHub Actions deploys backend to Fly.io (~2-3 min)
  → Cloudflare Pages deploys frontend (~30s)
  → Both deploy in parallel, independently
```

**Note on ordering:** The frontend usually deploys faster than the backend. If you add a new backend endpoint and the frontend expects it, there may be a brief window (~1-2 min) where the new frontend is live but the old backend is still running. For jDuel this is unlikely to matter, but be aware of it for breaking changes.

---

## Comparison with Old Workflow

| | Old (EC2) | New (Fly.io + Cloudflare) |
|---|-----------|--------------------------|
| **Deploy** | SSH into EC2, run `deploy.sh` | Push to `main` |
| **Time** | ~2 min manual process | ~30s frontend, ~3 min backend (automatic) |
| **TLS** | Certbot (manual renewal) | Automatic (both platforms) |
| **Rollback** | SSH + git checkout + restart | One click in dashboard |
| **Logs** | `journalctl -u jduel-backend` | `flyctl logs` |
| **Cost** | EC2 free tier (expiring) | $0 (Fly.io free + Cloudflare free) |
| **Downtime during deploy** | Yes (backend stops for build) | No (Fly.io blue-green deployment) |
