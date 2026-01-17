# Production Deployment

Deploy jDuel to a production server. This guide assumes Ubuntu on AWS EC2.

## Prerequisites

- Ubuntu server (AWS EC2 or similar)
- Domain name configured (e.g., jduel.xyz)
- SSH access to server
- EC2 security group allows HTTP (port 80)

## Initial Server Setup

### 1. Install Dependencies

```bash
sudo apt update
sudo apt install -y python3-pip nginx npm git

# Install uv package manager
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.cargo/env
```

### 2. Clone Project

```bash
git clone <repo-url>
cd jDuel
```

### 3. Build Frontend

Replace `jduel.xyz` with your domain:

```bash
cd frontend
npm install
npm run build
```

### 4. Setup Backend

```bash
cd ../backend
uv sync

# Install spaCy language model
uv run python -m ensurepip --upgrade
uv run python -m spacy download en_core_web_sm

# Import questions
uv run python src/scripts/import_questions.py
```

### 5. Deploy Frontend Files

```bash
sudo mkdir -p /var/www/jduel-frontend
sudo cp -r frontend/dist /var/www/jduel-frontend/
sudo chown -R www-data:www-data /var/www/jduel-frontend
sudo chmod -R 755 /var/www/jduel-frontend
```

### 6. Configure Services

Configure Nginx and SystemD - see:

- **[Nginx Configuration](Nginx.md)**
- **[SystemD Service](SystemD.md)**

## Deploying Updates

When you push code changes:

```bash
cd ~/jDuel
git pull

# If frontend changed
cd frontend
npm run build
sudo cp -r dist /var/www/jduel-frontend/
sudo systemctl reload nginx

# If backend changed
cd ../backend
sudo systemctl restart jduel-backend
```

## Verification

### Check Services

```bash
# Check backend service
sudo systemctl status jduel-backend

# Check nginx
sudo systemctl status nginx

# Test backend directly
curl http://127.0.0.1:8000/health
```

### View Logs

```bash
# Backend logs (real-time)
journalctl -u jduel-backend -f

# Backend logs (last 100 lines)
journalctl -u jduel-backend -n 100

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Test Application

Visit `http://jduel.xyz` (or your domain) in a browser.

## Architecture

### Production Setup

- Nginx listens on port 80 (public)
- FastAPI backend runs on localhost:8000 (internal only)
- Nginx serves frontend static files
- Nginx proxies API/WebSocket to backend
- SystemD manages backend process

### Why This Architecture?

- **Nginx handles port 80** - No need to run FastAPI as root
- **Reverse proxy** - Better security, logging, and SSL support
- **WebSocket support** - Nginx properly upgrades connections
- **Static file serving** - Nginx efficiently serves frontend

## Troubleshooting

**Service won't start:**

```bash
journalctl -u jduel-backend -n 50
```

**WebSocket fails:**

- Check nginx config includes WebSocket headers (see [Nginx.md](Nginx.md))
- Ensure port 80 is open in security group

**Cannot connect to server:**

- Verify security group allows port 80 inbound
- Check nginx: `sudo systemctl status nginx`
- Check DNS resolves to server IP

**Backend shows wrong URL in logs:**

- Update `FRONTEND_URL` in SystemD service file (see [SystemD.md](SystemD.md))
