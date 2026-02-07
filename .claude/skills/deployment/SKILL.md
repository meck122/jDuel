---
name: deployment
description: Production deployment to EC2 — deploy.sh walkthrough, SystemD management, rollback, and health checks. Use when deploying, troubleshooting production, or planning infrastructure changes.
---

# Deployment

jDuel deploys to an Ubuntu EC2 instance using SystemD + Nginx. No Docker, no CI/CD — manual deploy via `deploy.sh`.

## deploy.sh Walkthrough

The script runs 8 steps sequentially (`set -e` — fails fast on any error):

| Step | What it does | Why |
|------|-------------|-----|
| 1. Stop backend | `sudo systemctl stop jduel-backend` | Frees RAM for frontend build (NLP models use ~846MB) |
| 2. Build frontend | `npm install && npm run build` | Produces `frontend/dist/` static files |
| 3. Install backend deps | `uv sync` | Picks up new Python dependencies |
| 4. Copy frontend files | `cp -r dist /var/www/jduel-frontend/` | Deploy to Nginx-served directory |
| 5. Reload systemd | `daemon-reload` | Picks up service file changes |
| 6. Start backend | `sudo systemctl start jduel-backend` | Starts FastAPI with NLP model loading (~10s) |
| 7. Reload nginx | `sudo systemctl reload nginx` | Zero-downtime config reload |
| 8. Verify | Check both services active | Fails loudly if either service is down |

**Downtime:** Backend is stopped during the entire deploy (steps 1-6). Frontend static files are served by Nginx throughout, but API/WebSocket calls fail during this window.

## Rolling Back a Bad Deploy

```bash
# 1. Revert to last known good commit
git log --oneline -5           # Find the good commit
git checkout <good-commit>     # Detach HEAD at that commit

# 2. Re-run deploy
./deploy.sh

# 3. After verifying, return to main
git checkout main
```

If only the backend is broken:
```bash
sudo systemctl restart jduel-backend
journalctl -u jduel-backend -n 50    # Check what went wrong
```

If only the frontend is broken:
```bash
cd frontend && npm run build
sudo cp -r dist /var/www/jduel-frontend/
sudo systemctl reload nginx
```

## SystemD Service Management

```bash
# Status and control
sudo systemctl status jduel-backend
sudo systemctl start jduel-backend
sudo systemctl stop jduel-backend
sudo systemctl restart jduel-backend

# Logs
journalctl -u jduel-backend -f          # Real-time tail
journalctl -u jduel-backend -n 100      # Last 100 lines
journalctl -u jduel-backend -b          # Since last boot
journalctl -u jduel-backend --since "1 hour ago"
```

Service file: `/etc/systemd/system/jduel-backend.service`

Key settings:
- `Restart=always` + `RestartSec=3` — auto-restart on crash
- `Environment=PYTHONUNBUFFERED=1` — real-time log output
- Optional `Environment=CUDA_VISIBLE_DEVICES=` — disable CUDA to save ~2GB RAM

## Nginx

```bash
sudo nginx -t                    # Test config syntax (always do this first)
sudo systemctl reload nginx      # Graceful reload (zero downtime)
sudo systemctl restart nginx     # Full restart (brief downtime)
sudo tail -f /var/log/nginx/error.log
```

Config file: `/etc/nginx/sites-available/jduel`

**Reload vs restart:** Use `reload` for config changes. Use `restart` only if reload fails or after major changes.

## Health Checks

```bash
# Backend health
curl http://127.0.0.1:8000/health

# From outside (through Nginx)
curl https://jduel.xyz/health
```

The `/health` endpoint returns 200 when the FastAPI server is running. It does not verify NLP model loading — the app serves requests immediately, and model loading happens in the background during lifespan startup.

## Memory

| Component | RAM (CPU-only) |
|-----------|---------------|
| spaCy `en_core_web_sm` | ~54MB |
| sentence-transformers `all-MiniLM-L6-v2` | ~16MB |
| Total backend | ~846MB |
| With CUDA enabled | ~2.9GB |

For `t3.small` (2GB): Must disable CUDA. For `t3.medium` (4GB): Safe with CUDA disabled, tight with CUDA.

## Common Issues

**OOM on small instances:** Add `Environment=CUDA_VISIBLE_DEVICES=` to the service file to disable CUDA and save ~2GB.

**Backend won't start:**
```bash
which uv                                   # Verify uv path matches service file
journalctl -u jduel-backend -n 50          # Check error
sudo lsof -i :8000                         # Port already in use?
```

**WebSocket 502 errors:** Nginx config missing `Upgrade`/`Connection` headers or timeouts too low. Check `/etc/nginx/sites-available/jduel`.

**Certificate renewal failed:** Ensure port 80 is open (certbot HTTP challenge), DNS points to server IP, and Nginx is running.

## Key Files

| File | Role |
|------|------|
| `deploy.sh` | Full-stack deployment script |
| `/etc/systemd/system/jduel-backend.service` | SystemD service definition |
| `/etc/nginx/sites-available/jduel` | Nginx reverse proxy config |
| `docs/DeploymentGuide.md` | Comprehensive deployment documentation |
