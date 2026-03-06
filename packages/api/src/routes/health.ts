import { Hono } from 'hono';
import { query } from '@webdex/database';

export const healthRoutes = new Hono();

healthRoutes.get('/health', async (c) => {
  const checks: Record<string, any> = { status: 'healthy', version: '0.1.0' };
  try {
    await query('SELECT 1');
    checks.database = 'connected';
  } catch {
    checks.database = 'unavailable';
  }
  try {
    const dbResult = await query('SELECT COUNT(*) as count FROM entities');
    checks.entities = parseInt(dbResult.rows[0].count);
    const pageResult = await query('SELECT COUNT(*) as count FROM pages');
    checks.pages = parseInt(pageResult.rows[0].count);
  } catch {
    checks.entities = 0;
    checks.pages = 0;
  }
  checks.timestamp = new Date().toISOString();
  return c.json(checks, 200);
});
