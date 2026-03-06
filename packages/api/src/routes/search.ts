import { Hono } from 'hono';
import { searchEntities } from '@webdex/database';
import { generateEmbedding, initEmbeddingModel } from '@webdex/interpreter';
import type { EntityCategory } from '@webdex/shared';

export const searchRoutes = new Hono();

let embeddingReady = false;

searchRoutes.get('/search', async (c) => {
  const q = c.req.query('q') || '';
  const category = c.req.query('category') as EntityCategory | undefined;
  const domain = c.req.query('domain');
  const limit = parseInt(c.req.query('limit') || '20');
  const useVector = c.req.query('semantic') !== 'false';

  if (!q) return c.json({ error: 'Query parameter "q" is required' }, 400);

  const startTime = Date.now();

  // Generate embedding for semantic search
  let embedding: number[] | undefined;
  if (useVector) {
    if (!embeddingReady) {
      await initEmbeddingModel();
      embeddingReady = true;
    }
    embedding = await generateEmbedding(q);
  }

  const results = await searchEntities({ query: q, category, domain, embedding, limit });
  const latencyMs = Date.now() - startTime;

  return c.json({
    query: q,
    filters: { category, domain },
    total: results.length,
    latency_ms: latencyMs,
    results: results.map((r: any) => ({
      id: r.id,
      category: r.category,
      subcategory: r.subcategory,
      data: r.data,
      domain: r.domain,
      confidence: r.confidence,
      aieo_score: r.aieo_score,
      vector_similarity: r.vector_similarity || null,
      created_at: r.created_at,
    })),
  });
});
