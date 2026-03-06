import { type Context, type Next } from 'hono';
import { createHash } from 'crypto';
import { query } from '@webdex/database';

export async function apiKeyAuth(c: Context, next: Next) {
  const path = c.req.path;
  if (path === '/health' || path === '/') return next();

  const apiKey = c.req.header('X-API-Key') || c.req.query('api_key');
  if (!apiKey) return c.json({ error: 'API key required. Pass via X-API-Key header or api_key query param.' }, 401);

  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  const result = await query('SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true', [keyHash]);

  if (result.rows.length === 0) return c.json({ error: 'Invalid API key' }, 401);

  const key = result.rows[0];
  if (key.queries_today >= key.rate_limit_per_day) {
    return c.json({ error: 'Rate limit exceeded', limit: key.rate_limit_per_day, reset: 'midnight UTC' }, 429);
  }

  await query('UPDATE api_keys SET queries_today = queries_today + 1, queries_total = queries_total + 1, last_used_at = NOW() WHERE id = $1', [key.id]);
  c.set('apiKey', key);
  return next();
}
