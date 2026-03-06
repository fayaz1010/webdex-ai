#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Oracle A1 Flex server setup script
# Run this on the Oracle Cloud instance after SSH'ing in.
#
# Instance spec (free tier):
#   4 OCPU (Ampere A1), 24 GB RAM, ARM64 (aarch64)
#   Region: ap-melbourne-1
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "=== System info ==="
uname -a
cat /etc/os-release | head -3
free -h

echo ""
echo "=== Installing dependencies ==="
sudo apt-get update
sudo apt-get install -y curl git build-essential cmake

# Node.js 20 LTS (ARM64)
if ! command -v node &>/dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node: $(node --version)"

# pnpm
if ! command -v pnpm &>/dev/null; then
  npm install -g pnpm@9
fi
echo "pnpm: $(pnpm --version)"

# Redis (for BullMQ job queues)
if ! command -v redis-server &>/dev/null; then
  echo "Installing Redis..."
  sudo apt-get install -y redis-server
  sudo systemctl enable redis-server
  sudo systemctl start redis-server
fi
echo "Redis: $(redis-cli ping)"

# Playwright system deps (for browser-based crawling)
sudo npx playwright@latest install-deps chromium 2>/dev/null || true

# OCI CLI config
echo ""
echo "=== Setting up OCI config ==="
mkdir -p ~/.oci
# The private key should be copied to ~/.oci/oci_api_key.pem
if [ ! -f ~/.oci/oci_api_key.pem ]; then
  echo "WARNING: Copy your OCI private key to ~/.oci/oci_api_key.pem"
  echo "  scp mohamed.fayaz@gmail.com-2026-03-06T02_22_46.681Z.pem opc@<server-ip>:~/.oci/oci_api_key.pem"
fi
chmod 600 ~/.oci/oci_api_key.pem 2>/dev/null || true

# OCI config is generated from vault credentials.
# If you need to set it manually, copy config/oci-config to ~/.oci/config
# and update key_file path.
if [ -f "$WEBDEX_DIR/config/oci-config" ]; then
  cp "$WEBDEX_DIR/config/oci-config" ~/.oci/config
fi
chmod 600 ~/.oci/config 2>/dev/null || true

# Clone or update the repo
echo ""
echo "=== Setting up WebDex ==="
WEBDEX_DIR="$HOME/webdex-ai"
if [ -d "$WEBDEX_DIR" ]; then
  cd "$WEBDEX_DIR" && git pull origin main
else
  git clone https://github.com/fayaz1010/webdex-ai.git "$WEBDEX_DIR"
  cd "$WEBDEX_DIR"
fi

# Install deps
pnpm install

# Download the 14B model
echo ""
echo "=== Downloading Qwen2.5-14B-Instruct-Q8_0 (~15.7 GB) ==="
echo "This will take 10-20 minutes on Oracle network..."
bash scripts/download-models.sh

# Create .env
echo ""
echo "=== Creating .env ==="
# Copy .env.example and fill in your keys:
cp .env.example .env
echo ""
echo "IMPORTANT: Edit .env and fill in your actual API keys."
echo "  Get them from the OzDesk vault (see VAULT-ACCESS-GUIDE.md)"
echo "  Required: DATABASE_URL, OPENROUTER_API_KEY, ESCALATION_API_KEY"
echo ""
# Set the Oracle-specific values
sed -i 's|LOCAL_MODEL_PATH=.*|LOCAL_MODEL_PATH=./packages/interpreter/models/qwen2.5-14b-instruct-q8_0.gguf|' .env
sed -i 's|LLM_THREADS=.*|LLM_THREADS=7|' .env
sed -i 's|LLM_CONTEXT_SIZE=.*|LLM_CONTEXT_SIZE=8192|' .env
sed -i 's|REDIS_URL=.*|REDIS_URL=redis://localhost:6379|' .env

# Run migrations
echo ""
echo "=== Running DB migrations ==="
pnpm run migrate

# Build everything
echo ""
echo "=== Building ==="
pnpm turbo build

# Create systemd services
echo ""
echo "=== Creating systemd services ==="

sudo tee /etc/systemd/system/webdex-worker.service > /dev/null << 'SVC'
[Unit]
Description=WebDex AI Worker (crawl + interpret)
After=network.target redis-server.service

[Service]
Type=simple
User=opc
WorkingDirectory=/home/opc/webdex-ai
ExecStart=/usr/bin/node packages/interpreter/dist/worker.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SVC

sudo tee /etc/systemd/system/webdex-api.service > /dev/null << 'SVC'
[Unit]
Description=WebDex AI API Server
After=network.target redis-server.service

[Service]
Type=simple
User=opc
WorkingDirectory=/home/opc/webdex-ai
ExecStart=/usr/bin/node packages/api/dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SVC

sudo systemctl daemon-reload
sudo systemctl enable webdex-worker webdex-api
sudo systemctl start webdex-worker webdex-api

echo ""
echo "=== Done! ==="
echo "Worker status:  sudo systemctl status webdex-worker"
echo "API status:     sudo systemctl status webdex-api"
echo "Worker logs:    sudo journalctl -u webdex-worker -f"
echo "API logs:       sudo journalctl -u webdex-api -f"
echo ""
echo "Memory usage:"
free -h
