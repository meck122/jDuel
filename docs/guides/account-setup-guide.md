# Account Setup & Configuration Guide

Everything you need to create, configure, and connect before writing any code.

---

## 1. Fly.io (Backend Hosting)

### Create Account
1. Go to [fly.io](https://fly.io) and sign up (free, no credit card required for free tier)
2. You get: 3 shared-cpu-1x VMs with 256MB RAM each, free

### Install CLI
```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login
```

### Create the App
```bash
cd backend
flyctl launch --name jduel-api --region iad --no-deploy
```
- `iad` = US East (Virginia). Pick the region closest to your players.
- `--no-deploy` because we haven't written the Dockerfile yet.
- This generates a `fly.toml` file (we'll replace its contents later).

### Add Custom Domain
After first successful deploy:
```bash
flyctl certs add api.jduel.xyz
```
Fly.io will tell you what DNS record to create (you'll do this in Cloudflare DNS).

### Generate Deploy Token for GitHub Actions
```bash
flyctl tokens create deploy -x 999999h
```
Copy this token -- you'll paste it into GitHub in step 3.

---

## 2. Cloudflare (Frontend Hosting + DNS)

### Create Account
1. Go to [cloudflare.com](https://cloudflare.com) and sign up (free)
2. Cloudflare Pages is free forever: unlimited requests, unlimited bandwidth

### Move DNS to Cloudflare
1. In Cloudflare dashboard: **Add a Site** > enter `jduel.xyz`
2. Cloudflare scans existing DNS records and imports them
3. Go to your domain registrar (wherever you bought jduel.xyz) and change the nameservers to the two Cloudflare nameservers shown
4. Wait for propagation (usually minutes, can take up to 24h)

### Connect GitHub Repo to Cloudflare Pages
1. Cloudflare Dashboard > **Pages** > **Create a project**
2. Click **Connect to Git** > authorize GitHub > select the `jDuel` repo
3. Configure build settings:
   - **Build command:** `cd frontend && npm ci && npm run build`
   - **Build output directory:** `frontend/dist`
   - **Root directory:** `/` (repo root)
4. Click **Save and Deploy** -- it will build and deploy immediately

### Set Environment Variables
In Pages > your project > **Settings** > **Environment Variables**:

**Production:**

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://api.jduel.xyz/api` |
| `VITE_WS_URL` | `wss://api.jduel.xyz/ws` |

**Preview** (for non-main branch deploys):

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://jduel-api.fly.dev/api` |
| `VITE_WS_URL` | `wss://jduel-api.fly.dev/ws` |

### Add Custom Domains to Pages
1. Pages > your project > **Custom domains** > **Add custom domain**
2. Add `jduel.xyz` and `www.jduel.xyz`
3. Cloudflare auto-creates DNS records and issues TLS certs

### Add Backend DNS Record
In Cloudflare **DNS** settings, add:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `api` | `jduel-api.fly.dev` | **DNS only (grey cloud)** |

**CRITICAL: Use grey cloud (DNS only), NOT orange cloud.** Cloudflare's orange-cloud proxy interferes with WebSocket upgrades on the free plan. Grey cloud means WebSocket traffic goes directly to Fly.io, which handles its own TLS.

---

## 3. GitHub Actions (CI/CD)

### Add the Fly.io Deploy Token
1. Go to your repo on GitHub > **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Name: `FLY_API_TOKEN`
4. Value: paste the token from `flyctl tokens create deploy` (step 1)

That's it. The GitHub Actions workflow file (`.github/workflows/deploy-backend.yml`) is a code change we'll create separately. Once it exists and the secret is set, pushes to `main` auto-deploy the backend.

Cloudflare Pages does NOT need a GitHub Actions workflow -- it has its own GitHub integration that triggers builds automatically.

---

## Setup Checklist

- [ ] Fly.io account created
- [ ] `flyctl` installed and authenticated
- [ ] Fly.io app created (`jduel-api` in `iad` region)
- [ ] Fly.io deploy token generated
- [ ] Cloudflare account created
- [ ] `jduel.xyz` nameservers pointed to Cloudflare
- [ ] DNS propagation confirmed
- [ ] Cloudflare Pages project connected to GitHub repo
- [ ] Cloudflare Pages environment variables set (Production + Preview)
- [ ] Custom domains added to Cloudflare Pages (`jduel.xyz`, `www.jduel.xyz`)
- [ ] CNAME record added for `api.jduel.xyz` > `jduel-api.fly.dev` (grey cloud)
- [ ] `FLY_API_TOKEN` secret added to GitHub repo
- [ ] Fly.io custom domain added (`flyctl certs add api.jduel.xyz`)

---

## Order of Operations

Do these in order to avoid chicken-and-egg issues:

1. **Fly.io account + app creation** (no deploy yet)
2. **Cloudflare account + DNS migration** (move nameservers)
3. **Wait for DNS propagation**
4. **Write code changes** (Dockerfile, config.ts, CORS, fly.toml, etc.)
5. **First backend deploy** (`flyctl deploy` manually)
6. **Connect Cloudflare Pages to GitHub** (triggers first frontend build)
7. **Set Cloudflare Pages env vars** (VITE_API_URL, VITE_WS_URL)
8. **Add custom domains** (Cloudflare Pages + Fly.io certs)
9. **Add GitHub secret** (`FLY_API_TOKEN`)
10. **Add DNS record** for `api.jduel.xyz` (grey cloud CNAME)
11. **Smoke test** the full flow
12. **Decommission EC2** after a few days of stability
