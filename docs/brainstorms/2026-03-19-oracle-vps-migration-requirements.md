---
date: 2026-03-19
topic: oracle-vps-migration
---

# Oracle VPS Migration

## Problem Frame

The production jDuel app runs on AWS EC2. We are migrating it to an Oracle Cloud aarch64 VM
(4 GB RAM, ~50 GB disk) at `147.224.154.73`. The domain `jduel.com` still points to AWS.
The immediate goal is a working deployment reachable via the raw public IP before DNS cutover.

## Requirements

- R1. CORS allows requests from `http://147.224.154.73` so the React frontend can call the
  FastAPI backend while testing on the raw IP.
- R2. The FastAPI backend runs as a systemd service (`jduel-backend`) bound to `127.0.0.1:8000`.
- R3. nginx serves the React frontend static files and reverse-proxies `/api/` and `/ws` to
  the backend.
- R4. The app is reachable at `http://147.224.154.73` (HTTP, no TLS yet).
- R5. Oracle's iptables rules allow inbound TCP on ports 80 and 443.
- R6. The domain `jduel.com` is already in CORS; no additional CORS change is needed for DNS cutover.

## Scope Boundaries

- No HTTPS / certbot until DNS is pointed at the Oracle IP.
- No DNS changes in this phase.
- Do not modify any tracked source files except `environment.py` (CORS) and accept path fix
  via symlink to avoid modifying `setup.sh`.

## Key Decisions

- **Path fix in setup.sh**: Updated default `REPO_DIR` to `~/dev/jDuel` and added `--repo-dir`
  flag; also fixed the hardcoded `WorkingDirectory` sed substitution to use `$REPO_DIR`.
- **Certbot skipped**: Say N when prompted; run manually after DNS cutover.
- **Domain**: jduel.com (already in CORS; no change needed for final cutover).

## Success Criteria

- `curl http://127.0.0.1:8000/health` returns 200.
- `curl http://147.224.154.73/` returns the React app HTML.
- WebSocket connects from a browser pointed at `http://147.224.154.73`.
- `systemctl is-active jduel-backend` → `active`.

## Next Steps

→ Proceed directly to work (all decisions resolved, scope is clear)
