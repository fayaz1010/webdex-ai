-- Materialized views for fast dashboard queries

CREATE MATERIALIZED VIEW IF NOT EXISTS contacts_view AS
SELECT
    e.id,
    e.domain,
    e.page_id,
    e.confidence,
    e.aieo_score,
    e.searchable_text,
    e.is_verified,
    e.created_at,
    e.updated_at,
    (e.data->>'name') AS name,
    (e.data->>'role') AS role,
    (e.data->>'email') AS email,
    (e.data->>'phone') AS phone,
    (e.data->>'department') AS department,
    (e.data->>'seniority') AS seniority
FROM entities e
WHERE e.category = 'contact'
  AND e.confidence > 0.5;

CREATE INDEX ON contacts_view(domain);
CREATE INDEX ON contacts_view(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX ON contacts_view(id);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS organisations_view AS
SELECT
    e.id,
    e.domain,
    e.page_id,
    e.confidence,
    e.aieo_score,
    e.searchable_text,
    e.is_verified,
    e.created_at,
    e.updated_at,
    (e.data->>'name') AS name,
    (e.data->>'type') AS org_type,
    (e.data->>'industry') AS industry,
    (e.data->>'address') AS address,
    (e.data->>'phone') AS phone,
    (e.data->>'website') AS website,
    (e.data->>'abn') AS abn,
    (e.data->'serviceArea') AS service_area,
    (e.data->'accreditations') AS accreditations
FROM entities e
WHERE e.category = 'organisation'
  AND e.confidence > 0.5;

CREATE INDEX ON organisations_view(domain);
CREATE INDEX ON organisations_view(industry);
CREATE UNIQUE INDEX ON organisations_view(id);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS products_view AS
SELECT
    e.id,
    e.domain,
    e.page_id,
    e.confidence,
    e.aieo_score,
    e.searchable_text,
    e.is_verified,
    e.created_at,
    e.updated_at,
    (e.data->>'name') AS name,
    (e.data->>'provider') AS provider,
    (e.data->>'productType') AS product_type,
    (e.data->'price'->>'amount')::FLOAT AS price_amount,
    (e.data->'price'->>'currency') AS price_currency,
    (e.data->'price'->>'qualifier') AS price_qualifier,
    (e.data->'rating'->>'score')::FLOAT AS rating_score,
    (e.data->'rating'->>'count')::INT AS rating_count
FROM entities e
WHERE e.category = 'product'
  AND e.confidence > 0.5;

CREATE INDEX ON products_view(domain);
CREATE INDEX ON products_view(product_type);
CREATE INDEX ON products_view(price_amount) WHERE price_amount IS NOT NULL;
CREATE UNIQUE INDEX ON products_view(id);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS actions_view AS
SELECT
    e.id,
    e.domain,
    e.page_id,
    e.confidence,
    e.aieo_score,
    e.searchable_text,
    e.is_verified,
    e.created_at,
    e.updated_at,
    (e.data->>'type') AS action_type,
    (e.data->>'purpose') AS purpose,
    (e.data->>'endpoint') AS endpoint,
    (e.data->>'method') AS method,
    (e.data->'fields') AS fields,
    (e.data->>'submitLabel') AS submit_label
FROM entities e
WHERE e.category = 'action'
  AND e.confidence > 0.5;

CREATE INDEX ON actions_view(domain);
CREATE INDEX ON actions_view(action_type);
CREATE UNIQUE INDEX ON actions_view(id);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS domain_summary AS
SELECT
    e.domain,
    COUNT(*) AS total_entities,
    COUNT(*) FILTER (WHERE e.category = 'contact') AS contacts,
    COUNT(*) FILTER (WHERE e.category = 'organisation') AS organisations,
    COUNT(*) FILTER (WHERE e.category = 'product') AS products,
    COUNT(*) FILTER (WHERE e.category = 'action') AS actions,
    COUNT(*) FILTER (WHERE e.category = 'location') AS locations,
    AVG(e.aieo_score) AS avg_aieo_score,
    MAX(e.updated_at) AS last_entity_update
FROM entities e
GROUP BY e.domain;

CREATE UNIQUE INDEX ON domain_summary(domain);

-- Function to refresh all materialized views (run periodically)
CREATE OR REPLACE FUNCTION refresh_all_views() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY contacts_view;
    REFRESH MATERIALIZED VIEW CONCURRENTLY organisations_view;
    REFRESH MATERIALIZED VIEW CONCURRENTLY products_view;
    REFRESH MATERIALIZED VIEW CONCURRENTLY actions_view;
    REFRESH MATERIALIZED VIEW CONCURRENTLY domain_summary;
END;
$$ LANGUAGE plpgsql;
