CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT UNIQUE NOT NULL,
    domain TEXT NOT NULL,
    content_hash TEXT,
    page_type TEXT,
    page_type_confidence FLOAT,
    http_status INT,
    last_crawled TIMESTAMPTZ,
    last_changed TIMESTAMPTZ,
    crawl_frequency TEXT DEFAULT 'monthly',
    version INT DEFAULT 1,
    requires_js BOOLEAN DEFAULT false,
    cms_detected TEXT,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pages_domain ON pages(domain);
CREATE INDEX idx_pages_page_type ON pages(page_type);

CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,
    subcategory TEXT,
    data JSONB NOT NULL,
    domain TEXT NOT NULL,
    page_id UUID REFERENCES pages(id) ON DELETE SET NULL,
    confidence FLOAT DEFAULT 0.0,
    aieo_score FLOAT DEFAULT 0.0,
    embedding vector(384),
    searchable_text TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_entities_category ON entities(category);
CREATE INDEX idx_entities_domain ON entities(domain);
CREATE INDEX idx_entities_searchable ON entities USING gin(to_tsvector('english', searchable_text));
CREATE INDEX idx_entities_embedding ON entities USING hnsw(embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    to_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rel_from ON relationships(from_entity_id);
CREATE INDEX idx_rel_to ON relationships(to_entity_id);

CREATE TABLE crawl_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    priority INT DEFAULT 5,
    source TEXT DEFAULT 'seed',
    status TEXT DEFAULT 'pending',
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_queue_status ON crawl_queue(status, priority, scheduled_for);

CREATE TABLE domain_profiles (
    domain TEXT PRIMARY KEY,
    pages_discovered INT DEFAULT 0,
    pages_indexed INT DEFAULT 0,
    crawl_frequency TEXT DEFAULT 'monthly',
    rate_limit_ms INT DEFAULT 1000,
    email_pattern TEXT,
    cms TEXT,
    is_claimed BOOLEAN DEFAULT false,
    meta JSONB DEFAULT '{}',
    last_crawled TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT,
    owner_email TEXT NOT NULL,
    tier TEXT DEFAULT 'free',
    rate_limit_per_day INT DEFAULT 1000,
    queries_today INT DEFAULT 0,
    queries_total BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);
