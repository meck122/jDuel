# Deployment Guide

Deploy jDuel to production on Ubuntu (AWS EC2). This guide consolidates all deployment configuration: SystemD, Nginx, and HTTPS.

## Prerequisites

- Ubuntu server (AWS EC2 or similar)
- Domain name configured (e.g., jduel.xyz)
- SSH access to server
- EC2 security group allows HTTP (80) and HTTPS (443)

## 1. Initial Server Setup

### Install Dependencies

```bash
sudo apt update
sudo apt install -y python3-pip nginx npm git

# Install uv package manager
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.cargo/env
```

### Clone and Build

```bash
git clone <repo-url>
cd jDuel

# Build frontend
cd frontend
npm install
npm run build

# Setup backend
cd ../backend
uv sync

# Install spaCy language model
uv run python -m ensurepip --upgrade
uv run python -m spacy download en_core_web_sm

# Import questions
uv run python src/scripts/import_questions.py
```

### Deploy Frontend Files

```bash
sudo mkdir -p /var/www/jduel-frontend
sudo cp -r frontend/dist /var/www/jduel-frontend/
sudo chown -R www-data:www-data /var/www/jduel-frontend
sudo chmod -R 755 /var/www/jduel-frontend
```

## 2. SystemD Service Setup

SystemD manages the backend process: auto-start on boot, restart on crash, logging via journald.

### Create Service File

```bash
sudo nano /etc/systemd/system/jduel-backend.service
```

```ini
[Unit]
Description=jDuel FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/jDuel/backend
ExecStart=/home/ubuntu/.local/bin/uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

**Adjust for your setup:** `User` (your username), `WorkingDirectory` (backend path), `ExecStart` (uv path - check with `which uv`).

### Enable and Start

```bash
sudo systemctl daemon-reload
sudo systemctl start jduel-backend
sudo systemctl enable jduel-backend
sudo systemctl status jduel-backend
```

### Service Commands

```bash
sudo systemctl start jduel-backend
sudo systemctl stop jduel-backend
sudo systemctl restart jduel-backend
sudo systemctl status jduel-backend
```

### View Logs

```bash
journalctl -u jduel-backend -f          # Real-time
journalctl -u jduel-backend -n 100      # Last 100 lines
journalctl -u jduel-backend -b          # Since last boot
```

### Reduce Memory (Optional)

Add to `[Service]` section to disable CUDA (saves ~1GB RAM):

```ini
Environment=CUDA_VISIBLE_DEVICES=
```

**RAM usage reference (CPU-only):** spaCy loads ~54MB, sentence-transformers ~16MB. Total backend ~846MB. With CUDA: ~2.9GB.

## 3. Nginx Reverse Proxy

Nginx serves frontend static files, proxies API/WebSocket to backend.

### Create Configuration

```bash
sudo nano /etc/nginx/sites-available/jduel
```

```nginx
server {
    listen 80;
    server_name jduel.xyz www.jduel.xyz;

    # Frontend static files
    root /var/www/jduel-frontend/dist;
    index index.html;

    # API endpoints -> FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket -> FastAPI backend
    location /ws {
        proxy_pass http://127.0.0.1:8000;

        # WebSocket upgrade headers
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Request info
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long timeouts for WebSocket
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback - serves index.html for client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/jduel /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default    # Remove default site
sudo nginx -t                                # Test configuration
sudo systemctl reload nginx
```

## 4. HTTPS with Let's Encrypt

### Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Get Certificate

Certbot automatically modifies your nginx config:

```bash
sudo certbot --nginx -d jduel.xyz -d www.jduel.xyz
```

Follow prompts: email, terms, redirect HTTP to HTTPS (recommended: yes).

### Verify and Auto-Renewal

```bash
# Check certificate
sudo certbot certificates

# Verify auto-renewal timer
sudo systemctl status certbot.timer

# Test renewal (dry run)
sudo certbot renew --dry-run
```

Certificates auto-renew every 60 days.

## 5. Deploying Updates

Use the deployment script:

```bash
./deploy.sh
```

Or manually:

```bash
cd ~/jDuel && git pull

# If frontend changed
cd frontend && npm run build
sudo cp -r dist /var/www/jduel-frontend/
sudo systemctl reload nginx

# If backend changed
cd ../backend
sudo systemctl restart jduel-backend
```

## 6. Troubleshooting

**Service won't start:**
```bash
journalctl -u jduel-backend -n 50
```
Common: wrong uv path (`which uv`), wrong working directory, missing deps (`uv sync`), port 8000 in use (`sudo lsof -i :8000`).

**WebSocket fails:**
- Check nginx config has `Upgrade` and `Connection` headers
- Check timeouts are high enough (86400)
- Test backend directly: `curl http://127.0.0.1:8000/health`

**404 on frontend routes:**
- Verify `try_files` fallback exists in nginx config
- Check files exist in `/var/www/jduel-frontend/dist`

**Nginx config errors:**
```bash
sudo nginx -t                          # Test config syntax
sudo systemctl restart nginx           # Full restart if reload doesn't work
sudo tail -f /var/log/nginx/error.log  # View error logs
```

**Certificate issues:**
- Verify DNS points to server IP
- Ensure port 80 accessible (certbot HTTP challenge)
- Check nginx running: `sudo systemctl status nginx`

**Memory issues on small instances:**
- Disable CUDA: add `Environment=CUDA_VISIBLE_DEVICES=` to service file
- Consider t3.medium or larger for NLP model loading

## Architecture

```
Internet → Nginx (port 80/443)
              ├── Static files: /var/www/jduel-frontend/dist
              ├── /api/* → FastAPI (localhost:8000)
              └── /ws → FastAPI WebSocket (localhost:8000)
```

- **Nginx handles ports 80/443** - No need to run FastAPI as root
- **Reverse proxy** - Better security, logging, SSL termination
- **WebSocket support** - Nginx properly upgrades connections
- **SystemD manages backend** - Auto-restart, boot start, logging
