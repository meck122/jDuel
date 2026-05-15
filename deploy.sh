#!/bin/bash
set -euo pipefail

# Get script directory (canonicalized so sudoers paths match).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# ─── Argument parsing ────────────────────────────────────────────────────────
IMPORT_QUESTIONS=false
DRY_RUN=false
FORCE_DIRTY=false
for arg in "$@"; do
  case $arg in
    --import-questions) IMPORT_QUESTIONS=true ;;
    --dry-run)          DRY_RUN=true ;;
    --force-dirty)      FORCE_DIRTY=true ;;
    *)
      echo "❌ unknown argument: $arg"
      echo "   usage: $0 [--import-questions] [--dry-run] [--force-dirty]"
      exit 2
      ;;
  esac
done

# Colors (no color in dry-run output for cleaner diffs in CI logs).
if [ "$DRY_RUN" = true ]; then
  GREEN=''; BLUE=''; YELLOW=''; NC=''
else
  GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[0;33m'; NC='\033[0m'
fi

# ─── --dry-run: validate auth path, do nothing destructive ───────────────────
if [ "$DRY_RUN" = true ]; then
  echo "🧪 jDuel deploy --dry-run"
  echo ""
  echo "[dry-run] script dir: $SCRIPT_DIR"
  echo "[dry-run] checking flock is available..."
  command -v flock >/dev/null 2>&1 || { echo "❌ flock not installed"; exit 1; }
  echo "  ✓ flock present"

  echo "[dry-run] checking lockfile at /var/run/jduel-deploy.lock..."
  if [ -e /var/run/jduel-deploy.lock ]; then
    echo "  ✓ lockfile exists"
  else
    echo "  ❌ /var/run/jduel-deploy.lock does not exist — create it with: sudo install -m 0644 /dev/null /var/run/jduel-deploy.lock"
    exit 1
  fi

  echo "[dry-run] validating sudoers (sudo -n -l)..."
  REQUIRED_CMDS=(
    "/usr/bin/systemctl stop jduel-backend"
    "/usr/bin/systemctl start jduel-backend"
    "/usr/bin/systemctl status jduel-backend"
    "/usr/bin/systemctl status nginx"
    "/usr/bin/systemctl reload nginx"
    "/usr/bin/systemctl daemon-reload"
    "/usr/bin/rm -rf /var/www/jduel-frontend/dist"
    "/usr/bin/cp -r ${SCRIPT_DIR}/frontend/dist /var/www/jduel-frontend/"
    "/usr/bin/chown -R www-data:www-data /var/www/jduel-frontend"
    "/usr/bin/chmod -R 755 /var/www/jduel-frontend"
  )
  missing=0
  for cmd in "${REQUIRED_CMDS[@]}"; do
    if sudo -n -l "$cmd" >/dev/null 2>&1; then
      echo "  ✓ $cmd"
    else
      echo "  ❌ $cmd"
      missing=$((missing + 1))
    fi
  done
  if [ $missing -gt 0 ]; then
    echo ""
    echo "❌ $missing sudoers entries missing — review /etc/sudoers.d/jduel-deploy"
    exit 1
  fi
  echo "  ✓ sudoers OK"

  echo ""
  echo "[dry-run] would run, in order:"
  echo "  1. acquire flock on /var/run/jduel-deploy.lock"
  echo "  2. verify working tree is clean (git status --porcelain)"
  if [ "$IMPORT_QUESTIONS" = true ]; then
    echo "  3. verify ~/questions-import.csv exists"
  fi
  echo "  4. sudo -n systemctl stop jduel-backend"
  echo "  5. cd frontend && npm install && npm run build"
  echo "  6. cd backend && uv sync"
  if [ "$IMPORT_QUESTIONS" = true ]; then
    echo "  7. python3 scripts/import_questions.py ..."
  fi
  echo "  8. sudo -n rm -rf /var/www/jduel-frontend/dist"
  echo "  9. sudo -n cp -r ${SCRIPT_DIR}/frontend/dist /var/www/jduel-frontend/"
  echo " 10. sudo -n chown / chmod /var/www/jduel-frontend"
  echo " 11. sudo -n systemctl daemon-reload && sudo -n systemctl start jduel-backend"
  echo " 12. (optional) sync Grafana Alloy config"
  echo " 13. sudo -n systemctl reload nginx"
  echo " 14. verify backend + nginx are active"
  echo ""
  echo "✓ dry-run OK — exit 0 (no production effects)"
  exit 0
fi

# ─── Concurrency lock via flock re-exec ──────────────────────────────────────
LOCKFILE=/var/run/jduel-deploy.lock
if [ "${FLOCKER:-}" != "$0" ]; then
  exec env FLOCKER="$0" flock -en "$LOCKFILE" "$0" "$@" || {
    echo "❌ another deploy is already in progress (lock: $LOCKFILE)"
    exit 75
  }
fi

# ─── Post-failure backend restart trap (R7) ──────────────────────────────────
# Installed BEFORE any service mutation, so any non-zero exit triggers a
# best-effort restart of jduel-backend to keep the prior version serving.
restore_backend_on_failure() {
  rc=$?
  if [ $rc -ne 0 ]; then
    echo ""
    echo "⚠️  deploy failed (rc=$rc) — best-effort restart of jduel-backend"
    sudo -n systemctl start jduel-backend 2>/dev/null || \
      echo "    (restart attempt also failed — manual intervention required)"
  fi
}
trap restore_backend_on_failure EXIT

echo "🚀 Starting jDuel deployment..."

# ─── Dirty-tree guard ────────────────────────────────────────────────────────
if [ "$FORCE_DIRTY" != true ]; then
  if ! git -C "$SCRIPT_DIR" diff --quiet || ! git -C "$SCRIPT_DIR" diff --cached --quiet; then
    echo "❌ working tree has uncommitted changes — refusing to deploy"
    echo "   commit or stash them, or re-run with --force-dirty"
    git -C "$SCRIPT_DIR" status --short
    exit 1
  fi
fi

# Pre-flight: verify CSV exists before stopping the backend
if [ "$IMPORT_QUESTIONS" = true ]; then
  CSV_PATH="$HOME/questions-import.csv"
  if [ ! -f "$CSV_PATH" ]; then
    echo "❌ --import-questions: CSV not found at $CSV_PATH"
    echo "   Upload it first: ./scripts/upload-questions.sh /path/to/questions.csv"
    exit 1
  fi
fi

# Step 1: Stop backend service (frees up RAM for frontend build)
echo -e "${BLUE}🛑 Stopping backend service...${NC}"
sudo -n systemctl stop jduel-backend

# Step 2: Build frontend
echo -e "${BLUE}📦 Building frontend...${NC}"
cd "$SCRIPT_DIR/frontend"
npm install
npm run build

# Step 3: Install backend dependencies (in case new ones were added)
echo -e "${BLUE}📚 Installing backend dependencies...${NC}"
cd "$SCRIPT_DIR/backend"
uv sync

# Step 3b: Import questions (if requested)
if [ "$IMPORT_QUESTIONS" = true ]; then
  echo -e "${BLUE}📥 Importing questions from CSV...${NC}"
  python3 "$SCRIPT_DIR/scripts/import_questions.py" "$CSV_PATH" \
    --db-path "$SCRIPT_DIR/backend/src/app/db/questions.db"
fi

# Step 4: Copy frontend files (replace entirely to avoid stale hashed bundles)
echo -e "${BLUE}📂 Deploying frontend files...${NC}"
sudo -n rm -rf /var/www/jduel-frontend/dist
sudo -n cp -r "$SCRIPT_DIR/frontend/dist" /var/www/jduel-frontend/
sudo -n chown -R www-data:www-data /var/www/jduel-frontend
sudo -n chmod -R 755 /var/www/jduel-frontend

# Step 5: Reload systemd (in case service file changed)
echo -e "${BLUE}🔄 Reloading systemd...${NC}"
sudo -n systemctl daemon-reload

# Step 6: Start backend service
echo -e "${BLUE}▶️  Starting backend service...${NC}"
sudo -n systemctl start jduel-backend

# Step 6b: Sync Grafana Alloy config (if Alloy is installed)
if systemctl is-enabled --quiet grafana-alloy 2>/dev/null; then
    echo -e "${BLUE}📊 Syncing Grafana Alloy config...${NC}"
    sudo -n cp "$SCRIPT_DIR/deploy/alloy/config.alloy" /etc/alloy/config.alloy
    sudo -n systemctl restart grafana-alloy
fi

# Step 7: Reload nginx
echo -e "${BLUE}🔄 Reloading nginx...${NC}"
sudo -n systemctl reload nginx

# Wait a moment for services to start
sleep 5

# Step 8: Verify services are running
echo -e "${BLUE}✅ Verifying services...${NC}"
if systemctl is-active --quiet jduel-backend; then
    echo -e "${GREEN}✓ Backend service is running${NC}"
else
    echo "❌ Backend service failed to start!"
    sudo -n systemctl status jduel-backend
    exit 1
fi

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo "❌ Nginx failed to start!"
    sudo -n systemctl status nginx
    exit 1
fi

echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "View backend logs: journalctl -u jduel-backend -f"
echo "View nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "View Alloy logs:  journalctl -u grafana-alloy -f"
