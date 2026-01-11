# jDuel Setup Guide

This guide covers both local development and production deployment on AWS EC2.

## Local Development Setup

### Prerequisites

- Python 3.13+
- Node.js and npm
- uv package manager ([installation guide](https://astral.sh/uv))

### Quick Start

**Terminal 1 - Backend (with auto-reload):**

```bash
cd backend
uv run uvicorn app.main:app --reload
```

Backend runs on `http://localhost:8000`

**Terminal 2 - Frontend (dev server):**

```bash
cd frontend
npm install  # first time only
npm run dev
```

Frontend runs on `http://localhost:5173`

### Import Questions

Load trivia questions from CSV into the backend:

```bash
cd backend
uv run python src/scripts/import_questions.py
```

---

## Production Deployment (AWS EC2)

This guide assumes you're deploying on Ubuntu.

### Step 1: Initial Server Setup

Update packages and install dependencies:

```bash
# Update package list
sudo apt update

# Install required packages
sudo apt install -y python3-pip nginx npm git

# Install uv package manager
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.cargo/env
```

### Step 2: Clone and Build Project

```bash
# Clone your repository
git clone <repo-url>
cd jDuel

# Install frontend dependencies
cd frontend
npm install

# Build frontend with production WebSocket URL
# Replace <public-aws-ip> with your EC2 instance's public IP
VITE_WS_URL='ws://<public-aws-ip>/ws' npm run build

# Install backend dependencies
cd ../backend
uv sync
```

### Step 3: Configure Nginx as Reverse Proxy

Nginx handles incoming HTTP requests and WebSocket upgrades, forwarding them to the FastAPI backend.

Create nginx configuration:

```bash
sudo vim /etc/nginx/sites-enabled/jduel
```

Paste the following configuration (replace `<public-aws-ip>` with your EC2 public IP):

```nginx
server {
    listen 80;
    server_name <public-aws-ip>;

    location / {
        proxy_pass http://127.0.0.1:8000;

        # WebSocket support (required for real-time game functionality)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Test and reload nginx:

```bash
# Test configuration syntax
sudo nginx -t

# Reload nginx to apply changes
sudo systemctl reload nginx
```

### Step 4: Configure Systemd Service

Set up systemd to automatically start the backend and keep it running.

Create service file:

```bash
sudo vim /etc/systemd/system/jduel-backend.service
```

Paste the following configuration (adjust paths if needed):

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
Environment=FRONTEND_URL=<public-aws-ip>

[Install]
WantedBy=multi-user.target
```

> **Note:** Set `FRONTEND_URL` to your EC2 public IP for CORS configuration.

Enable and start the service:

```bash
# Reload systemd to recognize new service
sudo systemctl daemon-reload

# Start the service
sudo systemctl start jduel-backend

# Enable auto-start on boot
sudo systemctl enable jduel-backend
```

### Step 5: Verify Deployment

Check service status:

```bash
# View current status
sudo systemctl status jduel-backend

# Follow logs in real-time
journalctl -u jduel-backend -f
```

Test the application by visiting `http://<public-aws-ip>` in your browser.

### Managing the Service

```bash
# Restart after code changes
sudo systemctl restart jduel-backend

# Stop the service
sudo systemctl stop jduel-backend

# View recent logs
journalctl -u jduel-backend -n 100

# View logs with follow
journalctl -u jduel-backend -f
```

---

## Deploying Updates

When you update the code:

```bash
cd ~/jDuel

# Pull latest changes
git pull

# Rebuild frontend (if frontend changed)
cd frontend
VITE_WS_URL='ws://<public-aws-ip>/ws' npm run build

# Restart backend service
cd ..
sudo systemctl restart jduel-backend
```

---

## Architecture Notes

### Development Mode

- Frontend dev server (port 5173) with hot-reload
- Backend server (port 8000) with auto-reload
- Separate processes for faster iteration

### Production Mode

- Frontend built to `frontend/dist/`
- FastAPI serves static files from `dist/` automatically
- Nginx reverse proxy handles incoming traffic on port 80
- Backend runs on localhost:8000 (not exposed externally)
- Everything accessible through single domain/IP

### Why Nginx?

- Handles WebSocket upgrades properly
- Provides standard reverse proxy benefits (headers, SSL termination, etc.)
- Allows serving on port 80 without running FastAPI as root

---

## Troubleshooting

**Service won't start:**

```bash
# Check for detailed error messages
journalctl -u jduel-backend -n 50
```

**WebSocket connection fails:**

- Verify nginx configuration includes WebSocket headers
- Check that `VITE_WS_URL` in frontend build matches your domain
- Ensure port 80 is open in EC2 security group

**Port already in use:**

```bash
# Find process using port 8000
sudo lsof -i :8000

# Kill if necessary
sudo kill <PID>
```

**Cannot connect to EC2 instance:**

- Verify EC2 security group allows inbound traffic on port 80
- Check that nginx is running: `sudo systemctl status nginx`
