# SystemD Service

Configure SystemD to automatically start and manage the jDuel backend service.

## Overview

SystemD will:

- Start backend on server boot
- Restart backend if it crashes
- Manage backend lifecycle
- Provide logging via journald

## Create Service File

```bash
sudo nano /etc/systemd/system/jduel-backend.service
```

Add the following configuration:

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
Environment=FRONTEND_URL=http://jduel.xyz

[Install]
WantedBy=multi-user.target
```

**Adjust these values for your setup:**

- `User` - Your server username (typically `ubuntu` on EC2)
- `WorkingDirectory` - Path to your backend directory
- `ExecStart` - Path to uv binary (check with `which uv`)
- `FRONTEND_URL` - Your domain for CORS configuration

## Enable and Start Service

```bash
# Reload SystemD to recognize new service
sudo systemctl daemon-reload

# Start the service
sudo systemctl start jduel-backend

# Enable auto-start on boot
sudo systemctl enable jduel-backend

# Check status
sudo systemctl status jduel-backend
```

## Managing the Service

### Basic Commands

```bash
# Start service
sudo systemctl start jduel-backend

# Stop service
sudo systemctl stop jduel-backend

# Restart service (after code changes)
sudo systemctl restart jduel-backend

# Check status
sudo systemctl status jduel-backend
```

### View Logs

```bash
# Real-time logs
journalctl -u jduel-backend -f

# Last 100 lines
journalctl -u jduel-backend -n 100

# Last 50 lines with timestamps
journalctl -u jduel-backend -n 50 --no-pager

# Logs since last boot
journalctl -u jduel-backend -b
```

## Service Configuration Explained

### [Unit] Section

```ini
Description=jDuel FastAPI Backend
After=network.target
```

- Service description and startup dependencies
- `After=network.target` ensures network is ready first

### [Service] Section

```ini
User=ubuntu
WorkingDirectory=/home/ubuntu/jDuel/backend
```

- User to run service as (don't use root)
- Working directory for the application

```ini
ExecStart=/home/ubuntu/.local/bin/uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- Command to start the backend
- `--host 127.0.0.1` - Listen only on localhost (nginx proxies from port 80)
- `--port 8000` - Backend port

```ini
Restart=always
RestartSec=3
```

- Automatically restart if crashes
- Wait 3 seconds before restarting

```ini
Environment=PYTHONUNBUFFERED=1
Environment=FRONTEND_URL=http://jduel.xyz
```

- Environment variables for the application
- `PYTHONUNBUFFERED=1` - Show logs immediately
- `FRONTEND_URL` - Used for CORS configuration

### [Install] Section

```ini
WantedBy=multi-user.target
```

- Enables the service to start on boot

## Troubleshooting

### Service Won't Start

```bash
# View detailed error logs
journalctl -u jduel-backend -n 50

# Check service file syntax
sudo systemctl daemon-reload
sudo systemctl status jduel-backend
```

Common issues:

- Wrong path to `uv` binary (use `which uv` to find)
- Wrong working directory path
- Missing Python dependencies (run `uv sync`)
- Port 8000 already in use

### Check for Port Conflicts

```bash
# Find what's using port 8000
sudo lsof -i :8000

# Kill process if needed
sudo kill <PID>
```

### Service Keeps Restarting

```bash
# Watch logs in real-time
journalctl -u jduel-backend -f

# Check for application errors in logs
```

### After Updating Service File

```bash
# Always reload after editing service file
sudo systemctl daemon-reload

# Then restart the service
sudo systemctl restart jduel-backend
```

## Advanced Options

### Reduce Memory Usage

Add to `[Service]` section to disable CUDA:

```ini
Environment=CUDA_VISIBLE_DEVICES=
```

### Custom Port or Host

Modify `ExecStart` line:

```ini
ExecStart=/home/ubuntu/.local/bin/uv run uvicorn app.main:app --host 0.0.0.0 --port 8080
```

### Multiple Instances

For load balancing, create multiple service files (e.g., `jduel-backend-2.service`) with different ports.
