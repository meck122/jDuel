# Metrics & Monitoring Overview

A plain-language guide to the metrics stack used in jDuel.

## The Components

**Prometheus** is a data format and a way of thinking about metrics. Your app exposes numbers (counters, gauges, histograms) at a `/metrics` endpoint in "Prometheus format." Prometheus was originally also a server that stored and queried those numbers, but in our setup we're only using the *format*, not the server.

**Grafana** is a dashboarding tool — it draws graphs, charts, and alerts from time-series data. Think of it as "Excel for metrics" — it doesn't collect or store data itself, it just visualizes whatever data source you point it at.

**Grafana Cloud** is a hosted service that bundles storage + Grafana dashboards in the cloud. Instead of running a Prometheus server and Grafana on your VM (eating ~1GB RAM), Grafana Cloud stores your metrics *for you* and hosts the dashboards. You log into grafana.com in your browser and see your dashboards. Free tier is more than enough for jDuel.

**Grafana Alloy** is a lightweight agent (small program) that runs on your VM. Its job is simple: scrape your app's `/metrics` endpoint every 15 seconds, collect host stats (CPU/memory/disk), and ship all of it to Grafana Cloud. Think of it as a courier — it picks up the numbers and delivers them.

## How They Fit Together

```
Your FastAPI App                    Grafana Alloy                  Grafana Cloud
(produces numbers)                  (courier)                      (stores + displays)

"5 games played"     --scrape-->    picks up numbers    --push-->  stores time-series
"12 active users"                   every 15 seconds               draws dashboards
"avg latency 42ms"                  also collects                  sends alerts
                                    CPU/mem/disk
```

**Your app** is like a weather station with instruments — it measures things and writes them on a board (`/metrics`).

**Alloy** is like someone who walks over to the board every 15 seconds, copies the readings, and mails them to headquarters.

**Grafana Cloud** is headquarters — it files all the readings over time and draws nice charts you can look at from anywhere in your browser.

## What We Set Up

At a high level, three things:

1. **Teach your app to measure itself** — A few lines of Python code so the FastAPI app counts requests, tracks active players, and exposes these numbers at `/metrics`

2. **Install the courier** — Grafana Alloy runs on the VM as a background service that reads `/metrics` and ships data to the cloud

3. **Set up the display** — Grafana Cloud dashboards show graphs, plus alerts notify you when things break

The key insight: **your app never talks to Grafana Cloud directly**. It just exposes numbers locally. Alloy handles the rest.
