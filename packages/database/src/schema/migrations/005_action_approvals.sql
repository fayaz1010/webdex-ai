-- Action submission tracking + trust/approval system
-- An action must be approved by a human at least twice before it becomes "trusted"
-- and can execute hands-free.

CREATE TABLE IF NOT EXISTS action_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    -- Who requested this submission
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    user_ref TEXT,                              -- optional caller identifier
    -- What was submitted
    submitted_data JSONB NOT NULL DEFAULT '{}',
    -- Approval state
    status TEXT NOT NULL DEFAULT 'pending_approval',
    -- pending_approval | approved | rejected | executed | failed | skipped
    approval_token TEXT UNIQUE,                -- short-lived token for approval URL
    approval_token_expires_at TIMESTAMPTZ,
    approved_by TEXT,                          -- who approved (user ref or 'auto')
    approved_at TIMESTAMPTZ,
    -- Execution result
    executed_at TIMESTAMPTZ,
    http_status INT,
    response_preview TEXT,
    success BOOLEAN,
    failure_reason TEXT,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_subs_action_id ON action_submissions(action_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_subs_status ON action_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_subs_token ON action_submissions(approval_token) WHERE approval_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_subs_domain ON action_submissions(domain, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trust level view — computed from submission history
-- An action is "trusted" when it has ≥2 successful, human-approved submissions.

CREATE OR REPLACE VIEW action_trust_levels AS
SELECT
    action_id,
    domain,
    COUNT(*)                                                AS total_attempts,
    COUNT(*) FILTER (WHERE success = true)                  AS successful_count,
    COUNT(*) FILTER (WHERE status = 'approved' AND success = true) AS approved_successes,
    MAX(executed_at)                                        AS last_executed_at,
    CASE
        WHEN COUNT(*) FILTER (WHERE status = 'approved' AND success = true) >= 2
        THEN 'trusted'
        WHEN COUNT(*) FILTER (WHERE status = 'approved' AND success = true) = 1
        THEN 'provisionally_trusted'
        ELSE 'requires_approval'
    END AS trust_level
FROM action_submissions
GROUP BY action_id, domain;

-- ─────────────────────────────────────────────────────────────────────────────
-- Domain-level action trust (aggregated across all actions on a domain)

CREATE OR REPLACE VIEW domain_action_trust AS
SELECT
    domain,
    COUNT(DISTINCT action_id)                   AS total_actions,
    COUNT(DISTINCT action_id) FILTER (
        WHERE action_id IN (
            SELECT action_id FROM action_trust_levels WHERE trust_level = 'trusted'
        )
    )                                           AS trusted_actions,
    ROUND(
        100.0 * COUNT(DISTINCT action_id) FILTER (
            WHERE action_id IN (
                SELECT action_id FROM action_trust_levels WHERE trust_level = 'trusted'
            )
        ) / NULLIF(COUNT(DISTINCT action_id), 0), 1
    )                                           AS trust_pct,
    SUM(successful_count)                       AS total_successes,
    SUM(total_attempts)                         AS total_attempts
FROM action_trust_levels
GROUP BY domain;
