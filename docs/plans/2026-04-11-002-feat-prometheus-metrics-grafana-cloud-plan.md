---
title: "feat: Add Prometheus Metrics with Grafana Cloud Dashboards"
type: feat
status: completed
date: 2026-04-11
origin: docs/brainstorms/2026-04-11-metrics-monitoring-requirements.md
---

# feat: Add Prometheus Metrics with Grafana Cloud Dashboards

## Overview

Instrument the jDuel FastAPI backend with Prometheus metrics, deploy Grafana Alloy as a lightweight collection agent on the Oracle VM, and remote-write to Grafana Cloud free tier for dashboards and alerting. This gives the operator visibility into usage patterns (players, games, peak times) and operational health (latency, errors, uptime) with near-zero RAM overhead on the 4 GB VM.

## Problem Statement / Motivation

jDuel has zero observability. The operator cannot answer "how many people played today?" or "is latency spiking?" without manually inspecting stdout logs. The app runs on a memory-constrained Oracle Cloud aarch64 VM (4 GB RAM, shared with NLP models), ruling out self-hosted Prometheus + Grafana. (see origin: docs/brainstorms/2026-04-11-metrics-monitoring-requirements.md)

## Proposed Solution

Three layers, each independently deployable:

1. **App instrumentation** — `prometheus-fastapi-instrumentator` for HTTP RED metrics + manual counters/gauges for WebSocket connections and game lifecycle events
2. **Collection agent** — Grafana Alloy running as a systemd service, scraping `/metrics` locally and collecting host metrics, remote-writing to Grafana Cloud
3. **Visualization & alerting** — Grafana Cloud dashboards + Synthetic Monitoring for uptime checks

## Technical Considerations

### Architecture

```
FastAPI app (:8000/metrics)  ──scrape──>  Grafana Alloy (systemd)  ──remote-write──>  Grafana Cloud
                                              │
                                              └── built-in host metrics (CPU, mem, disk)

Grafana Cloud Synthetic Monitoring  ──HTTP probe──>  https://yourdomain.com/health
```

- `/metrics` is only accessible on `127.0.0.1:8000` — Alloy scrapes locally, nginx does NOT proxy it
- Alloy replaces both Prometheus and node_exporter in a single ~50-80MB process
- Grafana Agent (static) was deprecated late 2024; Alloy is the official successor

### Test Suite Compatibility

Tests use `create_app(lifespan_override=...)` to skip NLP model loading. The Instrumentator attaches to the app in `create_app()`, so it will be present in tests. Verify that `prometheus-fastapi-instrumentator` doesn't conflict with the test fixtures — if it does, gate instrumentation behind an environment check or make it conditional in `create_app()`.

### Cardinality Control (Critical)

`prometheus-fastapi-instrumentator` generates per-path-per-method-per-status metric series. jDuel uses parameterized routes like `/api/rooms/{roomId}` — if raw paths are used, every room code creates new series, quickly exhausting the 10k free-tier limit. **The middleware must group by route template, not raw path.** The library supports this via `grouped_status_codes=True` and the default Starlette route grouping.

### Security

- **Grafana Cloud API token**: stored in `/etc/alloy/env` with `root:root 0600` permissions, loaded via systemd `EnvironmentFile=`
- **`/metrics` endpoint**: not exposed publicly. Backend binds to `127.0.0.1:8000`, nginx only proxies `/api/` and `/ws`. Verify nginx config has no catch-all `location /` that would leak `/metrics`.
- No sensitive data in metric labels (no player names, room codes in labels)

### Performance

- Middleware adds ~0.1ms per HTTP request (counter increment + histogram observe)
- WebSocket gauge inc/dec is a single atomic operation — negligible
- Alloy uses ~50-80MB RAM with default WAL buffer — well within R8's 100MB budget

## Implementation Phases

### Phase 1: App Instrumentation

**Goal:** Expose a `/metrics` endpoint with all application metrics.

#### 1a. Add dependency

**File:** `backend/pyproject.toml`

- Add `prometheus-fastapi-instrumentator` to `dependencies`
- Add `prometheus-client` (pulled transitively, but pin explicitly for custom metrics)
- Run `uv sync`

#### 1b. HTTP RED metrics via middleware

**File:** `backend/src/app/main.py` (lines 55-97, `create_app()`)

- Import and configure `Instrumentator`
- Call `Instrumentator().instrument(app).expose(app, endpoint="/metrics")` after app creation
- Ensure route template grouping is enabled (default behavior — verify, don't assume)
- Place after `ProxyHeadersMiddleware`, before router mount

#### 1c. WebSocket connection gauge

**File:** `backend/src/app/api/websocket_handler.py` (lines 56-160)

- Create a `prometheus_client.Gauge("jduel_ws_connections_active", "Active WebSocket connections")`
- Increment in the `try` block after `ws.accept()` (line 56)
- **Decrement in a `finally` block** to cover all exit paths (normal disconnect, validation error, room-not-found, exception). The current code has multiple exit points at lines 151-160 — a `finally` ensures the gauge never drifts.

#### 1d. Game lifecycle counters

**File:** `backend/src/app/services/orchestration/orchestrator.py`

- `jduel_games_started_total` Counter — increment at `handle_start_game()` (line 104) and `handle_play_again()` (line 151)
- `jduel_games_completed_total` Counter — increment when the orchestrator transitions to the game-over state (same flow that triggers the final scoreboard broadcast)

**File:** `backend/src/app/services/core/room_manager.py`

- `jduel_rooms_created_total` Counter — increment at `create_room()` (line 73)
- `jduel_rooms_expired_total` Counter — increment at room cleanup/expiry point

#### 1e. Players per game histogram

**File:** `backend/src/app/services/orchestration/orchestrator.py`

- `jduel_players_per_game` Histogram — observe at game start (when `handle_start_game()` fires), using `len(room.players)`. Observing at start captures the intended player count; mid-game disconnects are tracked separately by the WebSocket gauge.

#### 1f. Metrics module organization

**New file:** `backend/src/app/services/metrics.py`

- Define all custom metrics (gauges, counters, histograms) in a single module
- Import from this module in websocket_handler, orchestrator, room_manager
- This avoids scattered metric definitions and makes it easy to find all tracked metrics

### Phase 2: Grafana Alloy Deployment

**Goal:** Install and configure Alloy on the Oracle VM to scrape the app and collect host metrics.

#### 2a. Install Grafana Alloy

- Download the official aarch64 `.deb` or binary from Grafana's releases
- Verify aarch64 binary availability (assumed but not yet confirmed — check during implementation)
- Install to `/usr/local/bin/alloy` or via apt

#### 2b. Alloy configuration

**New file on VM:** `/etc/alloy/config.alloy`

```hcl
// Remote write destination
prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = env("GRAFANA_CLOUD_PUSH_URL")
    basic_auth {
      username = env("GRAFANA_CLOUD_USER")
      password = env("GRAFANA_CLOUD_API_KEY")
    }
  }
}

// Scrape FastAPI /metrics → forward to Grafana Cloud
prometheus.scrape "jduel_app" {
  targets      = [{"__address__" = "127.0.0.1:8000"}]
  metrics_path = "/metrics"
  scrape_interval = "15s"
  forward_to   = [prometheus.remote_write.grafana_cloud.receiver]
}

// Built-in host metrics (replaces node_exporter)
prometheus.exporter.unix "host" { }

prometheus.scrape "host_metrics" {
  targets    = prometheus.exporter.unix.host.targets
  scrape_interval = "60s"
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}
```

#### 2c. Systemd service

**New file on VM:** `/etc/systemd/system/grafana-alloy.service`

- `ExecStart=/usr/local/bin/alloy run /etc/alloy/config.alloy`
- `Restart=always` (so metrics collection recovers from crashes — SpecFlow gap)
- `EnvironmentFile=/etc/alloy/env` (contains `GRAFANA_CLOUD_USER` and `GRAFANA_CLOUD_API_KEY`)
- Ensure `/etc/alloy/env` has `root:root 0600` permissions

#### 2d. Nginx audit

**File on VM:** `/etc/nginx/sites-available/jduel`

- Verify nginx only proxies `/api/` and `/ws` paths — confirm no catch-all `location /` that would expose `/metrics` publicly
- If a catch-all exists, add `location /metrics { return 404; }` before it

### Phase 3: Grafana Cloud Setup

**Goal:** Dashboards and alerting configured in Grafana Cloud.

#### 3a. Grafana Cloud account & data source

- Sign up for Grafana Cloud free tier (if not already)
- Note the Prometheus remote-write URL, username (instance ID), and generate an API key
- Store credentials in `/etc/alloy/env` on the VM

#### 3b. Dashboards

Create two dashboards:

**Usage Dashboard:**
- Games started over time (daily/weekly)
- Active WebSocket connections (concurrent users) — current + time series
- Players per game distribution
- Rooms created over time
- Peak usage hours heatmap

**Operations Dashboard:**
- HTTP request rate, error rate, latency (p50/p95/p99) from RED metrics
- Active WebSocket connections
- Host CPU, memory, disk usage
- App uptime / restarts

Start with the "Node Exporter Full" community dashboard for host metrics. Build jDuel-specific panels manually — keep it to ~5-8 panels per dashboard. Dashboards can always be refined later; don't spend more than 30 minutes on initial layout.

#### 3c. Alerting

- **Synthetic Monitoring:** Configure an HTTP check against `https://yourdomain.com/health` from Grafana Cloud's global probes. Alerts on reachability failure, high latency, TLS certificate expiry. No scraped metrics required.
- **Metric-based alert:** `up == 0` for the jduel_app scrape target (alerts if Alloy can't reach the app — covers localhost-level failures that synthetic monitoring from outside might not catch immediately)

### Phase 4: Deploy Script Integration

**Goal:** Make metrics deployment repeatable.

#### 4a. Update deploy.sh

- Add Alloy config sync step (copy config.alloy to VM)
- Add `systemctl restart grafana-alloy` after backend restart
- Do NOT sync `/etc/alloy/env` (credentials) — that's a one-time manual setup

#### 4b. Update deploy/setup.sh (provisioning)

- Add Alloy installation step for fresh VM setup
- Create `/etc/alloy/` directory with correct permissions
- Add placeholder `/etc/alloy/env` with instructions

### Phase 5: Metrics Setup & Usage Guide

**Goal:** Write a guide in `docs/guides/` that a future Claude session on the production VM (or the operator) can follow to set up, troubleshoot, and use the metrics stack.

**New file:** `docs/guides/MetricsSetup.md`

Contents:
- **Prerequisites** — Grafana Cloud account, API key generation steps, what values to note
- **Alloy installation** — step-by-step for aarch64 Oracle VM (download, install, verify)
- **Credential setup** — creating `/etc/alloy/env`, required variables (`GRAFANA_CLOUD_PUSH_URL`, `GRAFANA_CLOUD_USER`, `GRAFANA_CLOUD_API_KEY`), permissions
- **Starting Alloy** — `systemctl enable --now grafana-alloy`, verifying it's scraping
- **Verifying metrics flow** — how to check that metrics appear in Grafana Cloud (curl `/metrics` locally, check Alloy logs, check Grafana Cloud Explore)
- **Dashboard quick-start** — links to the pre-built dashboards or instructions to import them
- **Common issues** — Alloy not starting, metrics not appearing, cardinality warnings, credential errors
- **Useful commands** — checking Alloy status, tailing logs, restarting, testing `/metrics` locally

This guide should also be added to the docs index in `CLAUDE.md` under the Documentation section.

## Acceptance Criteria

- [ ] `/metrics` endpoint returns Prometheus-format metrics on `127.0.0.1:8000/metrics`
- [ ] HTTP request rate, error rate, and latency histograms are tracked per route template (not raw path)
- [ ] Active WebSocket connections gauge accurately reflects connected clients (no drift)
- [ ] Games started, games completed, rooms created, rooms expired counters increment correctly
- [ ] Players-per-game histogram records at game start
- [ ] Grafana Alloy runs as systemd service with `Restart=always`, using <100MB RAM
- [ ] Host CPU, memory, and disk metrics appear in Grafana Cloud
- [ ] `/metrics` is NOT accessible from the public internet
- [ ] Grafana Cloud API token is stored with `0600` permissions
- [ ] Usage dashboard shows daily player activity and concurrent users
- [ ] Operations dashboard shows RED metrics and host resource usage
- [ ] Synthetic Monitoring alerts when `/health` is unreachable
- [ ] `deploy.sh` syncs Alloy config; `deploy/setup.sh` installs Alloy on fresh VMs
- [ ] `docs/guides/MetricsSetup.md` exists with step-by-step setup, verification, and troubleshooting instructions usable by a Claude session on the production VM
- [ ] CLAUDE.md Documentation section updated to reference the new guide
- [ ] All existing tests pass (metrics instrumentation does not break test fixtures)

## Success Metrics

(see origin: docs/brainstorms/2026-04-11-metrics-monitoring-requirements.md)

- Can answer "how many users played today and at what times?" from a dashboard
- Can see current concurrent users at a glance
- Get notified if the backend goes down
- No noticeable impact on app performance or VM memory headroom

## Dependencies & Risks

**Dependencies:**
- Grafana Cloud free tier account (10k series, 50GB logs — sufficient)
- Grafana Alloy aarch64 binary availability (high confidence but verify)
- Backend's `/health` endpoint already exists (`main.py:74-77`)

**Risks:**
- **Cardinality explosion** if route template grouping is misconfigured — mitigated by verifying grouping in Phase 1b
- **NLP model import conflicts** with prometheus-client — low risk, but test in dev first
- **Alloy WAL filling disk** if Grafana Cloud is unreachable for extended period — Alloy has built-in WAL truncation, but monitor disk usage via the host metrics it collects
- **Test suite compatibility** — tests use `create_app(lifespan_override=...)` to skip NLP loading; verify the Instrumentator doesn't interfere with this pattern

## Scope Boundaries

(see origin: docs/brainstorms/2026-04-11-metrics-monitoring-requirements.md)

- NOT tracking: per-question analytics, answer accuracy, NLP model performance
- NOT tracking: frontend metrics (page load, JS errors)
- NOT building: custom analytics UI in the app
- NOT self-hosting: Prometheus server or Grafana

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-04-11-metrics-monitoring-requirements.md](docs/brainstorms/2026-04-11-metrics-monitoring-requirements.md) — Key decisions carried forward: Grafana Cloud free tier over self-hosted, Prometheus exposition format, lightweight agent on VM

### Internal References

- FastAPI app factory: `backend/src/app/main.py:55-97`
- WebSocket handler (connect/disconnect): `backend/src/app/api/websocket_handler.py:56-160`
- Game orchestrator (start/complete): `backend/src/app/services/orchestration/orchestrator.py:104,151`
- Room manager (create): `backend/src/app/services/core/room_manager.py:73`
- Health endpoint: `backend/src/app/main.py:74-77`
- Deploy script: `deploy.sh`
- Provisioning script: `deploy/setup.sh`

### External References

- prometheus-fastapi-instrumentator: https://github.com/trallnag/prometheus-fastapi-instrumentator
- Grafana Alloy docs: https://grafana.com/docs/alloy/
- Grafana Cloud free tier: https://grafana.com/pricing/
- Grafana Synthetic Monitoring: https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/
