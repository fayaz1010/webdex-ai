#!/bin/bash
set -e
echo "🚀 WebDex Dev Setup"
echo "==================="

echo "1. Installing dependencies..."
pnpm install

echo "2. Starting Docker services..."
docker compose up -d

echo "3. Waiting for PostgreSQL..."
sleep 5

echo "4. Running database migrations..."
pnpm --filter @webdex/database migrate

echo "5. Installing Playwright browsers..."
pnpm --filter @webdex/crawler exec playwright install chromium

echo ""
echo "✅ WebDex dev environment ready!"
echo ""
echo "Try: pnpm crawl https://www.regenpower.com"
