# WebDex Deployment Guide

## Local Development
```bash
docker compose up -d
bash scripts/setup-dev.sh
pnpm crawl https://www.regenpower.com
```

## Production (Railway + Neon + Vercel)

### Database: Neon
1. Create Neon project with pgvector extension
2. Run migrations: `DATABASE_URL=... pnpm migrate`

### API: Railway
1. Deploy packages/api via Dockerfile
2. Set env vars: DATABASE_URL, REDIS_URL

### MCP Server: Railway
1. Deploy packages/mcp-server via Dockerfile

### Crawler: Railway
1. Deploy packages/crawler via Dockerfile
2. Needs more RAM for Playwright (2GB+)

### Dashboard: Vercel
1. Deploy packages/dashboard as Next.js
2. Set API_URL env var

### Cache: Upstash Redis
1. Create Upstash Redis instance
2. Set REDIS_URL across all services
