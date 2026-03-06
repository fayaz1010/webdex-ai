import { Hono } from 'hono';
import { query as dbQuery } from '@webdex/database';

export const assembleRoutes = new Hono();

// Cross-category assembly endpoint
assembleRoutes.post('/assemble', async (c) => {
  const body = await c.req.json();
  const { categories, domain, location, include_relationships, limit } = body;

  const startTime = Date.now();

  // Query entities matching criteria
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 0;

  if (categories && categories.length > 0) {
    idx++;
    conditions.push(`category = ANY($${idx})`);
    values.push(categories);
  }

  if (domain) {
    idx++;
    conditions.push(`domain = $${idx}`);
    values.push(domain);
  }

  if (location) {
    idx++;
    conditions.push(`searchable_text ILIKE $${idx}`);
    values.push(`%${location}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const maxResults = Math.min(limit || 100, 500);

  const result = await dbQuery(
    `SELECT * FROM entities ${where} ORDER BY aieo_score DESC, confidence DESC LIMIT ${maxResults}`,
    values
  );

  // Group by category
  const grouped: Record<string, unknown[]> = {};
  for (const row of result.rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push({
      id: row.id,
      data: row.data,
      domain: row.domain,
      confidence: row.confidence,
      aieo_score: row.aieo_score,
    });
  }

  // If include_relationships, fetch relationship data
  let relationships: unknown[] = [];
  if (include_relationships && result.rows.length > 0) {
    const entityIds = result.rows.map((r: any) => r.id);
    const relResult = await dbQuery(
      `SELECT * FROM relationships
       WHERE from_entity_id = ANY($1) OR to_entity_id = ANY($1)
       LIMIT 1000`,
      [entityIds]
    );
    relationships = relResult.rows;
  }

  const latencyMs = Date.now() - startTime;

  return c.json({
    query: body,
    total_entities: result.rows.length,
    latency_ms: latencyMs,
    categories: grouped,
    relationships: include_relationships ? relationships : undefined,
  });
});
