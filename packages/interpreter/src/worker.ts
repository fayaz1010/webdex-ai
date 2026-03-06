/**
 * WebDex Crawl Worker
 *
 * Long-running process that consumes jobs from the BullMQ crawl queue and runs
 * the full pipeline: fetch → meta → classify → detect-flows → extract → score → store.
 *
 * Start with:  pnpm --filter @webdex/interpreter worker
 * Production:  docker-compose.prod.yml  (interpreter service)
 */

import { existsSync } from 'fs';
import { smartFetch, closeBrowser, extractMeta, createCrawlWorker, getQueueStats } from '@webdex/crawler';
import { insertPage, insertEntity, query } from '@webdex/database';
import { extractDomain, contentHash } from '@webdex/shared';
import { initLocalModel, disposeModel } from './models/local-model.js';
import { initEmbeddingModel, generateEmbedding } from './models/embedding-model.js';
import { classifyPage } from './pipeline/classify-page.js';
import { extractAllEntities } from './pipeline/extract-entities.js';
import { detectFlows } from './pipeline/detect-flows.js';
import { calculateAieoScore } from './pipeline/score-page.js';
import type { Job } from 'bullmq';
import type { CrawlJobData } from '@webdex/crawler';

let modelsReady = false;

async function initModels() {
  if (modelsReady) return;
  await initEmbeddingModel();
  const modelPath = process.env.LOCAL_MODEL_PATH;
  if (modelPath && existsSync(modelPath)) {
    await initLocalModel();
    console.log('[worker] Local LLM loaded');
  } else {
    console.log('[worker] No local model — cloud escalation active');
  }
  modelsReady = true;
}

async function processJob(job: Job<CrawlJobData>): Promise<void> {
  const { url, domain: jobDomain } = job.data;
  const domain = jobDomain || extractDomain(url);
  console.log(`[worker] ▶ ${url}`);

  await initModels();

  // 1. Crawl
  const crawlResult = await smartFetch(url);
  await job.updateProgress(20);

  // 2. Extract structured page metadata (JSON-LD, CMS, canonical)
  const pageMeta = extractMeta(crawlResult.html, url);
  const meta = { title: pageMeta.title, description: pageMeta.description, h1: pageMeta.h1 };

  // 3. Upsert page record
  const hash = contentHash(crawlResult.cleanedDom);
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
      headers: crawlResult.headers,
    },
  });
  await job.updateProgress(35);

  // 4. Classify page type
  const classification = await classifyPage(crawlResult.cleanedDom, url, meta);
  await query(
    'UPDATE pages SET page_type = $1, page_type_confidence = $2, updated_at = NOW() WHERE id = $3',
    [classification.pageType, classification.confidence, pageId]
  );
  await job.updateProgress(50);

  // 5. Detect multi-step action flows
  const flows = detectFlows(crawlResult, url);
  if (flows.length > 0) {
    await query("UPDATE pages SET meta = meta || $1 WHERE id = $2", [JSON.stringify({ flows }), pageId]);
  }
  await job.updateProgress(60);

  // 6. Extract entities
  const entities = await extractAllEntities({
    cleanedDom: crawlResult.cleanedDom,
    url, domain,
    pageType: classification.pageType,
    meta,
    confidence: classification.confidence,
  });
  await job.updateProgress(80);

  // 7. Score and store
  const aieoScore = calculateAieoScore(entities, classification.confidence);

  for (const entity of entities) {
    const embedding = await generateEmbedding(entity.searchableText);
    await insertEntity({ ...entity, pageId, aieoScore: aieoScore.total, embedding });
  }
  await job.updateProgress(100);

  console.log(
    `[worker] ✓ ${url} | ${classification.pageType} (${(classification.confidence * 100).toFixed(0)}%) | ` +
    `${entities.length} entities | AIEO ${aieoScore.total}/100`
  );
}

async function main() {
  console.log('[worker] WebDex Crawl Worker starting...');

  let worker: ReturnType<typeof createCrawlWorker> | null = null;
  try {
    worker = createCrawlWorker(processJob);
    worker.on('completed', job => console.log(`[worker] Job ${job.id} done`));
    worker.on('failed', (job, err) => console.error(`[worker] Job ${job?.id} failed:`, err.message));
    worker.on('error', err => console.error('[worker] Error:', err.message));
  } catch (err) {
    console.warn(`[worker] Could not connect to Redis: ${err}. Worker will idle until Redis is available.`);
    await new Promise(() => {});
    return;
  }

  setInterval(async () => {
    try {
      const s = await getQueueStats();
      console.log(`[worker] Queue: waiting=${s.waiting} active=${s.active} done=${s.completed} failed=${s.failed}`);
    } catch {}
  }, 30_000);

  const shutdown = async () => {
    console.log('[worker] Shutting down...');
    if (worker) await worker.close();
    await closeBrowser();
    await disposeModel();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('[worker] Ready - listening for crawl jobs');
}

main().catch(err => { console.error('[worker] Fatal:', err); process.exit(1); });
