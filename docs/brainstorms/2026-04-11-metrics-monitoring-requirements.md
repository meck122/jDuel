---
date: 2026-04-11
topic: metrics-monitoring
---

# Application Metrics & Monitoring

## Problem Frame

jDuel has no visibility into usage patterns, operational health, or performance. The operator (solo developer) cannot answer basic questions like "how many people played today?" or "is latency spiking?" without manually inspecting logs. The app runs on an Oracle Cloud aarch64 VM with 4 GB RAM, so the monitoring solution must have minimal resource overhead.

## Requirements

- R1. **HTTP RED metrics** — Track request rate, error rate, and latency distribution for all API endpoints, automatically via middleware
- R2. **WebSocket connection gauge** — Track the number of active WebSocket connections as a real-time measure of concurrent users
- R3. **Game lifecycle counters** — Track games started, games completed, and rooms expired
- R4. **Players per game** — Record the number of players in each game as a histogram/summary
- R5. **System metrics** — CPU usage, memory usage, and disk usage from the host VM
- R6. **Dashboards** — Pre-built or configured Grafana dashboards showing usage trends (daily/weekly players, peak times) and operational health (latency, errors, uptime)
- R7. **Basic alerting** — At minimum, alert when the app is down or unresponsive (health check failure)
- R8. **Minimal VM resource overhead** — The on-VM component (agent/exporter) should use under ~100MB RAM

## Success Criteria

- Can answer "how many users played today and at what times?" from a dashboard
- Can see current concurrent users at a glance
- Get notified if the backend goes down
- No noticeable impact on app performance or VM memory headroom

## Scope Boundaries

- **Not tracking:** per-question analytics, answer accuracy rates, or NLP model performance (future work)
- **Not tracking:** frontend-specific metrics (page load times, JS errors) — backend only for now
- **Not building:** custom analytics UI in the app itself — Grafana dashboards are the interface
- **Not self-hosting:** Prometheus server or Grafana — using Grafana Cloud free tier to avoid RAM overhead

## Key Decisions

- **Grafana Cloud free tier over self-hosted:** The 4 GB VM with NLP models leaves insufficient headroom for self-hosted Prometheus + Grafana (~500MB-1GB). Grafana Cloud free tier (10k metrics, 50GB logs) is more than sufficient and costs zero RAM on the VM.
- **Prometheus exposition format:** Industry standard, works with Grafana Cloud natively, has a mature Python client library, and FastAPI middleware integrations exist.
- **Lightweight agent on VM:** A small Prometheus-compatible agent (~30-50MB) scrapes the app locally and remote-writes to Grafana Cloud, rather than exposing a metrics port to the internet.

## Dependencies / Assumptions

- Grafana Cloud free tier remains available and sufficient (10k active series is far more than needed)
- Oracle VM has enough disk for the agent binary (~50MB) and its WAL buffer
- The backend's `/health` endpoint (already exists) can serve as the uptime probe target

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Needs research] Which FastAPI Prometheus middleware library is best maintained and compatible with Python 3.13?
- [Affects R5][Technical] Should system metrics come from `node_exporter` or the Grafana Agent's built-in host metrics integration?
- [Affects R7][Needs research] How to configure Grafana Cloud alerting for health check failures — is it built-in or does it need a synthetic check?
- [Affects R8][Technical] Grafana Agent vs Prometheus in agent mode vs Grafana Alloy — which is the lightest option for aarch64?

## Next Steps

→ `/ce:plan` for structured implementation planning
