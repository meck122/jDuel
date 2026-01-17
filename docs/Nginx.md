# Nginx Configuration

Configure Nginx as a reverse proxy for jDuel.

## Overview

Nginx handles:

- Serving frontend static files
- Proxying API requests to backend
- Upgrading WebSocket connections
- Caching static assets

## Configuration File

Create nginx site configuration:

```bash
# Contains all nginx site config files
sudo nano /etc/nginx/sites-available/jduel

# Nginx actually reads from here (typically contains sym links which we link below)
sudo nano /etc/nginx/sites-enabled/jduel
```

Add the following (replace `jduel.xyz` with your domain):

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

## Enable the Site

```bash
# Create symbolic link to enable
sudo ln -s /etc/nginx/sites-available/jduel /etc/nginx/sites-enabled/

# Remove default site if present
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Update After Frontend Changes

```bash
# Copy new build
sudo cp -r frontend/dist /var/www/jduel-frontend/

# Fix permissions
sudo chown -R www-data:www-data /var/www/jduel-frontend
sudo chmod -R 755 /var/www/jduel-frontend

# Reload nginx
sudo systemctl reload nginx
```

## Configuration Explained

### Frontend Serving

```nginx
root /var/www/jduel-frontend/dist;
```

Serves built frontend files directly from disk.

### API Proxying

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;
```

Routes `/api/*` requests to backend on port 8000.

### WebSocket Upgrade

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Required headers to upgrade HTTP to WebSocket.

### SPA Fallback

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Serves `index.html` for any unmatched routes (enables client-side routing).

## Troubleshooting

**Configuration test fails:**

```bash
sudo nginx -t
# Read error message carefully - usually syntax or path issues
```

**Changes not taking effect:**

```bash
# Reload doesn't work for all changes - try restart
sudo systemctl restart nginx
```

**404 on frontend routes:**

- Check `try_files` fallback is present
- Verify dist files exist in `/var/www/jduel-frontend/dist`

**WebSocket connection fails:**

- Verify `Upgrade` and `Connection` headers are set
- Check timeout values are high enough
- Test backend directly: `curl http://127.0.0.1:8000/health`

**View logs:**

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```
