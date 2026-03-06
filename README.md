# WebDex AI

**The Semantic Action Index for the AI Web**

Google finds pages. Perplexity writes answers. WebDex gets things done.

## Quick Start

```bash
# 1. Clone and install
pnpm install

# 2. Start services
docker compose up -d

# 3. Setup everything
bash scripts/setup-dev.sh

# 4. Crawl your first page
pnpm crawl https://www.regenpower.com
```

## First Vertical: Solar Industry, Perth WA

See `packages/crawler/src/seeds/solar-perth.ts` for seed URLs.
