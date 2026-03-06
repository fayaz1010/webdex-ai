/**
 * Accuracy Evaluation Script
 * 
 * Compares local model entity extraction against Claude API (ground truth).
 * Run on sample pages to measure and improve local model accuracy.
 * 
 * Usage: pnpm evaluate <url1> <url2> ...
 */

import { smartFetch, closeBrowser } from '@webdex/crawler';
import { extractDomain } from '@webdex/shared';
import { initLocalModel, localInfer, disposeModel } from '../models/local-model.js';
import { escalateToCloud } from '../models/escalation-model.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function evaluate() {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error('Usage: pnpm evaluate <url1> <url2> ...');
    process.exit(1);
  }

  await initLocalModel();
  const prompt = readFileSync(join(__dirname, '..', 'prompts', 'extract-contacts.txt'), 'utf-8');

  let totalLocal = 0;
  let totalCloud = 0;
  let matches = 0;

  for (const url of urls) {
    console.log(`\n📊 Evaluating: ${url}`);
    const result = await smartFetch(url);
    const content = result.cleanedDom.slice(0, 8000);
    const userMsg = `URL: ${url}\n\nPage content:\n${content}`;

    // Local model
    const localResponse = await localInfer(prompt, userMsg);
    let localEntities: unknown[] = [];
    try {
      const match = localResponse.match(/\[[\s\S]*\]/);
      if (match) localEntities = JSON.parse(match[0]);
    } catch {}

    // Cloud model (ground truth)
    const cloudResponse = await escalateToCloud(prompt, userMsg);
    let cloudEntities: unknown[] = [];
    try {
      const match = cloudResponse.match(/\[[\s\S]*\]/);
      if (match) cloudEntities = JSON.parse(match[0]);
    } catch {}

    console.log(`  Local: ${localEntities.length} entities`);
    console.log(`  Cloud: ${cloudEntities.length} entities`);

    totalLocal += localEntities.length;
    totalCloud += cloudEntities.length;

    // Simple name matching
    const cloudNames = new Set(cloudEntities.map((e: any) => e.name?.toLowerCase()));
    const localNames = new Set(localEntities.map((e: any) => e.name?.toLowerCase()));
    const matchCount = [...localNames].filter(n => cloudNames.has(n)).length;
    matches += matchCount;

    const precision = localEntities.length > 0 ? matchCount / localEntities.length : 0;
    const recall = cloudEntities.length > 0 ? matchCount / cloudEntities.length : 0;
    console.log(`  Precision: ${(precision * 100).toFixed(1)}% | Recall: ${(recall * 100).toFixed(1)}%`);
  }

  console.log('\n═══════════════════════');
  console.log(`Total local entities: ${totalLocal}`);
  console.log(`Total cloud entities: ${totalCloud}`);
  console.log(`Name matches: ${matches}`);
  console.log(`Overall precision: ${totalLocal > 0 ? ((matches / totalLocal) * 100).toFixed(1) : 0}%`);
  console.log(`Overall recall: ${totalCloud > 0 ? ((matches / totalCloud) * 100).toFixed(1) : 0}%`);

  await closeBrowser();
  await disposeModel();
}

evaluate().catch(console.error);
