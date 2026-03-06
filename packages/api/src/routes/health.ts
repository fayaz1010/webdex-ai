import { Hono } from 'hono';
import { query } from '@webdex/database';

export const healthRoutes = new Hono();

healthRoutes.get('/health', async (c) => {
  try {
    const dbResult = await query('SELECT COUNT(*) as count FROM entities');
    const entityCount = parseInt(dbResult.rows[0].count);
    const pageResult = await query('SELECT COUNT(*) as count FROM pages');
    const pageCount = parseInt(pageResult.rows[0].count);

    return c.json({
      status: 'healthy',
      version: '0.1.0',
      index: { entities: entityCount, pages: pageCount },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({ status: 'unhealthy', error: String(error) }, 500);
  }
});
