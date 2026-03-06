import { existsSync } from 'fs';
import { smartFetch, closeBrowser, extractMeta } from '@webdex/crawler';
import { insertPage, insertEntity, query } from '@webdex/database';
import { extractDomain, contentHash } from '@webdex/shared';
import { initLocalModel, disposeModel } from './models/local-model.js';
import { initEmbeddingModel, generateEmbedding } from './models/embedding-model.js';
import { classifyPage } from './pipeline/classify-page.js';
import { extractAllEntities } from './pipeline/extract-entities.js';
import { detectFlows } from './pipeline/detect-flows.js';
import { calculateAieoScore } from './pipeline/score-page.js';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: pnpm interpret <url>');
    process.exit(1);
  }

  console.log(`\n🕷  WebDex Interpreter — Processing: ${url}\n`);

  // Init embedding model (always required)
  await initEmbeddingModel();

  // Init local LLM if available, otherwise rely on cloud escalation in each pipeline step
  const modelPath = process.env.LOCAL_MODEL_PATH;
  const useLocalModel = modelPath && existsSync(modelPath);
  if (useLocalModel) {
    await initLocalModel();
    console.log('✓ Using local model for interpretation');
  } else {
    console.log('ℹ  Local model not found — cloud escalation active (set ESCALATION_API_KEY)');
  }

  // Step 1: Crawl
  console.log('\nStep 1: Crawling...');
  const crawlResult = await smartFetch(url);
  console.log(`  ✓ ${crawlResult.htmlSizeBytes} bytes, ${crawlResult.forms.length} forms, ${crawlResult.links.length} links`);

  // Extract structured metadata (JSON-LD, CMS hints, canonical, etc.)
  const pageMeta = extractMeta(crawlResult.html, url);

  // Step 2: Store page record
  console.log('Step 2: Storing page...');
  const domain = extractDomain(url);
  const hash = contentHash(crawlResult.cleanedDom);

  // We'll update page_type after classification — upsert here first
  const pageId = await insertPage({
    url,
    domain,
    contentHash: hash,
    httpStatus: crawlResult.status,
    requiresJs: crawlResult.requiresJs,
    cmsDetected: pageMeta.cmsHints[0] || undefined,
    meta: {
      title: pageMeta.title,
      description: pageMeta.description,
      canonical: pageMeta.canonical,
      structuredData: pageMeta.structuredData,
      headers: crawlResult.headers,
    },
  });
  console.log(`  ✓ Page stored: ${pageId}`);

  // Step 3: Classify
  console.log('Step 3: Classifying page type...');
  const meta = {
    title: pageMeta.title || crawlResult.html.match(/<title>(.*?)<\/title>/i)?.[1] || '',
    description: pageMeta.description,
    h1: pageMeta.h1,
  };
  const classification = await classifyPage(crawlResult.cleanedDom, url, meta);
  console.log(`  ✓ Type: ${classification.pageType} (confidence: ${classification.confidence})`);

  // Update page record with page type
  await query(
    'UPDATE pages SET page_type = $1, page_type_confidence = $2, updated_at = NOW() WHERE id = $3',
    [classification.pageType, classification.confidence, pageId]
  );

  // Step 4: Detect multi-step flows
  console.log('Step 4: Detecting action flows...');
  const flows = detectFlows(crawlResult, url);
  if (flows.length > 0) {
    console.log(`  ✓ ${flows.length} flow(s) detected: ${flows.map(f => f.name).join(', ')}`);
    await query(
      "UPDATE pages SET meta = meta || $1 WHERE id = $2",
      [JSON.stringify({ flows }), pageId]
    );
  } else {
    console.log('  ✓ No multi-step flows detected');
  }

  // Step 5: Extract entities
  console.log('Step 5: Extracting entities...');
  const entities = await extractAllEntities({
    cleanedDom: crawlResult.cleanedDom,
    url,
    domain,
    pageType: classification.pageType,
    meta,
    confidence: classification.confidence,
  });
  console.log(`  ✓ ${entities.length} entities extracted`);
  for (const entity of entities) {
    console.log(`    - [${entity.category}] ${(entity.data as any).name || (entity.data as any).purpose || 'unnamed'}`);
  }

  // Step 6: Calculate AIEO score
  console.log('Step 6: Scoring...');
  const aieoScore = calculateAieoScore(entities, classification.confidence);
  console.log(`  ✓ AIEO: ${aieoScore.total}/100 (actions: ${aieoScore.actionRichness}, semantic: ${aieoScore.semanticClarity})`);

  // Step 7: Generate embeddings and store entities
  console.log('Step 7: Storing entities...');
  for (const entity of entities) {
    const embedding = await generateEmbedding(entity.searchableText);
    const entityId = await insertEntity({
      ...entity,
      pageId,
      aieoScore: aieoScore.total,
      embedding,
    });
    console.log(`  ✓ Stored ${entity.category}: ${entityId}`);
  }

  console.log(`\n✅ Done! ${entities.length} entities indexed from ${url}`);
  console.log(`   AIEO Score: ${aieoScore.total}/100\n`);

  await closeBrowser();
  if (useLocalModel) await disposeModel();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
