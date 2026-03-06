/**
 * WebDex Personal Index
 *
 * Crawls a user's URLs and builds a full personal entity index using the
 * complete interpretation pipeline (classify → extract → score → store).
 * Every page crawled enriches the shared WebDex index for all users.
 *
 * Pricing:
 *   Basic  $4.99  — up to 100 URLs, full entity extraction
 *   Pro    $9.99  — up to 500 URLs, 2-level deep crawl, weekly refresh
 */

import { existsSync } from 'fs';
import { smartFetch, closeBrowser, extractMeta } from '@webdex/crawler';
import { insertPage, insertEntity, query as dbQuery } from '@webdex/database';
import {
  initEmbeddingModel, generateEmbedding,
  initLocalModel,
  classifyPage, extractAllEntities, calculateAieoScore,
} from '@webdex/interpreter';
import { extractDomain, contentHash } from '@webdex/shared';

export interface PersonalIndex {
  id: string;
  userId: string;
  tier: 'basic' | 'pro';
  urls: string[];
  status: 'pending' | 'crawling' | 'interpreting' | 'completed' | 'failed';
  urlsCrawled: number;
  entitiesExtracted: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export async function createPersonalIndex(
  userId: string,
  urls: string[],
  tier: 'basic' | 'pro' = 'basic'
): Promise<string> {
  const maxUrls = tier === 'basic' ? 100 : 500;
  const limitedUrls = urls.slice(0, maxUrls);

  const result = await dbQuery(
    'INSERT INTO personal_indexes (user_id, tier, urls) VALUES ($1, $2, $3) RETURNING id',
    [userId, tier, limitedUrls]
  );
  return result.rows[0].id;
}

export async function processPersonalIndex(indexId: string): Promise<void> {
  const indexResult = await dbQuery('SELECT * FROM personal_indexes WHERE id = $1', [indexId]);
  if (indexResult.rows.length === 0) throw new Error('Personal index not found');

  const pi = indexResult.rows[0];
  const urls: string[] = pi.urls;
  const userId: string = pi.user_id;

  await dbQuery("UPDATE personal_indexes SET status = 'crawling' WHERE id = $1", [indexId]);

  // Init models
  await initEmbeddingModel();
  const modelPath = process.env.LOCAL_MODEL_PATH;
  if (modelPath && existsSync(modelPath)) {
    await initLocalModel();
  }

  let crawled = 0;
  let entitiesTotal = 0;

  for (const url of urls) {
    try {
      // 1. Crawl
      const crawlResult = await smartFetch(url);
      const domain = extractDomain(url);
      const pageMeta = extractMeta(crawlResult.html, url);
      const hash = contentHash(crawlResult.cleanedDom);
      const meta = { title: pageMeta.title, description: pageMeta.description, h1: pageMeta.h1 };

      // 2. Upsert page record
      const pageId = await insertPage({
        url, domain,
        contentHash: hash,
        httpStatus: crawlResult.status,
        requiresJs: crawlResult.requiresJs,
        cmsDetected: pageMeta.cmsHints[0],
        meta: {
          title: pageMeta.title,
          description: pageMeta.description,
          canonical: pageMeta.canonical,
          structuredData: pageMeta.structuredData,
        },
      });

      // 3. Classify
      const classification = await classifyPage(crawlResult.cleanedDom, url, meta);
      await dbQuery(
        'UPDATE pages SET page_type = $1, page_type_confidence = $2, updated_at = NOW() WHERE id = $3',
        [classification.pageType, classification.confidence, pageId]
      );

      // 4. Extract all entity types (not just forms)
      const entities = await extractAllEntities({
        cleanedDom: crawlResult.cleanedDom,
        url, domain,
        pageType: classification.pageType,
        meta,
        confidence: classification.confidence,
      });

      // 5. Score and store
      const aieoScore = calculateAieoScore(entities, classification.confidence);

      for (const entity of entities) {
        const embedding = await generateEmbedding(entity.searchableText);
        const entityId = await insertEntity({
          ...entity,
          pageId,
          aieoScore: aieoScore.total,
          embedding,
        });

        // Link entity to this personal index
        await dbQuery(
          'INSERT INTO personal_entities (personal_index_id, entity_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [indexId, entityId, userId]
        );
        entitiesTotal++;
      }

      crawled++;
      await dbQuery(
        'UPDATE personal_indexes SET urls_crawled = $1, entities_extracted = $2 WHERE id = $3',
        [crawled, entitiesTotal, indexId]
      );

      // Politeness delay
      await new Promise(r => setTimeout(r, 1000));

    } catch (err) {
      console.error(`[personal-index] Failed to process ${url}:`, err);
    }
  }

  await dbQuery(
    "UPDATE personal_indexes SET status = 'completed', completed_at = NOW(), urls_crawled = $1, entities_extracted = $2 WHERE id = $3",
    [crawled, entitiesTotal, indexId]
  );

  await closeBrowser();
}

export async function getUserPersonalEntities(userId: string) {
  return (await dbQuery(
    `SELECT e.* FROM personal_entities pe
     JOIN entities e ON pe.entity_id = e.id
     WHERE pe.user_id = $1
     ORDER BY e.aieo_score DESC`,
    [userId]
  )).rows;
}

export async function getPersonalIndexStatus(indexId: string): Promise<PersonalIndex | null> {
  const result = await dbQuery('SELECT * FROM personal_indexes WHERE id = $1', [indexId]);
  return result.rows[0] || null;
}
