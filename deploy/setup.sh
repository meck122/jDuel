#!/bin/bash
# jDuel Oracle VPS Initial Setup Script
# Run once on a fresh Ubuntu instance to provision everything from scratch.
# Usage: bash deploy/setup.sh [--domain yourdomain.com] [--user ubuntu] [--repo-dir /path/to/jDuel]
set -e

# --------------------------------------------------------------------------
# Config (override with flags or edit these defaults)
# --------------------------------------------------------------------------
DOMAIN="jduel.com"
SERVER_USER="ubuntu"
REPO_DIR="/home/${SERVER_USER}/dev/jDuel"
DEPLOY_DIR="${REPO_DIR}/deploy"

while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)   DOMAIN="$2"; shift 2 ;;
        --user)     SERVER_USER="$2"; REPO_DIR="/home/${SERVER_USER}/dev/jDuel"; DEPLOY_DIR="${REPO_DIR}/deploy"; shift 2 ;;
        --repo-dir) REPO_DIR="$2"; DEPLOY_DIR="${REPO_DIR}/deploy"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "==> Setting up jDuel on Oracle VPS"
echo "    Domain : ${DOMAIN}"
echo "    User   : ${SERVER_USER}"
echo "    Repo   : ${REPO_DIR}"

# --------------------------------------------------------------------------
# 1. System dependencies
# --------------------------------------------------------------------------
echo ""
echo "==> [1/8] Installing system dependencies..."
sudo apt update
sudo apt install -y python3-pip nginx npm git certbot python3-certbot-nginx iptables-persistent

# Install uv package manager
if ! command -v uv &> /dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    # uv installs to ~/.local/bin; source cargo env only if it exists
    [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
    export PATH="$HOME/.local/bin:$PATH"
fi

# Install Node via nvm if npm version is too old (need Node 18+)
NODE_VERSION=$(node --version 2>/dev/null | cut -c2-3 || echo "0")
if [ "${NODE_VERSION}" -lt 18 ] 2>/dev/null; then
    echo "    Node ${NODE_VERSION} is too old, installing via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm use 22
fi

# --------------------------------------------------------------------------
# 2. Oracle Cloud firewall (iptables) — opens ports 80 and 443
# Oracle Cloud adds restrictive iptables rules by default that block
# traffic even if the Security List is open. This fixes that.
# --------------------------------------------------------------------------
echo ""
echo "==> [2/8] Opening firewall ports (Oracle Cloud iptables)..."
# Insert rules just before the REJECT rule (Oracle default has REJECT at line 5).
# Using position 5 ensures our ACCEPT rules are evaluated before the REJECT.
if ! sudo iptables -C INPUT -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 80 -j ACCEPT
fi
if ! sudo iptables -C INPUT -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 443 -j ACCEPT
fi
sudo netfilter-persistent save

# --------------------------------------------------------------------------
# 3. Build frontend
# --------------------------------------------------------------------------
echo ""
echo "==> [3/8] Building frontend..."
cd "${REPO_DIR}/frontend"
npm install
npm run build

# --------------------------------------------------------------------------
# 4. Deploy frontend static files
# --------------------------------------------------------------------------
echo ""
echo "==> [4/8] Deploying frontend static files..."
sudo mkdir -p /var/www/jduel-frontend
sudo cp -r "${REPO_DIR}/frontend/dist" /var/www/jduel-frontend/
sudo chown -R www-data:www-data /var/www/jduel-frontend
sudo chmod -R 755 /var/www/jduel-frontend

# --------------------------------------------------------------------------
# 5. Install backend Python dependencies
# --------------------------------------------------------------------------
echo ""
echo "==> [5/8] Installing backend dependencies..."
cd "${REPO_DIR}/backend"
uv sync

# Install spaCy language model (needed for answer verification NLP)
uv run python -m spacy download en_core_web_sm

#--------------------------------------------------------------------------
# 6. Install systemd service
# --------------------------------------------------------------------------
echo ""
echo "==> [6/8] Installing systemd service..."
# Patch User= and WorkingDirectory= to match this machine
SERVICE_FILE="${DEPLOY_DIR}/jduel-backend.service"
TEMP_SERVICE="/tmp/jduel-backend.service"
sed "s|^User=.*|User=${SERVER_USER}|; s|^WorkingDirectory=.*|WorkingDirectory=${REPO_DIR}/backend|; s|^ExecStart=.*|ExecStart=/home/${SERVER_USER}/.local/bin/uv run uvicorn app.main:app --host 127.0.0.1 --port 8000|" \
    "${SERVICE_FILE}" > "${TEMP_SERVICE}"
sudo cp "${TEMP_SERVICE}" /etc/systemd/system/jduel-backend.service
sudo systemctl daemon-reload
sudo systemctl enable jduel-backend
sudo systemctl start jduel-backend

# --------------------------------------------------------------------------
# 7. Install nginx config
# --------------------------------------------------------------------------
echo ""
echo "==> [7/8] Configuring nginx..."
NGINX_CONF="${DEPLOY_DIR}/nginx/jduel"
TEMP_NGINX="/tmp/jduel-nginx"
# Replace placeholder domain with the actual domain
sed "s|jduel.com www.jduel.com|${DOMAIN} www.${DOMAIN}|" \
    "${NGINX_CONF}" > "${TEMP_NGINX}"
sudo cp "${TEMP_NGINX}" /etc/nginx/sites-available/jduel
sudo ln -sf /etc/nginx/sites-available/jduel /etc/nginx/sites-enabled/jduel
# Remove default site if it exists
[ -f /etc/nginx/sites-enabled/default ] && sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# --------------------------------------------------------------------------
# 8. HTTPS with Let's Encrypt
# --------------------------------------------------------------------------
echo ""
echo "==> [8/8] Setting up HTTPS with Let's Encrypt..."
echo "    Ensure your DNS A record for ${DOMAIN} points to this server's IP"
echo "    before running certbot, or it will fail the HTTP-01 challenge."
read -p "    Run certbot now? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}"
else
    echo "    Skipping certbot. Run manually when DNS is ready:"
    echo "      sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
fi

# --------------------------------------------------------------------------
# Verify
# --------------------------------------------------------------------------
echo ""
echo "==> Verifying services..."
sleep 3
if systemctl is-active --quiet jduel-backend; then
    echo "    [OK] jduel-backend is running"
else
    echo "    [FAIL] jduel-backend is NOT running"
    sudo systemctl status jduel-backend
    exit 1
fi
if systemctl is-active --quiet nginx; then
    echo "    [OK] nginx is running"
else
    echo "    [FAIL] nginx is NOT running"
    sudo systemctl status nginx
    exit 1
fi

echo ""
echo "==> Setup complete!"
echo ""
echo "Useful commands:"
echo "  journalctl -u jduel-backend -f          # Backend logs (live)"
echo "  sudo tail -f /var/log/nginx/error.log    # Nginx error logs"
echo "  ./deploy.sh                              # Deploy updates"
echo "  curl http://127.0.0.1:8000/health        # Check backend health"
