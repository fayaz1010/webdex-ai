/**
 * Full Solar Perth Seed Crawl
 * 
 * Crawls all seed URLs, interprets with AI, stores entities.
 * Run with: tsx scripts/run-full-crawl.ts
 */
import { getAllSeedUrls, smartFetch, closeBrowser } from '@webdex/crawler';
import { insertPage, insertEntity } from '@webdex/database';
import { initEmbeddingModel, generateEmbedding } from '@webdex/interpreter';
import { extractDomain, contentHash } from '@webdex/shared';

async function runFullCrawl() {
  const seeds = getAllSeedUrls();
  console.log(`\n🕷  WebDex Full Crawl — ${seeds.length} seed URLs\n`);

  await initEmbeddingModel();

  let success = 0;
  let failed = 0;

  for (const url of seeds) {
    try {
      console.log(`\n📄 Crawling: ${url}`);
      const result = await smartFetch(url);

      const domain = extractDomain(url);
      const hash = contentHash(result.cleanedDom);

      const pageId = await insertPage({
        url,
        domain,
        contentHash: hash,
        httpStatus: result.status,
        requiresJs: result.requiresJs,
      });

      console.log(`  ✓ Page stored (${result.forms.length} forms, ${result.links.length} links, ${result.images.length} images)`);

      // Store form actions as entities
      for (const form of result.forms) {
        if (form.fields.length === 0) continue;
        const searchText = `form ${form.method} ${form.action} on ${domain}`;
        const embedding = await generateEmbedding(searchText);
        await insertEntity({
          category: 'action',
          data: {
            type: 'form_submit',
            purpose: 'general_form',
            endpoint: form.action,
            method: form.method,
            fields: form.fields,
            submitLabel: form.submitLabel,
          },
          domain,
          pageId,
          confidence: 0.9,
          searchableText: searchText,
          embedding,
        });
      }

      // Discover internal links for further crawling
      const internalLinks = result.links
        .filter(l => !l.isExternal && l.href.startsWith('http'))
        .map(l => l.href)
        .slice(0, 20);

      console.log(`  ✓ Found ${internalLinks.length} internal links for future crawling`);

      success++;

      // Politeness delay
      await new Promise(r => setTimeout(r, 1500));

    } catch (error) {
      console.error(`  ✗ Failed: ${error}`);
      failed++;
    }
  }

  await closeBrowser();
  console.log(`\n═══════════════════════`);
  console.log(`✅ Crawl complete: ${success} success, ${failed} failed`);
  console.log(`Total seed URLs: ${seeds.length}`);
}

runFullCrawl().catch(console.error);
