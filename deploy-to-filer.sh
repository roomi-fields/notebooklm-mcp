#!/bin/bash
# Deploy NotebookLM MCP to filer
# Usage: ./deploy-to-filer.sh

set -e

FILER_HOST="filer"
FILER_USER="romainadmin"
REMOTE_DIR="/home/romainadmin/notebooklm-mcp"
LOCAL_DATA="$HOME/.local/share/notebooklm-mcp"

echo "=========================================="
echo "  NotebookLM MCP - Deploy to Filer"
echo "=========================================="
echo ""

# Step 1: Create directory on filer
echo "📁 Step 1: Creating directory on filer..."
ssh ${FILER_USER}@${FILER_HOST} "mkdir -p ${REMOTE_DIR}"

# Step 2: Copy project files
echo "📦 Step 2: Copying project files..."
scp -r Dockerfile docker-compose.yml .dockerignore package*.json dist/ ${FILER_USER}@${FILER_HOST}:${REMOTE_DIR}/

# Step 3: Copy credentials (accounts, browser state, encryption key)
echo "🔐 Step 3: Copying credentials..."
ssh ${FILER_USER}@${FILER_HOST} "mkdir -p ${REMOTE_DIR}/data"
scp -r ${LOCAL_DATA}/accounts ${FILER_USER}@${FILER_HOST}:${REMOTE_DIR}/data/
scp -r ${LOCAL_DATA}/accounts.json ${FILER_USER}@${FILER_HOST}:${REMOTE_DIR}/data/
scp -r ${LOCAL_DATA}/browser_state ${FILER_USER}@${FILER_HOST}:${REMOTE_DIR}/data/
scp -r ${LOCAL_DATA}/encryption.key ${FILER_USER}@${FILER_HOST}:${REMOTE_DIR}/data/
scp -r ${LOCAL_DATA}/library.json ${FILER_USER}@${FILER_HOST}:${REMOTE_DIR}/data/
scp -r ${LOCAL_DATA}/current-account.txt ${FILER_USER}@${FILER_HOST}:${REMOTE_DIR}/data/ 2>/dev/null || true

# Step 4: Update docker-compose to use local data directory
echo "⚙️  Step 4: Configuring docker-compose..."
ssh ${FILER_USER}@${FILER_HOST} "cd ${REMOTE_DIR} && sed -i 's|notebooklm-data:/data|./data:/data|g' docker-compose.yml"

# Step 5: Build and start
echo "🐳 Step 5: Building Docker image..."
ssh ${FILER_USER}@${FILER_HOST} "cd ${REMOTE_DIR} && docker-compose build"

echo "🚀 Step 6: Starting container..."
ssh ${FILER_USER}@${FILER_HOST} "cd ${REMOTE_DIR} && docker-compose up -d"

# Step 7: Verify
echo ""
echo "⏳ Waiting for server to start..."
sleep 10

echo "🔍 Checking health..."
ssh ${FILER_USER}@${FILER_HOST} "curl -s http://localhost:3000/health"

echo ""
echo "=========================================="
echo "  ✅ Deployment complete!"
echo "=========================================="
echo ""
echo "  Server: http://filer:3000"
echo "  Health: http://filer:3000/health"
echo ""
echo "  Commands:"
echo "    ssh ${FILER_USER}@${FILER_HOST} 'cd ${REMOTE_DIR} && docker-compose logs -f'"
echo "    ssh ${FILER_USER}@${FILER_HOST} 'cd ${REMOTE_DIR} && docker-compose down'"
echo ""
