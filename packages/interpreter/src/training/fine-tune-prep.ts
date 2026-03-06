/**
 * Fine-Tune Data Preparation
 * 
 * Converts training JSONL into format suitable for model fine-tuning.
 * Supports output formats for: Axolotl, Unsloth, OpenAI fine-tuning API.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TRAINING_DIR = './training-data';

function prepareForAxolotl() {
  const files = readdirSync(TRAINING_DIR).filter(f => f.endsWith('.jsonl'));
  const allPairs: Array<{ instruction: string; input: string; output: string }> = [];

  for (const file of files) {
    const lines = readFileSync(join(TRAINING_DIR, file), 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      const pair = JSON.parse(line);
      allPairs.push({
        instruction: `You are a WebDex AI ${pair.prompt_type} extractor. Extract structured entities from the web page content.`,
        input: pair.input,
        output: pair.output,
      });
    }
  }

  writeFileSync(
    join(TRAINING_DIR, 'axolotl-dataset.json'),
    JSON.stringify(allPairs, null, 2)
  );
  console.log(`✅ Axolotl dataset: ${allPairs.length} training pairs`);
}

function prepareForChatML() {
  const files = readdirSync(TRAINING_DIR).filter(f => f.endsWith('.jsonl'));
  const conversations: string[] = [];

  for (const file of files) {
    const lines = readFileSync(join(TRAINING_DIR, file), 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      const pair = JSON.parse(line);
      const conv = {
        messages: [
          { role: 'system', content: `You are a WebDex AI entity extractor. Task: ${pair.prompt_type}` },
          { role: 'user', content: pair.input },
          { role: 'assistant', content: pair.output },
        ],
      };
      conversations.push(JSON.stringify(conv));
    }
  }

  writeFileSync(join(TRAINING_DIR, 'chatml-dataset.jsonl'), conversations.join('\n'));
  console.log(`✅ ChatML dataset: ${conversations.length} conversations`);
}

console.log('Preparing fine-tuning datasets...');
prepareForAxolotl();
prepareForChatML();
