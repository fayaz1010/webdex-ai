import { query } from '../client.js';
import type { Entity, EntityCategory } from '@webdex/shared';

export async function insertEntity(entity: Entity): Promise<string> {
  const result = await query(
    `INSERT INTO entities
       (category, subcategory, data, domain, page_id, confidence, aieo_score, searchable_text, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      entity.category,
      entity.subcategory ?? null,
      JSON.stringify(entity.data),
      entity.domain,
      entity.pageId ?? null,
      entity.confidence,
      entity.aieoScore ?? 0,
      entity.searchableText,
      entity.embedding ? JSON.stringify(entity.embedding) : null,
    ]
  );
  return result.rows[0].id;
}

export async function updateEntityAieoScore(entityId: string, aieoScore: number): Promise<void> {
  await query(
    'UPDATE entities SET aieo_score = $1, updated_at = NOW() WHERE id = $2',
    [aieoScore, entityId]
  );
}

export async function searchEntities(params: {
  query?: string;
  category?: EntityCategory;
  domain?: string;
  embedding?: number[];
  limit?: number;
  minConfidence?: number;
}) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 0;

  if (params.category) {
    paramIdx++;
    conditions.push(`category = $${paramIdx}`);
    values.push(params.category);
  }

  if (params.domain) {
    paramIdx++;
    conditions.push(`domain = $${paramIdx}`);
    values.push(params.domain);
  }

  if (params.minConfidence !== undefined) {
    paramIdx++;
    conditions.push(`confidence >= $${paramIdx}`);
    values.push(params.minConfidence);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit || 20;

  // Hybrid search: vector similarity + full-text, ranked by RRF (Reciprocal Rank Fusion)
  if (params.embedding && params.query) {
    paramIdx++;
    const embParam = `$${paramIdx}`;
    values.push(JSON.stringify(params.embedding));

    paramIdx++;
    const tsParam = `$${paramIdx}`;
    values.push(params.query);

    const sql = `
      WITH vector_ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (ORDER BY embedding <=> ${embParam}::vector) AS rank
        FROM entities
        ${where}
        LIMIT ${limit * 3}
      ),
      text_ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', searchable_text), plainto_tsquery('english', ${tsParam})) DESC) AS rank
        FROM entities
        ${where.replace('WHERE', 'WHERE') || 'WHERE '}
        ${where ? 'AND' : 'WHERE'} to_tsvector('english', searchable_text) @@ plainto_tsquery('english', ${tsParam})
        LIMIT ${limit * 3}
      )
      SELECT e.*,
             1 - (e.embedding <=> ${embParam}::vector) AS vector_similarity,
             COALESCE(1.0 / (60 + vr.rank), 0) + COALESCE(1.0 / (60 + tr.rank), 0) AS rrf_score
      FROM entities e
      LEFT JOIN vector_ranked vr ON e.id = vr.id
      LEFT JOIN text_ranked tr ON e.id = tr.id
      ${where}
      ${where ? 'AND' : 'WHERE'} (vr.id IS NOT NULL OR tr.id IS NOT NULL)
      ORDER BY rrf_score DESC
      LIMIT ${limit}
    `;
    return (await query(sql, values)).rows;
  }

  // Vector-only search
  if (params.embedding) {
    paramIdx++;
    const embParam = `$${paramIdx}`;
    values.push(JSON.stringify(params.embedding));

    const sql = `
      SELECT *, 1 - (embedding <=> ${embParam}::vector) AS vector_similarity
      FROM entities
      ${where}
      ORDER BY embedding <=> ${embParam}::vector
      LIMIT ${limit}
    `;
    return (await query(sql, values)).rows;
  }

  // Full-text only
  if (params.query) {
    paramIdx++;
    const tsParam = `$${paramIdx}`;
    values.push(params.query);
    const textCondition = `to_tsvector('english', searchable_text) @@ plainto_tsquery('english', ${tsParam})`;
    const textWhere = conditions.length > 0
      ? `${where} AND ${textCondition}`
      : `WHERE ${textCondition}`;

    const sql = `
      SELECT *, ts_rank(to_tsvector('english', searchable_text), plainto_tsquery('english', ${tsParam})) AS text_rank
      FROM entities
      ${textWhere}
      ORDER BY text_rank DESC, aieo_score DESC
      LIMIT ${limit}
    `;
    return (await query(sql, values)).rows;
  }

  // Browse (no query — return top by AIEO score)
  const sql = `SELECT * FROM entities ${where} ORDER BY aieo_score DESC, confidence DESC LIMIT ${limit}`;
  return (await query(sql, values)).rows;
}

export async function insertPage(page: {
  url: string;
  domain: string;
  contentHash?: string;
  pageType?: string;
  pageTypeConfidence?: number;
  httpStatus?: number;
  requiresJs?: boolean;
  cmsDetected?: string;
  meta?: Record<string, unknown>;
}): Promise<string> {
  const result = await query(
    `INSERT INTO pages
       (url, domain, content_hash, page_type, page_type_confidence, http_status,
        requires_js, cms_detected, meta, last_crawled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (url) DO UPDATE SET
       content_hash        = EXCLUDED.content_hash,
       page_type           = COALESCE(EXCLUDED.page_type, pages.page_type),
       page_type_confidence= COALESCE(EXCLUDED.page_type_confidence, pages.page_type_confidence),
       http_status         = EXCLUDED.http_status,
       requires_js         = EXCLUDED.requires_js,
       cms_detected        = COALESCE(EXCLUDED.cms_detected, pages.cms_detected),
       meta                = pages.meta || EXCLUDED.meta,
       last_crawled        = NOW(),
       version             = pages.version + 1,
       updated_at          = NOW()
     RETURNING id`,
    [
      page.url,
      page.domain,
      page.contentHash ?? null,
      page.pageType ?? null,
      page.pageTypeConfidence ?? null,
      page.httpStatus ?? null,
      page.requiresJs ?? false,
      page.cmsDetected ?? null,
      JSON.stringify(page.meta ?? {}),
    ]
  );
  return result.rows[0].id;
}
