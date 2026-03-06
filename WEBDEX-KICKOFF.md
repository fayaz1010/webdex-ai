# WebDex AI — Technical Kickoff Plan

## Project: WebDex AI — The Semantic Action Index for the AI Web
## Owner: Mohamed Fayaz, Oz Systems Pty Ltd
## Start Date: March 2026
## First Vertical: Solar Industry, Perth WA
## Target MVP: 4-6 weeks

---

## 1. MISSION

Build a pre-indexed semantic action map of the web that AI agents can query instead of interpreting pages in real-time. Start with solar industry in Perth (~2,000-3,000 pages), prove the concept, then scale.

**One-line pitch:** Google finds pages. Perplexity writes answers. WebDex gets things done.

---

## 2. MONOREPO STRUCTURE

```
webdex-ai/
├── package.json                    # Root workspace config
├── tsconfig.base.json              # Shared TypeScript config
├── turbo.json                      # Turborepo pipeline config
├── .env.example                    # Environment variables template
├── docker-compose.yml              # Local dev: Postgres + Redis + Playwright
├── docker-compose.prod.yml         # Production deployment
│
├── packages/
│   ├── shared/                     # Shared types, utils, constants
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── entities.ts     # Entity type definitions (Contact, Organisation, Product, Action, Location, Event, Review, Regulation)
│   │   │   │   ├── page-index.ts   # PageIndex schema definition
│   │   │   │   ├── crawl.ts        # Crawl job types
│   │   │   │   └── api.ts          # API request/response types
│   │   │   ├── constants/
│   │   │   │   ├── categories.ts   # Entity category definitions
│   │   │   │   ├── page-types.ts   # Page type classifications
│   │   │   │   └── scoring.ts      # AIEO scoring weights
│   │   │   └── utils/
│   │   │       ├── url.ts          # URL normalisation, domain extraction
│   │   │       ├── hash.ts         # Content hashing for change detection
│   │   │       └── email.ts        # Email pattern detection/inference
│   │   └── package.json
│   │
│   ├── crawler/                    # Web crawling engine
│   │   ├── src/
│   │   │   ├── index.ts            # Crawler entry point
│   │   │   ├── fetcher/
│   │   │   │   ├── http-fetcher.ts         # Lightweight HTTP + Cheerio (for static pages)
│   │   │   │   ├── browser-fetcher.ts      # Playwright headless browser (for JS-heavy pages)
│   │   │   │   └── smart-router.ts         # Routes pages to HTTP or Browser based on needs
│   │   │   ├── extractor/
│   │   │   │   ├── dom-extractor.ts        # Clean DOM extraction, strip scripts/styles
│   │   │   │   ├── a11y-extractor.ts       # Accessibility tree extraction
│   │   │   │   ├── form-extractor.ts       # Form fields, actions, endpoints, validation rules
│   │   │   │   ├── link-extractor.ts       # All links with semantic context
│   │   │   │   ├── media-extractor.ts      # Image metadata, video embed detection
│   │   │   │   └── network-extractor.ts    # XHR/fetch interception for API discovery
│   │   │   ├── scheduler/
│   │   │   │   ├── crawl-queue.ts          # BullMQ job queue management
│   │   │   │   ├── domain-scheduler.ts     # Per-domain rate limiting and politeness
│   │   │   │   ├── priority-manager.ts     # Crawl priority based on page importance
│   │   │   │   └── change-detector.ts      # Content hash comparison for re-crawl decisions
│   │   │   └── seeds/
│   │   │       ├── solar-perth.ts          # Seed URLs for solar industry Perth
│   │   │       └── seed-loader.ts          # Generic seed URL loader
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── interpreter/                # AI interpretation engine
│   │   ├── src/
│   │   │   ├── index.ts            # Interpreter entry point
│   │   │   ├── models/
│   │   │   │   ├── local-model.ts          # llama.cpp / ONNX runtime wrapper for embedded 3B model
│   │   │   │   ├── embedding-model.ts      # Sentence transformer for vector embeddings
│   │   │   │   └── escalation-model.ts     # Claude API fallback for complex pages (Phase 1 training data)
│   │   │   ├── pipeline/
│   │   │   │   ├── classify-page.ts        # Pass 1: Page type classification
│   │   │   │   ├── extract-entities.ts     # Pass 2: Entity extraction (contacts, orgs, products, etc.)
│   │   │   │   ├── map-actions.ts          # Pass 3: Form/action/flow mapping
│   │   │   │   ├── detect-flows.ts         # Pass 4: Multi-step flow detection
│   │   │   │   └── score-page.ts           # AIEO score calculation
│   │   │   ├── prompts/
│   │   │   │   ├── classify.txt            # Page classification prompt template
│   │   │   │   ├── extract-contacts.txt    # Contact entity extraction prompt
│   │   │   │   ├── extract-products.txt    # Product entity extraction prompt
│   │   │   │   ├── extract-actions.txt     # Action/form mapping prompt
│   │   │   │   └── extract-general.txt     # General entity extraction prompt
│   │   │   └── training/
│   │   │       ├── generate-training.ts    # Use Claude API to generate training data from crawled pages
│   │   │       ├── evaluate-accuracy.ts    # Compare local model output vs Claude output
│   │   │       └── fine-tune-prep.ts       # Prepare data for fine-tuning the local model
│   │   ├── models/                         # Downloaded model weights (gitignored)
│   │   │   └── .gitkeep
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── database/                   # Database schema, migrations, queries
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── migrations/
│   │   │   │   │   ├── 001_initial.sql             # Core tables: entities, pages, relationships
│   │   │   │   │   ├── 002_vector_index.sql        # pgvector extension + HNSW indexes
│   │   │   │   │   ├── 003_materialized_views.sql  # Per-category views for fast queries
│   │   │   │   │   └── 004_crawl_tables.sql        # Crawl queue, crawl history, domain profiles
│   │   │   │   └── seed/
│   │   │   │       └── solar-perth-seeds.sql        # Initial seed data
│   │   │   ├── queries/
│   │   │   │   ├── entities.ts     # Entity CRUD operations
│   │   │   │   ├── search.ts       # Full-text + vector hybrid search
│   │   │   │   ├── relationships.ts # Entity relationship queries
│   │   │   │   ├── assembly.ts     # Cross-category assembly queries
│   │   │   │   └── analytics.ts    # Query analytics for Site Owner Console
│   │   │   └── client.ts           # PostgreSQL connection pool (pg + pgvector)
│   │   └── package.json
│   │
│   ├── api/                        # REST + GraphQL API server
│   │   ├── src/
│   │   │   ├── index.ts            # Hono server entry point
│   │   │   ├── routes/
│   │   │   │   ├── search.ts       # GET /v1/search — hybrid search across entities
│   │   │   │   ├── pages.ts        # GET /v1/pages/:id — full page index
│   │   │   │   ├── entities.ts     # GET /v1/entities — entity CRUD + filtered queries
│   │   │   │   ├── forms.ts        # GET /v1/forms/:id — form schema detail
│   │   │   │   ├── actions.ts      # POST /v1/actions/execute — execute an action (submit form)
│   │   │   │   ├── assemble.ts     # POST /v1/assemble — cross-category data assembly
│   │   │   │   ├── crawl.ts        # POST /v1/crawl — request on-demand crawl
│   │   │   │   └── health.ts       # GET /health — health check
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts         # API key authentication
│   │   │   │   ├── rate-limit.ts   # Redis-backed rate limiting
│   │   │   │   ├── cache.ts        # Redis query caching
│   │   │   │   └── cors.ts         # CORS configuration
│   │   │   └── openapi.ts          # Auto-generated OpenAPI spec
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── mcp-server/                 # MCP (Model Context Protocol) server
│   │   ├── src/
│   │   │   ├── index.ts            # MCP server entry point
│   │   │   └── tools/
│   │   │       ├── search-entities.ts      # webdex.search — search the entity index
│   │   │       ├── get-page-actions.ts     # webdex.get_actions — get action map for a URL
│   │   │       ├── get-form-schema.ts      # webdex.get_form — get form schema for submission
│   │   │       ├── submit-form.ts          # webdex.submit_form — execute a form submission
│   │   │       ├── assemble-data.ts        # webdex.assemble — cross-category data assembly
│   │   │       ├── compare-entities.ts     # webdex.compare — structured comparison
│   │   │       └── request-crawl.ts        # webdex.crawl — request on-demand indexing of a URL
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── dashboard/                  # Next.js web dashboard
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx                # Landing / search page
│       │   │   ├── search/page.tsx         # Search results with entity cards
│       │   │   ├── entity/[id]/page.tsx    # Entity detail view
│       │   │   ├── console/               # Site Owner Console
│       │   │   │   ├── page.tsx            # Console dashboard
│       │   │   │   ├── analytics/page.tsx  # Agent query analytics
│       │   │   │   ├── entities/page.tsx   # Manage your entities
│       │   │   │   └── aieo/page.tsx       # AIEO score + suggestions
│       │   │   └── admin/                  # Internal admin
│       │   │       ├── crawl/page.tsx       # Crawl status + queue
│       │   │       └── index-stats/page.tsx # Index statistics
│       │   └── components/
│       │       ├── EntityCard.tsx
│       │       ├── ComparisonTable.tsx
│       │       ├── ActionButton.tsx
│       │       ├── AieoScoreWidget.tsx
│       │       └── SearchBar.tsx
│       ├── package.json
│       └── next.config.js
│
├── scripts/
│   ├── setup-dev.sh                # One-command dev environment setup
│   ├── download-models.sh          # Download AI model weights
│   ├── run-initial-crawl.sh        # Start the solar Perth seed crawl
│   └── evaluate-accuracy.sh        # Run accuracy evaluation on sample pages
│
└── docs/
    ├── ARCHITECTURE.md             # System architecture overview
    ├── ENTITY-SCHEMA.md            # Entity category definitions
    ├── API.md                      # API documentation
    ├── MCP-TOOLS.md                # MCP tool documentation
    ├── DEPLOYMENT.md               # Deployment guide
    └── AIEO-ALGORITHM.md           # AIEO ranking algorithm specification
```

---

## 3. DATABASE SCHEMA (Initial Migration)

```sql
-- 001_initial.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- PAGES — every crawled URL
-- ============================================================
CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT UNIQUE NOT NULL,
    domain TEXT NOT NULL,
    content_hash TEXT,                    -- SHA256 of cleaned content
    page_type TEXT,                       -- product_landing, contact, article, etc.
    page_type_confidence FLOAT,
    http_status INT,
    last_crawled TIMESTAMPTZ,
    last_changed TIMESTAMPTZ,            -- when content_hash last differed
    crawl_frequency TEXT DEFAULT 'monthly', -- hourly, daily, weekly, monthly
    version INT DEFAULT 1,
    requires_js BOOLEAN DEFAULT false,
    cms_detected TEXT,
    meta JSONB DEFAULT '{}',             -- robots, cdn, analytics, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pages_domain ON pages(domain);
CREATE INDEX idx_pages_page_type ON pages(page_type);
CREATE INDEX idx_pages_last_crawled ON pages(last_crawled);

-- ============================================================
-- ENTITIES — universal entity table with JSONB data
-- ============================================================
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,              -- contact, organisation, product, action, location, event, review, regulation
    subcategory TEXT,                    -- e.g., solar_installer, university, quote_form
    data JSONB NOT NULL,                 -- all entity fields as flexible JSON
    domain TEXT NOT NULL,                -- source domain
    page_id UUID REFERENCES pages(id) ON DELETE SET NULL,
    confidence FLOAT DEFAULT 0.0,        -- AI extraction confidence
    aieo_score FLOAT DEFAULT 0.0,        -- computed AIEO score
    embedding vector(384),               -- semantic embedding (all-MiniLM-L6-v2)
    searchable_text TEXT,                -- concatenated text for full-text search
    is_verified BOOLEAN DEFAULT false,   -- site owner verified this entity
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entities_category ON entities(category);
CREATE INDEX idx_entities_domain ON entities(domain);
CREATE INDEX idx_entities_subcategory ON entities(subcategory);
CREATE INDEX idx_entities_confidence ON entities(confidence);
CREATE INDEX idx_entities_searchable_text ON entities USING gin(to_tsvector('english', searchable_text));

-- Vector similarity index (HNSW for fast approximate search)
CREATE INDEX idx_entities_embedding ON entities USING hnsw(embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================================
-- RELATIONSHIPS — links between entities
-- ============================================================
CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    to_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,     -- works_at, located_at, offers, has_action, reviewed_by, etc.
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rel_from ON relationships(from_entity_id);
CREATE INDEX idx_rel_to ON relationships(to_entity_id);
CREATE INDEX idx_rel_type ON relationships(relationship_type);

-- ============================================================
-- CRAWL_QUEUE — pending crawl jobs
-- ============================================================
CREATE TABLE crawl_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    priority INT DEFAULT 5,              -- 1=highest, 10=lowest
    source TEXT,                          -- seed, discovered, re-crawl, on-demand
    status TEXT DEFAULT 'pending',        -- pending, in_progress, completed, failed
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_status ON crawl_queue(status, priority, scheduled_for);
CREATE INDEX idx_queue_domain ON crawl_queue(domain);

-- ============================================================
-- DOMAIN_PROFILES — per-domain crawl configuration
-- ============================================================
CREATE TABLE domain_profiles (
    domain TEXT PRIMARY KEY,
    pages_discovered INT DEFAULT 0,
    pages_indexed INT DEFAULT 0,
    crawl_frequency TEXT DEFAULT 'monthly',
    robots_txt TEXT,
    rate_limit_ms INT DEFAULT 1000,      -- min delay between requests to this domain
    email_pattern TEXT,                   -- detected email pattern: firstname.lastname@domain
    cms TEXT,
    is_claimed BOOLEAN DEFAULT false,     -- site owner claimed in console
    owner_tier TEXT,                      -- free, basic, pro, enterprise
    meta JSONB DEFAULT '{}',
    last_crawled TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- API_KEYS — for developer access
-- ============================================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash TEXT UNIQUE NOT NULL,        -- SHA256 of the actual key
    name TEXT,
    owner_email TEXT NOT NULL,
    tier TEXT DEFAULT 'free',             -- free, builder, pro, enterprise
    rate_limit_per_day INT DEFAULT 1000,
    queries_today INT DEFAULT 0,
    queries_total BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- ============================================================
-- MATERIALISED VIEWS — per-category for fast typed queries
-- ============================================================
CREATE MATERIALIZED VIEW contacts_view AS
SELECT
    e.id,
    e.data->>'name' AS name,
    e.data->>'role' AS role,
    e.data->>'email' AS email,
    e.data->>'phone' AS phone,
    e.data->>'department' AS department,
    e.data->>'seniority' AS seniority,
    e.domain,
    e.confidence,
    e.aieo_score,
    e.embedding,
    e.created_at,
    e.updated_at
FROM entities e
WHERE e.category = 'contact';

CREATE MATERIALIZED VIEW organisations_view AS
SELECT
    e.id,
    e.data->>'name' AS name,
    e.data->>'type' AS org_type,
    e.data->>'industry' AS industry,
    e.data->>'address' AS address,
    e.data->>'phone' AS phone,
    e.data->>'website' AS website,
    e.data->>'abn' AS abn,
    e.data->'accreditations' AS accreditations,
    e.domain,
    e.confidence,
    e.aieo_score,
    e.embedding,
    e.created_at,
    e.updated_at
FROM entities e
WHERE e.category = 'organisation';

CREATE MATERIALIZED VIEW products_view AS
SELECT
    e.id,
    e.data->>'name' AS name,
    e.data->>'provider' AS provider,
    e.data->>'product_type' AS product_type,
    (e.data->'price'->>'amount')::NUMERIC AS price_amount,
    e.data->'price'->>'currency' AS price_currency,
    e.data->'price'->>'qualifier' AS price_qualifier,
    e.data->'rating'->>'score' AS rating_score,
    e.data->'rating'->>'count' AS rating_count,
    e.domain,
    e.confidence,
    e.aieo_score,
    e.embedding,
    e.created_at,
    e.updated_at
FROM entities e
WHERE e.category = 'product';

CREATE MATERIALIZED VIEW actions_view AS
SELECT
    e.id,
    e.data->>'type' AS action_type,
    e.data->>'purpose' AS purpose,
    e.data->>'endpoint' AS endpoint,
    e.data->>'method' AS method,
    e.data->'fields' AS fields,
    (e.data->>'success_rate')::FLOAT AS success_rate,
    e.domain,
    e.confidence,
    e.created_at,
    e.updated_at
FROM entities e
WHERE e.category = 'action';
```

---

## 4. SPRINT PLAN

### Sprint 1 — Foundation (Week 1-2)

**Goal: Crawl a page, extract entities, store them, query them.**

| # | Task | Agent | Priority | Estimated |
|---|------|-------|----------|-----------|
| 1.1 | Init monorepo: package.json, turbo.json, tsconfig, workspaces | Claude Code | P0 | 1 hour |
| 1.2 | docker-compose.yml: PostgreSQL 16 + pgvector + Redis 7 | Claude Code | P0 | 30 min |
| 1.3 | Run database migrations (001-004) | Claude Code | P0 | 1 hour |
| 1.4 | Build `packages/shared` — all TypeScript types and constants | Claude Code | P0 | 2 hours |
| 1.5 | Build `http-fetcher.ts` — fetch a URL, return clean HTML + headers | Claude Code | P0 | 2 hours |
| 1.6 | Build `browser-fetcher.ts` — Playwright fetch with a11y tree + network interception | Claude Code | P0 | 4 hours |
| 1.7 | Build `smart-router.ts` — try HTTP first, escalate to Playwright if JS-heavy | Claude Code | P0 | 2 hours |
| 1.8 | Build `dom-extractor.ts` — strip scripts/styles, extract semantic HTML skeleton | Claude Code | P0 | 2 hours |
| 1.9 | Build `form-extractor.ts` — extract all forms with fields, types, actions, endpoints | Claude Code | P0 | 3 hours |
| 1.10 | Build `link-extractor.ts` — extract all links with context and classification | Claude Code | P1 | 2 hours |
| 1.11 | Build `media-extractor.ts` — image metadata (alt, dimensions, EXIF), video embed detection | Claude Code | P1 | 2 hours |
| 1.12 | Build `network-extractor.ts` — capture XHR/fetch requests for API discovery | Claude Code | P1 | 3 hours |
| 1.13 | Build database client (`packages/database`) — connection pool, basic CRUD | Claude Code | P0 | 2 hours |
| 1.14 | Create solar Perth seed URLs file — manually curate 20-30 starter URLs | Mohamed | P0 | 1 hour |
| 1.15 | Integration test: crawl solarpanelspro.com.au → store raw page → verify extraction | Both | P0 | 2 hours |

**Sprint 1 Deliverable:** CLI command `pnpm crawl <url>` that fetches any URL, extracts DOM + forms + links + media + network requests, and stores the raw page in PostgreSQL.

---

### Sprint 2 — AI Interpretation (Week 3-4)

**Goal: AI interprets crawled pages into structured entities.**

| # | Task | Agent | Priority | Estimated |
|---|------|-------|----------|-----------|
| 2.1 | Download and configure local model: Qwen2.5-3B-Instruct (Q4_K_M GGUF) | Claude Code | P0 | 1 hour |
| 2.2 | Build `local-model.ts` — llama.cpp Node.js binding or node-llama-cpp wrapper | Claude Code | P0 | 3 hours |
| 2.3 | Build `embedding-model.ts` — all-MiniLM-L6-v2 via @xenova/transformers | Claude Code | P0 | 2 hours |
| 2.4 | Build `escalation-model.ts` — Claude API client for complex pages + training data generation | Claude Code | P1 | 2 hours |
| 2.5 | Write prompt: `classify.txt` — page type classification (test on 20 sample pages) | Mohamed + Claude | P0 | 3 hours |
| 2.6 | Write prompt: `extract-contacts.txt` — contact entity extraction | Mohamed + Claude | P0 | 3 hours |
| 2.7 | Write prompt: `extract-products.txt` — product/service entity extraction | Mohamed + Claude | P0 | 3 hours |
| 2.8 | Write prompt: `extract-actions.txt` — form/action/API mapping | Mohamed + Claude | P0 | 3 hours |
| 2.9 | Build `classify-page.ts` — Pass 1 pipeline: page type classification | Claude Code | P0 | 2 hours |
| 2.10 | Build `extract-entities.ts` — Pass 2 pipeline: entity extraction by category | Claude Code | P0 | 4 hours |
| 2.11 | Build `map-actions.ts` — Pass 3 pipeline: form/action schema mapping | Claude Code | P0 | 3 hours |
| 2.12 | Build `score-page.ts` — AIEO score calculation from extracted data | Claude Code | P1 | 2 hours |
| 2.13 | Build entity storage: parse AI output → create entities + relationships in DB | Claude Code | P0 | 3 hours |
| 2.14 | Build embedding pipeline: generate vector for each entity, store in pgvector | Claude Code | P0 | 2 hours |
| 2.15 | Accuracy evaluation: crawl 50 solar pages, compare local model vs Claude API output | Mohamed | P0 | 4 hours |
| 2.16 | Iterate prompts based on accuracy results — target >85% entity extraction accuracy | Mohamed + Claude | P0 | 4 hours |

**Sprint 2 Deliverable:** CLI command `pnpm interpret <url>` that crawls a URL, interprets it with the local AI, extracts structured entities (contacts, organisations, products, actions), generates embeddings, and stores everything in PostgreSQL with relationships.

---

### Sprint 3 — API & MCP Server (Week 5)

**Goal: External access to the index via REST API and MCP tools.**

| # | Task | Agent | Priority | Estimated |
|---|------|-------|----------|-----------|
| 3.1 | Build Hono API server scaffold with middleware (auth, rate-limit, cache, CORS) | Claude Code | P0 | 3 hours |
| 3.2 | Build `GET /v1/search` — hybrid search: full-text + vector similarity + structured filters | Claude Code | P0 | 4 hours |
| 3.3 | Build `GET /v1/entities/:id` — entity detail with relationships | Claude Code | P0 | 1 hour |
| 3.4 | Build `GET /v1/pages/:id` — full page index with all entities | Claude Code | P1 | 1 hour |
| 3.5 | Build `GET /v1/forms/:id` — form schema detail for agent submission | Claude Code | P0 | 1 hour |
| 3.6 | Build `POST /v1/actions/execute` — proxy form submission on behalf of agent | Claude Code | P0 | 3 hours |
| 3.7 | Build `POST /v1/assemble` — cross-category data assembly (the "build me a spreadsheet" endpoint) | Claude Code | P0 | 4 hours |
| 3.8 | Build `POST /v1/crawl` — on-demand crawl request | Claude Code | P1 | 1 hour |
| 3.9 | Auto-generate OpenAPI spec from routes | Claude Code | P1 | 1 hour |
| 3.10 | Build MCP server with all 7 tools (search, get_actions, get_form, submit_form, assemble, compare, crawl) | Claude Code | P0 | 4 hours |
| 3.11 | API key generation and management | Claude Code | P1 | 2 hours |
| 3.12 | Redis caching layer for frequent queries | Claude Code | P1 | 2 hours |
| 3.13 | Integration test: query API for "solar installers perth" → get structured results with action maps | Both | P0 | 2 hours |

**Sprint 3 Deliverable:** Working REST API + MCP server that any AI agent (Claude, GPT, etc.) can query for entities, form schemas, and execute actions.

---

### Sprint 4 — Dashboard & Launch (Week 6)

**Goal: Human-facing dashboard, full seed crawl, soft launch.**

| # | Task | Agent | Priority | Estimated |
|---|------|-------|----------|-----------|
| 4.1 | Next.js dashboard scaffold with Tailwind | Claude Code | P0 | 2 hours |
| 4.2 | Search page — search bar, entity result cards, comparison toggle | Claude Code | P0 | 4 hours |
| 4.3 | Entity detail page — full entity view with related entities and action buttons | Claude Code | P0 | 3 hours |
| 4.4 | Admin: crawl status dashboard — queue depth, pages crawled, entities extracted | Claude Code | P1 | 3 hours |
| 4.5 | Admin: index statistics — entities by category, domains indexed, AIEO score distribution | Claude Code | P1 | 2 hours |
| 4.6 | Run full solar Perth seed crawl — all ~2,000-3,000 pages | Mohamed | P0 | 4 hours (monitoring) |
| 4.7 | Quality audit: manually verify 100 entities for accuracy | Mohamed | P0 | 3 hours |
| 4.8 | Fix interpretation errors found in audit, re-run affected pages | Claude Code | P0 | 4 hours |
| 4.9 | Deploy to production: Railway (API + crawler) + Neon (Postgres) + Vercel (dashboard) | Claude Code | P0 | 3 hours |
| 4.10 | Domain setup: webdex.ai or chosen domain | Mohamed | P0 | 1 hour |
| 4.11 | Create demo: "solar installers perth" query → comparison → quote submission | Both | P0 | 2 hours |
| 4.12 | Write landing page copy + developer quickstart docs | Claude Code | P1 | 3 hours |

**Sprint 4 Deliverable:** Production-deployed WebDex with solar Perth vertical indexed. Working search, entity browsing, action execution. Demo-ready.

---

## 5. SEED URLs — Solar Perth Vertical

```typescript
// packages/crawler/src/seeds/solar-perth.ts

export const solarPerthSeeds = {
  // Government & Authority (crawl first — these are the entity registries)
  government: [
    "https://www.cleanenergycouncil.org.au/consumers/find-an-installer", // CEC accredited installer directory
    "https://www.cleanenergyregulator.gov.au/RET/Forms-and-resources/Postcode-data-for-small-scale-installations",
    "https://www.energy.gov.au/rebates/small-scale-technology-certificates",
    "https://www.wa.gov.au/service/environment/environment-information-services/household-energy-efficiency-scheme",
    "https://www.synergy.net.au/Your-home/Manage-account/Solar-connections",
    "https://www.westernpower.com.au/industry/manuals-guides-standards/solar-pv/",
  ],

  // Major installers (deep crawl their full sites)
  installers: [
    "https://www.regenpower.com",
    "https://www.infiniteenergy.com.au",
    "https://www.solarcity.com.au",
    "https://www.solarwholesale.com.au",
    "https://www.penrithenergy.com.au",
    "https://www.sparksolarpanels.com.au",
    "https://www.clearelectrical.com.au",
    "https://www.solarright.com.au",
    "https://www.positronic.com.au",
    "https://www.greenearth.com.au",
    "https://www.arise.solar",
    "https://www.solargain.com.au",
    "https://www.eurosolarsystems.com.au",
    "https://www.solarcraft.com.au",
    "https://www.cleannrg.com.au",
    // ... expand to ~50-80 installers from CEC directory
  ],

  // Review & comparison sites
  reviews: [
    "https://www.solarquotes.com.au/installers/perth/",
    "https://www.productreview.com.au/listings/solar-panel-installation",
    "https://www.canstarblue.com.au/solar/solar-panel-installers/",
    "https://www.choice.com.au/home-improvement/energy-saving/solar/",
  ],

  // Knowledge sources
  knowledge: [
    "https://en.wikipedia.org/wiki/Solar_power_in_Australia",
    "https://www.energymatters.com.au/residential-solar/",
    "https://www.solarchoice.net.au/solar-panels/",
    "https://www.yourenergysavings.gov.au/renewable-energy/solar-energy",
  ],
};
```

---

## 6. AI AGENT ASSIGNMENTS

The autonomous development pipeline uses Claude Code agents for execution. Here's how to assign work:

### Agent 1: Infrastructure & Database
```
Focus: packages/shared, packages/database, docker-compose, migrations
Skills needed: TypeScript, PostgreSQL, pgvector, SQL
Run: "Set up the WebDex monorepo, create docker-compose with Postgres 16 + pgvector + Redis 7, run all database migrations, build the database client with connection pooling. Test that entities can be inserted and queried including vector similarity search."
```

### Agent 2: Crawler Engine  
```
Focus: packages/crawler (all extractors, fetcher, scheduler)
Skills needed: TypeScript, Playwright, Cheerio, Node.js networking
Run: "Build the WebDex crawler with smart routing between HTTP and Playwright, DOM extraction, form extraction, link extraction, media metadata extraction, and network request interception. The crawler should take a URL and output a complete semantic skeleton of the page including all forms with their fields and endpoints. Test against 5 diverse websites."
```

### Agent 3: AI Interpreter
```
Focus: packages/interpreter (model wrappers, pipeline, prompts)
Skills needed: TypeScript, llama.cpp bindings, prompt engineering
Run: "Build the AI interpretation pipeline for WebDex. Set up node-llama-cpp with Qwen2.5-3B-Instruct Q4 model. Build the multi-pass pipeline: page classification → entity extraction → action mapping → AIEO scoring. Each pass should use optimised prompts. Also set up the embedding pipeline with all-MiniLM-L6-v2 via @xenova/transformers. Test against 20 solar installer pages for accuracy."
```

### Agent 4: API & MCP Server
```
Focus: packages/api, packages/mcp-server
Skills needed: TypeScript, Hono, MCP SDK, OpenAPI
Run: "Build the WebDex REST API using Hono with routes for search, entity CRUD, form schemas, action execution, and data assembly. Include middleware for API key auth, Redis rate limiting, and query caching. Also build the MCP server with 7 tools that AI agents can use natively. Generate OpenAPI spec. Test with curl and MCP inspector."
```

### Agent 5: Dashboard
```
Focus: packages/dashboard
Skills needed: TypeScript, Next.js, React, Tailwind CSS
Run: "Build the WebDex dashboard as a Next.js app. Include: search page with entity result cards, entity detail pages, comparison table view, admin pages for crawl status and index statistics. Use a dark theme matching the WebDex brand (dark background, green/cyan accent). Connect to the API for all data."
```

---

## 7. ENVIRONMENT VARIABLES

```env
# .env.example

# Database
DATABASE_URL=postgresql://webdex:webdex@localhost:5432/webdex
DATABASE_POOL_SIZE=10

# Redis
REDIS_URL=redis://localhost:6379

# AI Models
LOCAL_MODEL_PATH=./models/qwen2.5-3b-instruct-q4_k_m.gguf
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
ESCALATION_API_KEY=sk-ant-...   # Claude API key for Phase 1 training data

# Crawler
CRAWL_CONCURRENCY=5
CRAWL_DEFAULT_DELAY_MS=1000
PLAYWRIGHT_HEADLESS=true

# API
API_PORT=3000
API_BASE_URL=http://localhost:3000
MCP_SERVER_PORT=3001

# Auth
JWT_SECRET=your-secret-here
API_KEY_SALT=your-salt-here

# Production
CLOUDFLARE_R2_BUCKET=webdex-media
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
```

---

## 8. TECH STACK SUMMARY

| Layer | Technology | Why |
|-------|-----------|-----|
| Language | TypeScript (strict) | Type safety across entire monorepo, Playwright/Node.js native |
| Monorepo | Turborepo + pnpm workspaces | Fast builds, shared dependencies |
| Crawler | Playwright + Cheerio | JS rendering + fast HTML parsing |
| AI (Local) | node-llama-cpp + Qwen2.5-3B | On-device inference, zero API cost at scale |
| Embeddings | @xenova/transformers + all-MiniLM-L6-v2 | On-device vector generation |
| AI (Fallback) | Anthropic Claude API (Sonnet) | Training data generation, complex page escalation |
| Database | PostgreSQL 16 + pgvector | JSONB flexibility + vector search in one DB |
| Cache/Queue | Redis 7 + BullMQ | Query caching + crawl job queue |
| API | Hono | Lightweight, fast, TypeScript-native |
| MCP | @modelcontextprotocol/sdk | Native AI agent integration |
| Dashboard | Next.js 14 + Tailwind CSS | Fast, server-rendered, modern |
| Deployment | Railway + Neon + Vercel + Cloudflare R2 | Managed infra, fast deploys |

---

## 9. SUCCESS CRITERIA — WEEK 6

At the end of Sprint 4, the MVP is successful if:

- [ ] **2,000+ pages crawled** from solar Perth vertical
- [ ] **5,000+ entities extracted** (contacts, organisations, products, actions)
- [ ] **>85% extraction accuracy** verified against 100 manually checked entities
- [ ] **<500ms average query response** for search API
- [ ] **Working MCP server** that Claude can use to search and submit forms
- [ ] **3+ different installer quote forms** successfully submitted via the action execution endpoint
- [ ] **Dashboard deployed** at webdex.ai with working search and entity browsing
- [ ] **API documented** with OpenAPI spec and quickstart guide

---

## 10. WHAT TO BUILD FIRST — LITERALLY TODAY

1. `mkdir webdex-ai && cd webdex-ai`
2. `pnpm init` and set up workspaces
3. `docker-compose up -d` — Postgres + Redis running
4. Run migration 001 — tables created
5. Build the simplest possible crawl: `fetch("https://regenpower.com") → cheerio parse → extract forms → console.log()`
6. See structured form data in your terminal from a real solar installer website
7. Commit. Push. You've started.

---

**Bismillah. Let's build WebDex.**
