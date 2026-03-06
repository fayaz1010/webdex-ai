-- Personal index tables for user-submitted URL crawls

CREATE TABLE IF NOT EXISTS personal_indexes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'My Index',
    tier TEXT NOT NULL DEFAULT 'basic',         -- basic ($4.99) or pro ($9.99)
    url_limit INT NOT NULL DEFAULT 100,         -- basic: 100, pro: 500
    urls_indexed INT DEFAULT 0,
    status TEXT DEFAULT 'pending',              -- pending, running, completed, failed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_indexes_user ON personal_indexes(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_indexes_status ON personal_indexes(status);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS personal_index_urls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personal_index_id UUID NOT NULL REFERENCES personal_indexes(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    status TEXT DEFAULT 'pending',              -- pending, crawled, interpreted, failed, skipped
    priority INT DEFAULT 5,
    http_status INT,
    crawled_at TIMESTAMPTZ,
    interpreted_at TIMESTAMPTZ,
    entities_extracted INT DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_urls_index_id ON personal_index_urls(personal_index_id, status);
CREATE INDEX IF NOT EXISTS idx_pi_urls_domain ON personal_index_urls(domain);
CONSTRAINT personal_index_urls_unique UNIQUE (personal_index_id, url);

-- ─────────────────────────────────────────────────────────────────────────────

-- Pipeline operation log — for OpsAgent audit trail
CREATE TABLE IF NOT EXISTS ops_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ts TIMESTAMPTZ DEFAULT NOW(),
    level TEXT NOT NULL DEFAULT 'info',         -- info, warn, error, debug
    component TEXT NOT NULL,                    -- crawler, interpreter, api, scheduler, ops-agent
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    domain TEXT,
    url TEXT
);

CREATE INDEX IF NOT EXISTS idx_ops_log_ts ON ops_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_ops_log_component ON ops_log(component, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ops_log_level ON ops_log(level, ts DESC) WHERE level IN ('warn', 'error');

-- Auto-purge logs older than 30 days via pg cron or app-level cleanup
