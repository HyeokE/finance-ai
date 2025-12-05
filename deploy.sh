#!/bin/bash

# Quick deployment script for manual deployment
# Usage: ./deploy.sh

set -e

echo "🚀 Starting deployment to Oracle Cloud..."

# Configuration
ORACLE_USER="${ORACLE_USER:-ubuntu}"
ORACLE_HOST="${ORACLE_HOST:-your-server-ip}"
DEPLOY_DIR="~/auto-finance"

echo "📦 Building application..."
pnpm build

echo "📦 Building dashboard..."
cd dashboard
pnpm build
cd ..

echo "📤 Uploading to server..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dashboard/node_modules' \
  --exclude '*.log' \
  ./ $ORACLE_USER@$ORACLE_HOST:$DEPLOY_DIR/

echo "🔄 Installing dependencies and restarting..."
ssh $ORACLE_USER@$ORACLE_HOST << 'EOF'
  cd ~/auto-finance
  pnpm install --prod
  pm2 restart auto-finance || pm2 start ecosystem.config.json
  pm2 save
  
  # Deploy dashboard
  sudo mkdir -p /var/www/auto-finance-dashboard
  sudo cp -r dashboard/dist/* /var/www/auto-finance-dashboard/
EOF

echo "✅ Deployment complete!"
echo "🌐 Check: http://$ORACLE_HOST:3000/health"
