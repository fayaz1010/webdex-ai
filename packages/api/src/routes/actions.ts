import { Hono } from 'hono';
import { query as dbQuery } from '@webdex/database';
import { randomBytes } from 'crypto';

export const actionRoutes = new Hono();

const APPROVAL_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TRUST_THRESHOLD = 2;  // approved successes needed before hands-free

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateApprovalToken(): string {
  return randomBytes(16).toString('hex');
}

async function getActionTrustLevel(actionId: string): Promise<'trusted' | 'provisionally_trusted' | 'requires_approval'> {
  const result = await dbQuery(
    "SELECT trust_level FROM action_trust_levels WHERE action_id = $1",
    [actionId]
  );
  return (result.rows[0]?.trust_level as any) || 'requires_approval';
}

async function executeAction(
  actionData: any,
  domain: string,
  formData: Record<string, string>
): Promise<{ success: boolean; status: number; responsePreview: string; error?: string }> {
  const endpoint = actionData.endpoint;
  if (!endpoint) {
    return { success: false, status: 0, responsePreview: '', error: 'No endpoint mapped for this action' };
  }

  const fullUrl = endpoint.startsWith('http') ? endpoint : `https://${domain}${endpoint}`;
  const merged = { ...(actionData.hiddenFields || {}), ...formData };
  const isJson = actionData.contentType?.includes('json');

  try {
    const response = await fetch(fullUrl, {
      method: actionData.method || 'POST',
      headers: {
        'Content-Type': actionData.contentType || 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `https://${domain}/`,
        'Origin': `https://${domain}`,
      },
      body: isJson ? JSON.stringify(merged) : new URLSearchParams(merged).toString(),
      signal: AbortSignal.timeout(30_000),
    });

    const responseText = await response.text().catch(() => '');
    return {
      success: response.ok,
      status: response.status,
      responsePreview: responseText.slice(0, 300),
    };
  } catch (err) {
    return { success: false, status: 0, responsePreview: '', error: String(err) };
  }
}

// ── GET /v1/forms/:id ─────────────────────────────────────────────────────────
actionRoutes.get('/forms/:id', async (c) => {
  const id = c.req.param('id');
  const result = await dbQuery(
    "SELECT id, domain, data, confidence, aieo_score FROM entities WHERE id = $1 AND category = 'action'",
    [id]
  );
  if (result.rows.length === 0) return c.json({ error: 'Action not found' }, 404);

  const row = result.rows[0];
  const trust = await getActionTrustLevel(id);

  return c.json({
    id: row.id,
    domain: row.domain,
    confidence: row.confidence,
    aieo_score: row.aieo_score,
    trust_level: trust,
    action: row.data,
  });
});

// ── POST /v1/actions/execute ──────────────────────────────────────────────────
// Returns immediately with approval_required for untrusted actions,
// or executes directly for trusted ones.
actionRoutes.post('/actions/execute', async (c) => {
  const body = await c.req.json();
  const { action_id, data: formData = {}, force_approval = false } = body;

  if (!action_id) return c.json({ error: 'action_id is required' }, 400);

  const result = await dbQuery(
    "SELECT * FROM entities WHERE id = $1 AND category = 'action'",
    [action_id]
  );
  if (result.rows.length === 0) return c.json({ error: 'Action not found' }, 404);

  const entity = result.rows[0];
  const actionData = entity.data;
  const apiKeyId = ((c as any).get('apiKey'))?.id || null;
  const trust = await getActionTrustLevel(action_id);

  // ── TRUSTED: execute hands-free ──────────────────────────────────────────
  if (trust === 'trusted' && !force_approval) {
    const exec = await executeAction(actionData, entity.domain, formData);

    // Record this execution
    await dbQuery(
      `INSERT INTO action_submissions
         (action_id, domain, api_key_id, submitted_data, status, approved_by,
          approved_at, executed_at, http_status, response_preview, success, failure_reason)
       VALUES ($1,$2,$3,$4,'executed','auto',NOW(),NOW(),$5,$6,$7,$8)`,
      [action_id, entity.domain, apiKeyId, JSON.stringify(formData),
       exec.status, exec.responsePreview, exec.success, exec.error || null]
    );

    return c.json({
      status: 'executed',
      hands_free: true,
      trust_level: trust,
      success: exec.success,
      http_status: exec.status,
      endpoint: actionData.endpoint,
      note: exec.success
        ? 'Executed hands-free — this action has been approved and succeeded multiple times.'
        : 'Hands-free execution failed. Site may have changed. Consider re-crawling.',
      response_preview: exec.responsePreview,
      error: exec.error,
    });
  }

  // ── APPROVAL REQUIRED ────────────────────────────────────────────────────
  const token = generateApprovalToken();
  const expiresAt = new Date(Date.now() + APPROVAL_TOKEN_TTL_MS);

  const subResult = await dbQuery(
    `INSERT INTO action_submissions
       (action_id, domain, api_key_id, submitted_data, status,
        approval_token, approval_token_expires_at)
     VALUES ($1,$2,$3,$4,'pending_approval',$5,$6)
     RETURNING id`,
    [action_id, entity.domain, apiKeyId, JSON.stringify(formData), token, expiresAt]
  );
  const submissionId = subResult.rows[0].id;

  const trustMessages: Record<string, string> = {
    requires_approval: 'This action has not been approved before and requires human approval.',
    provisionally_trusted: 'This action has been approved once. One more successful approval will make it hands-free.',
  };

  return c.json({
    status: 'approval_required',
    submission_id: submissionId,
    approval_token: token,
    approval_expires_at: expiresAt,
    trust_level: trust,
    approvals_needed_for_handsfree: TRUST_THRESHOLD,
    message: trustMessages[trust] || 'Approval required.',
    action_summary: {
      domain: entity.domain,
      purpose: actionData.purpose,
      endpoint: actionData.endpoint,
      method: actionData.method || 'POST',
      fields_to_submit: Object.keys(formData),
    },
    approve_url: `/v1/actions/approve/${token}`,
    reject_url: `/v1/actions/reject/${token}`,
  }, 202);
});

// ── POST /v1/actions/approve/:token ──────────────────────────────────────────
actionRoutes.post('/actions/approve/:token', async (c) => {
  const token = c.req.param('token');
  const body = await c.req.json().catch(() => ({})) as any;
  const approvedBy = body.approved_by || 'user';

  const subResult = await dbQuery(
    "SELECT * FROM action_submissions WHERE approval_token = $1 AND status = 'pending_approval'",
    [token]
  );
  if (subResult.rows.length === 0) {
    return c.json({ error: 'Approval token not found, already used, or expired' }, 404);
  }

  const sub = subResult.rows[0];
  if (new Date(sub.approval_token_expires_at) < new Date()) {
    return c.json({ error: 'Approval token has expired' }, 410);
  }

  // Fetch the action entity
  const entityResult = await dbQuery(
    "SELECT * FROM entities WHERE id = $1",
    [sub.action_id]
  );
  if (entityResult.rows.length === 0) {
    return c.json({ error: 'Action entity no longer exists' }, 404);
  }

  const entity = entityResult.rows[0];
  const formData = sub.submitted_data as Record<string, string>;

  // Execute the action
  const exec = await executeAction(entity.data, entity.domain, formData);

  // Record result
  await dbQuery(
    `UPDATE action_submissions SET
       status = $1, approved_by = $2, approved_at = NOW(),
       executed_at = NOW(), http_status = $3, response_preview = $4,
       success = $5, failure_reason = $6, updated_at = NOW()
     WHERE id = $7`,
    [
      exec.success ? 'executed' : 'failed',
      approvedBy,
      exec.status,
      exec.responsePreview,
      exec.success,
      exec.error || null,
      sub.id,
    ]
  );

  // Check updated trust level
  const trust = await getActionTrustLevel(sub.action_id);

  return c.json({
    status: exec.success ? 'executed' : 'failed',
    submission_id: sub.id,
    success: exec.success,
    http_status: exec.status,
    trust_level: trust,
    hands_free_unlocked: trust === 'trusted',
    message: exec.success
      ? trust === 'trusted'
        ? '✓ Form submitted successfully. This action is now trusted — future submissions will run hands-free.'
        : trust === 'provisionally_trusted'
          ? '✓ Form submitted successfully. One more approved success will unlock hands-free mode.'
          : '✓ Form submitted successfully.'
      : `Submission failed (HTTP ${exec.status}). The site may require a session or CAPTCHA. Consider Playwright-based submission.`,
    response_preview: exec.responsePreview,
    error: exec.error,
  });
});

// ── POST /v1/actions/reject/:token ────────────────────────────────────────────
actionRoutes.post('/actions/reject/:token', async (c) => {
  const token = c.req.param('token');
  const body = await c.req.json().catch(() => ({})) as any;

  const result = await dbQuery(
    "UPDATE action_submissions SET status = 'rejected', updated_at = NOW() WHERE approval_token = $1 AND status = 'pending_approval' RETURNING id",
    [token]
  );
  if (result.rows.length === 0) {
    return c.json({ error: 'Token not found or already processed' }, 404);
  }

  return c.json({
    status: 'rejected',
    submission_id: result.rows[0].id,
    message: body.reason ? `Submission rejected: ${body.reason}` : 'Submission rejected.',
  });
});

// ── GET /v1/actions/status/:submission_id ─────────────────────────────────────
actionRoutes.get('/actions/status/:id', async (c) => {
  const id = c.req.param('id');
  const result = await dbQuery(
    'SELECT id, action_id, domain, status, success, http_status, created_at, executed_at, trust_level_at_execution FROM action_submissions WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return c.json({ error: 'Submission not found' }, 404);
  return c.json(result.rows[0]);
});

// ── GET /v1/actions/trust/:action_id ──────────────────────────────────────────
actionRoutes.get('/actions/trust/:action_id', async (c) => {
  const id = c.req.param('action_id');
  const result = await dbQuery(
    'SELECT * FROM action_trust_levels WHERE action_id = $1',
    [id]
  );
  return c.json(result.rows[0] || { action_id: id, trust_level: 'requires_approval', total_attempts: 0 });
});
