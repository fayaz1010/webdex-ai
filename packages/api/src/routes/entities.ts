import { Hono } from 'hono';
import { query as dbQuery } from '@webdex/database';

export const entityRoutes = new Hono();

entityRoutes.get('/entities/:id', async (c) => {
  const id = c.req.param('id');
  const result = await dbQuery('SELECT * FROM entities WHERE id = $1', [id]);
  if (result.rows.length === 0) return c.json({ error: 'Entity not found' }, 404);

  const entity = result.rows[0];

  // Get relationships
  const rels = await dbQuery(
    `SELECT r.*, e.category, e.data, e.domain
     FROM relationships r
     JOIN entities e ON (r.to_entity_id = e.id OR r.from_entity_id = e.id) AND e.id != $1
     WHERE r.from_entity_id = $1 OR r.to_entity_id = $1
     LIMIT 20`,
    [id]
  );

  return c.json({
    ...entity,
    relationships: rels.rows,
  });
});

entityRoutes.get('/entities', async (c) => {
  const category = c.req.query('category');
  const domain = c.req.query('domain');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 0;

  if (category) { idx++; conditions.push(`category = $${idx}`); values.push(category); }
  if (domain) { idx++; conditions.push(`domain = $${idx}`); values.push(domain); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await dbQuery(
    `SELECT id, category, subcategory, data, domain, confidence, aieo_score, created_at
     FROM entities ${where}
     ORDER BY aieo_score DESC
     LIMIT ${limit} OFFSET ${offset}`,
    values
  );

  const countResult = await dbQuery(`SELECT COUNT(*) as total FROM entities ${where}`, values);

  return c.json({
    total: parseInt(countResult.rows[0].total),
    limit,
    offset,
    results: result.rows,
  });
});
