# jDuel — Deployment

Production deployment config for Oracle Cloud (Ubuntu). Run `setup.sh` once on a fresh
instance; use `deploy.sh` from the repo root for all subsequent updates.

## Files

```
deploy/
├── setup.sh                 # One-shot provisioning script (run once on fresh instance)
├── jduel-backend.service    # systemd unit file for the FastAPI backend
├── nginx/
│   └── jduel               # Nginx reverse proxy config
└── README.md               # This file
```

## Oracle Cloud Prerequisites

Before running setup, do these in the Oracle Cloud Console:

1. **Security List / Ingress Rules** — open TCP ports 80 and 443 from 0.0.0.0/0
2. **SSH key** — ensure you can SSH in as `ubuntu` (Ubuntu image) or `opc` (Oracle Linux)
3. **DNS** — point your domain's A record to the instance's public IP

> **Important — Oracle iptables quirk:** Oracle Cloud adds restrictive `iptables` rules
> that block inbound traffic even when the Security List is open. `setup.sh` handles
> this automatically by inserting `INPUT` rules and persisting them with
> `netfilter-persistent save`. If you skip `setup.sh` and configure manually, run:
>
> ```bash
> sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 80 -j ACCEPT
> sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 443 -j ACCEPT
> sudo netfilter-persistent save
> ```

## Quick Start (fresh Ubuntu instance)

```bash
# Clone the repo
git clone <repo-url>
cd dev/jDuel

# Run provisioning (defaults: --domain jduel.com --user ubuntu)
bash deploy/setup.sh --domain yourdomain.com --user ubuntu
```

That's it. The script:
1. Installs system deps (nginx, npm, python3-pip, certbot, iptables-persistent)
2. Installs `uv` if missing; upgrades Node to 22 if < 18
3. Opens ports 80 and 443 in Oracle's iptables
4. Builds the React frontend and deploys to `/var/www/jduel-frontend/dist`
5. Runs `uv sync` and downloads the spaCy NLP model
6. Installs and enables `jduel-backend.service` (patched with your username/paths)
7. Drops the nginx config, removes the default site, reloads nginx
8. Optionally runs `certbot --nginx` for HTTPS

## Manual Setup (step by step)

### systemd service

```bash
# Review / edit the User, WorkingDirectory, ExecStart paths first:
nano deploy/jduel-backend.service

sudo cp deploy/jduel-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now jduel-backend
```

### Nginx

```bash
# Edit server_name if your domain differs from jduel.com:
nano deploy/nginx/jduel

sudo cp deploy/nginx/jduel /etc/nginx/sites-available/jduel
sudo ln -s /etc/nginx/sites-available/jduel /etc/nginx/sites-enabled/jduel
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## Domain / CORS Notes

If you're hosting on a **new domain**, update `backend/src/app/config/environment.py`
to add the new origins to `CORS_ORIGINS` before deploying.

The frontend `config.ts` derives API/WebSocket URLs dynamically from
`window.location.host`, so no frontend changes are needed for a new domain.

## Deploying Updates

After initial setup, use the deploy script for all future updates:

```bash
cd ~/dev/jDuel && git pull && ./deploy.sh
```

## Troubleshooting

| Problem | Check |
|---------|-------|
| Site unreachable on port 80/443 | Oracle Security List AND `sudo iptables -L INPUT` |
| Backend won't start | `journalctl -u jduel-backend -n 50` |
| WebSocket errors | nginx `Upgrade`/`Connection` headers; `proxy_read_timeout 86400` |
| 404 on page refresh | `try_files $uri $uri/ /index.html` in nginx config |
| High memory usage | Add `Environment=CUDA_VISIBLE_DEVICES=` to service file |
| Certbot fails | DNS must resolve to this IP before running; port 80 must be open |
