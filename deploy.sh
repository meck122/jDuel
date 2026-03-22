#!/bin/bash
set -e  # Exit on any error

echo "🚀 Starting jDuel deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Step 1: Stop backend service (frees up RAM for frontend build)
echo -e "${BLUE}🛑 Stopping backend service...${NC}"
sudo systemctl stop jduel-backend

# Step 2: Build frontend
echo -e "${BLUE}📦 Building frontend...${NC}"
cd "$SCRIPT_DIR/frontend"
npm install
npm run build

# Step 3: Install backend dependencies (in case new ones were added)
echo -e "${BLUE}📚 Installing backend dependencies...${NC}"
cd "$SCRIPT_DIR/backend"
uv sync

# Step 4: Copy frontend files (replace entirely to avoid stale hashed bundles)
echo -e "${BLUE}📂 Deploying frontend files...${NC}"
sudo rm -rf /var/www/jduel-frontend/dist
sudo cp -r "$SCRIPT_DIR/frontend/dist" /var/www/jduel-frontend/
sudo chown -R www-data:www-data /var/www/jduel-frontend
sudo chmod -R 755 /var/www/jduel-frontend

# Step 5: Reload systemd (in case service file changed)
echo -e "${BLUE}🔄 Reloading systemd...${NC}"
sudo systemctl daemon-reload

# Step 6: Start backend service
echo -e "${BLUE}▶️  Starting backend service...${NC}"
sudo systemctl start jduel-backend

# Step 7: Reload nginx
echo -e "${BLUE}🔄 Reloading nginx...${NC}"
sudo systemctl reload nginx

# Wait a moment for services to start
sleep 5

# Step 8: Verify services are running
echo -e "${BLUE}✅ Verifying services...${NC}"
if systemctl is-active --quiet jduel-backend; then
    echo -e "${GREEN}✓ Backend service is running${NC}"
else
    echo "❌ Backend service failed to start!"
    sudo systemctl status jduel-backend
    exit 1
fi

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo "❌ Nginx failed to start!"
    sudo systemctl status nginx
    exit 1
fi

echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "View backend logs: journalctl -u jduel-backend -f"
echo "View nginx logs: sudo tail -f /var/log/nginx/error.log"
