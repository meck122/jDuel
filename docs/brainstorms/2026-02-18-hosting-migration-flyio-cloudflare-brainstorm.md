# Brainstorm: Hosting Migration — Fly.io + Cloudflare Pages

**Date:** 2026-02-18
**Status:** Decision made
**Branch:** N/A (infrastructure, no code changes)

---

## Context

jDuel is currently hosted on an AWS EC2 t2.micro instance. The free tier is expiring soon. The current setup is entirely manual: SSH to deploy, configure nginx/systemd/certbot by hand, no CI/CD.

**What we want to change:**
- Auto-deploy on git push (no more manual SSH)
- Managed TLS, routing, and process restarts (no nginx/certbot/systemd config)
- Free or near-free hosting
- Easy extensibility for Stripe payments and auth in the future

---

## Key Constraints

- **WebSockets required** — long-lived connections for real-time multiplayer. Rules out pure serverless (Vercel, Netlify Functions, AWS Lambda).
- **Single uvicorn worker** — in-memory game state, no horizontal scaling needed now.
- **NLP models are memory-mapped** — actual RSS is ~124MB on EC2 (VSZ is 5.3GB but mmap'd). A container only needs ~150-170MB RAM total.
- **No database** — all state in-memory.
- **Future:** Stripe payments, user auth/login, metrics (Prometheus/Grafana).

---

## What We're Building

Migrate from EC2 (manual ops) to a fully managed, auto-deploying stack:

| Component | Current | New |
|-----------|---------|-----|
| Backend (FastAPI + WS) | EC2 + systemd + nginx proxy | Fly.io (Docker container) |
| Frontend (React/Vite) | EC2 + nginx static files | Cloudflare Pages |
| TLS/HTTPS | Certbot (manual renewal) | Automatic (both platforms) |
| Deploy | Manual SSH + deploy.sh | GitHub Actions (auto on push) |
| Monitoring | journalctl logs | Fly.io dashboard + Grafana Cloud (future) |

---

## Why This Approach

### Fly.io for the Backend

- **WebSocket support is first-class** — Fly.io runs persistent machines, not serverless functions. Connections stay open as long as needed.
- **Free tier is sufficient** — 256MB RAM per VM. Our app uses ~124MB RSS (NLP models are mmap'd, not fully resident). ~150-170MB total in a container, comfortably under 256MB.
- **No spin-down** — unlike Render.com free tier, Fly machines stay running. Critical for a game server.
- **Automatic TLS** — no Certbot to manage. Fly handles cert rotation.
- **GitHub Actions deploy** — `flyctl deploy` in a workflow = push to main triggers deploy.
- **Requires a Dockerfile** — straightforward for FastAPI/uvicorn, but is a new artifact to maintain.

### Cloudflare Pages for the Frontend

- **Best static hosting available** — global CDN, unlimited requests, free forever.
- **Auto-deploy on push** — connect GitHub repo, Cloudflare builds and deploys on every push.
- **Zero config TLS** — automatic, no maintenance.
- **Free forever** — no tier limits that would end.

### Why Not Alternatives

| Option | Reason Eliminated |
|--------|-------------------|
| Vercel (backend) | Serverless only — WebSockets not supported for long-lived connections |
| Render.com (backend) | Free tier spins down after 15 min inactivity — unacceptable for a game server |
| Railway.app | Good option, but ~$2-3/month once free credit runs out. Fly.io is $0. |
| Koyeb | Free nano tier also 256MB, but less mature ecosystem than Fly.io |
| EC2 + GitHub Actions | Free tier ending. t3.nano costs $3.50/month. More ops burden. |

---

## Key Decisions

1. **Split backend and frontend** — Backend on Fly.io, frontend on Cloudflare Pages. CORS config on the FastAPI backend needs to allow the Cloudflare Pages domain.

2. **Keep NLP** — The RSS footprint is ~124MB, well within Fly.io's 256MB free tier. No need to remove open-ended answer checking.

3. **Single machine on Fly.io** — No horizontal scaling needed now. If scale becomes necessary later, Fly.io supports it but we'd need to add a shared state layer (Redis or similar) for WebSocket sessions.

4. **GitHub Actions for CI/CD** — One workflow for backend deploy (`flyctl deploy`), one for frontend (Cloudflare Pages auto-handles this via GitHub app). Push to `main` triggers both.

5. **Dockerfile for backend** — Simple multi-stage build: install `uv`, sync dependencies, copy app, run `uvicorn`. No OS-level config needed.

---

## Future Extensibility

- **Stripe payments** — Add Stripe SDK to FastAPI backend. No platform changes needed. Works natively on Fly.io.
- **Auth/login** — Add to FastAPI (JWT/session). Supabase Auth is a strong free option for the auth layer. Fly.io is agnostic.
- **Metrics** — Fly.io exposes built-in CPU/memory metrics. For app-level metrics: add `prometheus-fastapi-instrumentator` to FastAPI, use Grafana Cloud free tier (10k metrics, 50GB logs, 14-day retention).
- **Scaling** — Fly.io can scale machine sizes or add more machines. Would require adding Redis for shared WebSocket state.

---

## Open Questions

- What should the Fly.io app name and region be? (closest region to user/players)
- Should the Fly.io machine be always-on or use Fly's auto-suspend (saves cost but adds cold-start latency)?
- Does `config.ts` in the frontend need environment variable support to switch between dev (localhost) and prod (fly.io URL)?

---

## Next Steps

Run `/workflows:plan` to create a migration plan covering:
1. Writing the Dockerfile for the FastAPI backend
2. Creating the Fly.io app and configuring `fly.toml`
3. Connecting Cloudflare Pages to the GitHub repo
4. Setting up GitHub Actions workflows for automated deploy
5. Updating CORS config and frontend `config.ts` for the new URLs
6. DNS migration (point jduel.xyz to new infrastructure)
7. Cutover and smoke testing
