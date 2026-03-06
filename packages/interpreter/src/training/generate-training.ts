/**
 * Training Data Generator
 * 
 * Crawls pages and uses Claude API to generate high-quality entity extractions.
 * These become the training data for fine-tuning the local model.
 * 
 * Usage: tsx generate-training.ts <seed-file-or-url>
 */
import { smartFetch, closeBrowser } from '@webdex/crawler';
import { escalateToCloud } from '../models/escalation-model.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = './training-data';

async function generateTraining() {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: tsx generate-training.ts <url-or-file>');
    process.exit(1);
  }

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const urls = input.startsWith('http')
    ? [input]
    : readFileSync(input, 'utf-8').split('\n').filter(l => l.trim().startsWith('http'));

  console.log(`Generating training data for ${urls.length} URLs`);

  const prompts = {
    classify: readFileSync(join(__dirname, '..', 'prompts', 'classify.txt'), 'utf-8'),
    contacts: readFileSync(join(__dirname, '..', 'prompts', 'extract-contacts.txt'), 'utf-8'),
    products: readFileSync(join(__dirname, '..', 'prompts', 'extract-products.txt'), 'utf-8'),
    actions: readFileSync(join(__dirname, '..', 'prompts', 'extract-actions.txt'), 'utf-8'),
  };

  const trainingPairs: Array<{ input: string; output: string; prompt_type: string }> = [];

  for (const url of urls) {
    try {
      console.log(`\nProcessing: ${url}`);
      const result = await smartFetch(url);
      const content = result.cleanedDom.slice(0, 8000);
      const userMsg = `URL: ${url}\n\nPage content:\n${content}`;

      for (const [type, prompt] of Object.entries(prompts)) {
        const response = await escalateToCloud(prompt, userMsg);
        trainingPairs.push({ input: userMsg, output: response, prompt_type: type });
        console.log(`  ✓ ${type}: ${response.length} chars`);
      }

      await new Promise(r => setTimeout(r, 2000)); // Rate limiting
    } catch (error) {
      console.error(`  ✗ Failed: ${error}`);
    }
  }

  const outFile = join(OUTPUT_DIR, `training-${Date.now()}.jsonl`);
  const lines = trainingPairs.map(p => JSON.stringify(p)).join('\n');
  writeFileSync(outFile, lines);
  console.log(`\n✅ ${trainingPairs.length} training pairs saved to ${outFile}`);

  await closeBrowser();
}

generateTraining().catch(console.error);
