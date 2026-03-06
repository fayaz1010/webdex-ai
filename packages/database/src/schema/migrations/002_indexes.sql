-- Additional indexes for query performance

-- Partial indexes for active/recent records
CREATE INDEX IF NOT EXISTS idx_entities_category_domain ON entities(category, domain);
CREATE INDEX IF NOT EXISTS idx_entities_aieo_score ON entities(aieo_score DESC) WHERE aieo_score > 0;
CREATE INDEX IF NOT EXISTS idx_entities_confidence ON entities(confidence DESC) WHERE confidence > 0.5;
CREATE INDEX IF NOT EXISTS idx_entities_verified ON entities(is_verified) WHERE is_verified = true;
CREATE INDEX IF NOT EXISTS idx_entities_updated ON entities(updated_at DESC);

-- Trigram index for fuzzy text search on entity data fields
CREATE INDEX IF NOT EXISTS idx_entities_data_trgm ON entities USING gin((data::text) gin_trgm_ops);

-- Pages indexes
CREATE INDEX IF NOT EXISTS idx_pages_last_crawled ON pages(last_crawled DESC);
CREATE INDEX IF NOT EXISTS idx_pages_crawl_frequency ON pages(crawl_frequency, last_crawled);
CREATE INDEX IF NOT EXISTS idx_pages_requires_js ON pages(requires_js) WHERE requires_js = true;

-- Domain profiles
CREATE INDEX IF NOT EXISTS idx_domain_profiles_last_crawled ON domain_profiles(last_crawled DESC NULLS LAST);

-- API keys
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active, owner_email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_tier ON api_keys(tier) WHERE is_active = true;

-- Relationships
CREATE UNIQUE INDEX IF NOT EXISTS idx_rel_unique ON relationships(from_entity_id, to_entity_id, relationship_type);
