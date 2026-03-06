# WebDex AI — Architecture

## Overview

WebDex is a semantic action index of the web. It crawls websites, extracts structured entities using AI, and serves them via API and MCP for AI agent consumption.

## Data Flow

```
Web → Crawler (HTTP/Playwright) → AI Interpreter → Entity Extraction → PostgreSQL + pgvector → API/MCP → AI Agents
```

## Packages

- `@webdex/shared` — Types, constants, utilities
- `@webdex/crawler` — Web crawling engine (HTTP + Playwright)
- `@webdex/interpreter` — AI interpretation pipeline (Sprint 2)
- `@webdex/database` — PostgreSQL schema + queries
- `@webdex/api` — REST API server (Sprint 3)
- `@webdex/mcp-server` — MCP tool server (Sprint 3)
- `@webdex/dashboard` — Next.js web dashboard (Sprint 4)

## Tech Stack

- TypeScript, Node.js, Playwright, Cheerio
- PostgreSQL 16 + pgvector, Redis 7
- Qwen2.5-3B (local AI), all-MiniLM-L6-v2 (embeddings)
- Hono (API), MCP SDK, Next.js (dashboard)
