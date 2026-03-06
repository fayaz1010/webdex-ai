import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { localInfer } from '../models/local-model.js';
import { escalateToCloud } from '../models/escalation-model.js';
import type { PageType } from '@webdex/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLASSIFY_PROMPT = readFileSync(join(__dirname, '..', 'prompts', 'classify.txt'), 'utf-8');

export interface ClassificationResult {
  pageType: PageType;
  confidence: number;
  reasoning: string;
}

function parseClassification(raw: string): ClassificationResult {
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON in response');
  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
  return {
    pageType: (parsed.page_type || 'unknown') as PageType,
    confidence: parsed.confidence ?? 0.5,
    reasoning: parsed.reasoning || '',
  };
}

export async function classifyPage(cleanedDom: string, url: string, meta: Record<string, string>): Promise<ClassificationResult> {
  const truncatedDom = cleanedDom.slice(0, 6000);

  const userMessage = `URL: ${url}
Title: ${meta.title || 'Unknown'}
Description: ${meta.description || 'None'}
H1: ${meta.h1 || 'None'}

Page content (truncated):
${truncatedDom}`;

  // Try local model first; fall back to cloud if unavailable or parse fails
  let raw: string | null = null;

  try {
    raw = await localInfer(CLASSIFY_PROMPT, userMessage);
    return parseClassification(raw);
  } catch (localErr) {
    const isInit = String(localErr).includes('not initialized');
    if (!isInit) {
      console.warn('[classify] Local model failed, trying cloud fallback:', String(localErr).slice(0, 80));
    }
  }

  // Cloud fallback
  try {
    raw = await escalateToCloud(CLASSIFY_PROMPT, userMessage);
    return parseClassification(raw);
  } catch (cloudErr) {
    console.warn('[classify] Cloud fallback also failed:', String(cloudErr).slice(0, 80));
    return { pageType: 'unknown', confidence: 0.1, reasoning: 'Both local and cloud inference failed' };
  }
}
