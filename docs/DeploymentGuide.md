# Deployment Guide

How jDuel ships to production on the Oracle VPS.

## TL;DR

**Auto-deploy is the default.** Merge a PR to `main` and GitHub Actions takes
care of the rest:

1. `ci` job runs the pre-commit suite (ruff, pytest, mypy, prettier, eslint, tsc).
2. `changes` job decides whether production code changed.
3. `deploy` job (only on green CI + production-relevant paths) SSHes into the
   VPS and runs `./deploy.sh`.

No SSH from your laptop is required for routine deploys. If the workflow goes
red, you get an email with a link to the failing run.

## First-Time Setup

Run [`deploy/AUTO_DEPLOY_SETUP.md`](../deploy/AUTO_DEPLOY_SETUP.md) once to wire up:

- Branch protection on `main`
- Dedicated deploy SSH key
- Scoped sudoers entry on the VPS
- GitHub repository secrets
- Lockfile + notification settings

That runbook is the source of truth; this guide is the day-to-day reference.

## Day-to-Day

### Shipping a Change

1. Open a PR to `main`.
2. CI runs automatically. Green = merge button unlocked.
3. Merge. Within ~5 minutes the change is live at `jduel.xyz`.

### When the Path Filter Doesn't Match

Doc-only PRs (`docs/`, `CLAUDE.md`, `*.md`) merge cleanly without redeploying.
If you change something that *should* trigger a deploy but the path filter
missed it, trigger a manual run:

GitHub → Actions → CI + Deploy → Run workflow → `main`

### Emergency / Manual Deploy

Use this only when GitHub Actions is unavailable or you need to deploy from a
SHA that isn't on `main`:

```bash
ssh ubuntu@<DEPLOY_HOST>
cd /home/ubuntu/dev/jDuel
git pull
./deploy.sh
```

`deploy.sh` also supports:
- `--dry-run` — validates sudoers and prints what would run; touches nothing.
- `--force-dirty` — proceeds even if the working tree has uncommitted edits.
  Use only when the box state is intentionally the source of truth.

## Rollback

```bash
git revert <bad-sha>
git push origin main
```

The next auto-deploy restores prior behavior. For genuine emergencies where
GHA is down:

```bash
ssh ubuntu@<DEPLOY_HOST>
cd /home/ubuntu/dev/jDuel
git reset --hard <known-good-sha>
./deploy.sh
```

## When a Deploy Fails

1. **Workflow red email arrives.** Click the link to the failing run.
2. **Expand the `SSH to Oracle and run deploy.sh` step.** The full `deploy.sh`
   output is inline — the `❌` line is what failed.
3. **The site should still be up** on the prior code. `deploy.sh`'s EXIT trap
   best-effort restarts `jduel-backend` on any non-zero exit. Verify with
   `curl https://jduel.xyz`.
4. **If the site is actually down:** SSH in and check
   `sudo systemctl status jduel-backend` and `journalctl -u jduel-backend -n 100`.
5. **Resolve and retry.** Either push a fix to `main` (triggers a new deploy)
   or trigger a `workflow_dispatch` run if the underlying issue was transient
   (e.g., network blip during `git fetch`).

## Concurrency & Locking

Two safeguards prevent racing deploys:

1. **GHA `concurrency: deploy-prod`** — queues a second workflow run while
   the first is in-flight. Never cancels.
2. **`flock` in `deploy.sh`** — protects against a manual SSH deploy racing
   a CI deploy. Lockfile: `/var/run/jduel-deploy.lock`. Exits 75 if held.

## Provisioning a Fresh VPS

For initial Oracle Cloud setup (one-time, not for routine deploys):

```bash
bash deploy/setup.sh --domain yourdomain.com --user ubuntu
```

See [`deploy/README.md`](../deploy/README.md) for the Oracle-specific
prerequisites (Security List, DNS, iptables quirk).

## Architecture Notes

- Backend: FastAPI under `uvicorn`, single worker, in-memory state. Service
  unit at `/etc/systemd/system/jduel-backend.service`, runs as `ubuntu`.
- Frontend: static React/Vite build at `/var/www/jduel-frontend/dist`, served
  by nginx.
- Reverse proxy: nginx terminates TLS (Let's Encrypt via certbot) and proxies
  `/api/` + `/ws` to `127.0.0.1:8000`.
- CUDA explicitly disabled (`CUDA_VISIBLE_DEVICES=""`) — all NLP inference is
  CPU. This invariant lives in the systemd unit; `deploy.sh` does not change it.
- Each deploy stops the backend before building the frontend (Oracle box is
  4 GB; Vite build needs the RAM). Expect ~2 min of player-facing downtime.

## Related Documents

- [`deploy/AUTO_DEPLOY_SETUP.md`](../deploy/AUTO_DEPLOY_SETUP.md) — one-time
  configuration for the auto-deploy pipeline.
- [`deploy/README.md`](../deploy/README.md) — Oracle Cloud provisioning,
  manual setup, troubleshooting.
- [`docs/guides/MetricsSetup.md`](guides/MetricsSetup.md) — Grafana Alloy +
  Grafana Cloud observability.
- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — the
  pipeline definition itself.
