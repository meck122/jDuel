# 1. Build your frontend

cd /path/to/frontend
VITE_WS_URL=ws://jduel.xyz/ws VITE_API_URL=http://jduel.xyz/api npm run build # Creates dist/ folder

# 2. Copy to server

sudo mkdir -p /var/www/jduel-frontend
sudo cp -r dist /var/www/jduel-frontend/

# 3. Set permissions

sudo chown -R www-data:www-data /var/www/jduel-frontend
sudo chmod -R 755 /var/www/jduel-frontend

# 4. Update nginx config

sudo nano /etc/nginx/sites-available/jduel.xyz

# 5. Test config

sudo nginx -t

# 6. Reload nginx

sudo systemctl reload nginx

# 7. Verify FastAPI is running

curl http://127.0.0.1:8000/health

```nginx
server {
    listen 80;
    server_name jduel.xyz www.jduel.xyz;

    # Where your built React/Vue/etc app lives
    # Build your frontend: npm run build
    # Copy dist folder to: /var/www/jduel-frontend/
    root /var/www/jduel-frontend/dist;
    index index.html index.htm;

    # API endpoints - handled by FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000;

        # Preserve original request info
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CORS headers (if needed)
        # add_header Access-Control-Allow-Origin *;
    }

    # WebSocket - handled by FastAPI
    location /ws {
        proxy_pass http://127.0.0.1:8000;

        # WebSocket upgrade headers
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Preserve original request info
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
        # Nginx serves these directly from /var/www/jduel-frontend/dist
    }

    # SPA fallback - serves index.html for client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
