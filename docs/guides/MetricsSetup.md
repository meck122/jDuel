# Metrics Setup Guide

Step-by-step guide for setting up Grafana Alloy and Grafana Cloud on the production Oracle VM.
For conceptual background, see [metrics-overview.md](metrics-overview.md).

---

## Prerequisites

You need a Grafana Cloud free-tier account and three values from it before starting.

### 1. Create a Grafana Cloud account

Go to [grafana.com](https://grafana.com) → **Start for free** → sign up.

You get a "stack" with a name like `yourusername.grafana.net`.

### 2. Get your Prometheus remote-write credentials

1. In Grafana Cloud, click **My Account** (top-left avatar)
2. Under your stack, click **Details** next to the Prometheus section
3. Note these three values:

| Variable | Where to find it | Example |
|---|---|---|
| `GRAFANA_CLOUD_PUSH_URL` | "Remote Write Endpoint" | `https://prometheus-prod-13-prod-us-east-0.grafana.net/api/prom/push` |
| `GRAFANA_CLOUD_USER` | "Username / Instance ID" | `1234567` |
| `GRAFANA_CLOUD_API_KEY` | Generate via "Generate now" | `glc_eyJ...` |

Keep these handy — you'll paste them into a file on the VM.

---

## Step 1: Install Grafana Alloy on the VM

SSH into the production VM, then:

```bash
# Find the latest release tag
ALLOY_VERSION=$(curl -s https://api.github.com/repos/grafana/alloy/releases/latest \
  | grep '"tag_name"' | cut -d'"' -f4)

# Download the aarch64 .deb package (Oracle VM is arm64)
curl -LO "https://github.com/grafana/alloy/releases/download/${ALLOY_VERSION}/alloy-linux-arm64.deb"

# Install it
sudo dpkg -i alloy-linux-arm64.deb
rm alloy-linux-arm64.deb

# Verify the binary works
alloy --version
```

> **Note:** If you're provisioning a fresh VM, pass `--alloy` to `deploy/setup.sh` and it will do this automatically.

---

## Step 2: Set Up Credentials

The Alloy service reads credentials from `/etc/alloy/env`. This file is NOT committed to git (it contains secrets).

```bash
# Create the directory
sudo mkdir -p /etc/alloy

# Write the credentials file
sudo tee /etc/alloy/env > /dev/null <<EOF
GRAFANA_CLOUD_PUSH_URL=https://prometheus-prod-XX...grafana.net/api/prom/push
GRAFANA_CLOUD_USER=your_instance_id_here
GRAFANA_CLOUD_API_KEY=your_api_key_here
EOF

# Lock down permissions — only root can read this
sudo chmod 600 /etc/alloy/env
sudo chown root:root /etc/alloy/env
```

---

## Step 3: Copy the Alloy Config

The config lives in the repo at `deploy/alloy/config.alloy`. Copy it to the VM:

```bash
# From your local machine (or after pulling the latest code on the VM):
sudo mkdir -p /etc/alloy
sudo cp ~/dev/jDuel/deploy/alloy/config.alloy /etc/alloy/config.alloy
```

---

## Step 4: Install and Start the Systemd Service

```bash
# Copy the service file from the repo
sudo cp ~/dev/jDuel/deploy/alloy/grafana-alloy.service /etc/systemd/system/grafana-alloy.service

# Create the WAL storage directory
sudo mkdir -p /var/lib/alloy/data

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable grafana-alloy
sudo systemctl start grafana-alloy

# Verify it started
sudo systemctl status grafana-alloy
```

---

## Step 5: Verify Metrics Are Flowing

### Check that the app is exposing metrics

```bash
curl http://127.0.0.1:8000/metrics | head -30
```

You should see Prometheus-format output starting with `# HELP` lines. Look for `jduel_` metrics.

### Check Alloy is running and scraping

```bash
# View live Alloy logs
journalctl -u grafana-alloy -f

# Look for lines like:
# ts=... level=info msg="Successfully sent batch of samples" ...
```

### Check metrics appear in Grafana Cloud

1. Go to your Grafana Cloud instance at `https://yourusername.grafana.net`
2. Click **Explore** (compass icon in left sidebar)
3. Select your Prometheus data source
4. In the metric browser, type `jduel_` — your custom metrics should appear
5. Try `jduel_rooms_created_total` and hit **Run query**

If data appears — you're done!

---

## Step 6: Set Up Dashboards

### Import the Node Exporter Full dashboard (host metrics)

1. In Grafana, click **Dashboards** → **Import**
2. Enter dashboard ID `1860` and click **Load**
3. Select your Prometheus data source → **Import**

This gives you CPU, memory, disk, and network panels instantly.

### Create a jDuel usage dashboard

1. **Dashboards** → **New** → **New Dashboard**
2. Add panels using these PromQL queries:

**Games started (rate over 1h):**
```promql
increase(jduel_games_started_total[1h])
```

**Active WebSocket connections (current):**
```promql
jduel_ws_connections_active
```

**Rooms created today:**
```promql
increase(jduel_rooms_created_total[24h])
```

**HTTP error rate:**
```promql
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

**HTTP request latency (p95):**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

---

## Step 7: Set Up Alerting (App Down)

### Synthetic Monitoring (external uptime check)

1. In Grafana Cloud, go to **Synthetic Monitoring** (left sidebar)
2. Click **Add new check** → **HTTP**
3. Configure:
   - **Job name:** `jduel-health`
   - **URL:** `https://yourdomain.com/health`
   - **Check frequency:** 1 minute
4. Set up an alert: when the check fails for 2+ minutes → send notification

This alerts you if the app is unreachable from the outside world.

### Email notifications

1. In Grafana, go to **Alerting** → **Contact points**
2. Add your email address
3. Grafana Cloud will email you when any alert fires

---

## Useful Commands

```bash
# Check Alloy status
sudo systemctl status grafana-alloy

# View Alloy logs (live)
journalctl -u grafana-alloy -f

# Restart Alloy (after config change)
sudo systemctl restart grafana-alloy

# Check app metrics locally
curl http://127.0.0.1:8000/metrics

# Check specific metric
curl -s http://127.0.0.1:8000/metrics | grep jduel_games

# Verify /metrics is NOT exposed publicly (should fail or 404)
curl https://yourdomain.com/metrics
```

---

## Common Issues

### Alloy won't start

```bash
journalctl -u grafana-alloy -n 50
```

Common causes:
- `/etc/alloy/env` is missing or has wrong format — check the file exists and has all three variables
- `/etc/alloy/config.alloy` has a syntax error — validate with `alloy fmt /etc/alloy/config.alloy`
- Binary not found — verify `which alloy` returns a path

### Metrics not appearing in Grafana Cloud

- Check Alloy logs for "connection refused" or "401 Unauthorized" errors
- Verify the `GRAFANA_CLOUD_PUSH_URL` is correct (no trailing slash)
- Verify `GRAFANA_CLOUD_USER` is the numeric instance ID, not your username
- Try regenerating the API key in Grafana Cloud

### Cardinality warning

If you see a warning about too many series:
- The `/metrics` endpoint should be grouping by route template automatically (e.g., `/api/rooms/{roomId}` not `/api/rooms/AB3D`)
- Check the metric `http_requests_total` labels — `handler` should show template paths

### `/metrics` is exposed publicly

This shouldn't happen (backend binds to `127.0.0.1:8000` and nginx doesn't proxy `/metrics`), but if it is:
```bash
# Check nginx config
sudo grep -n "location" /etc/nginx/sites-enabled/jduel
# Add explicit block if needed:
# location /metrics { return 404; }
```
