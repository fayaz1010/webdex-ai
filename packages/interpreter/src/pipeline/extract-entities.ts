import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { localInfer } from '../models/local-model.js';
import { escalateToCloud } from '../models/escalation-model.js';
import type { Entity, EntityCategory } from '@webdex/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPrompt(filename: string): string {
  return readFileSync(join(__dirname, '..', 'prompts', filename), 'utf-8');
}

const PROMPTS: Record<string, string> = {
  contacts: loadPrompt('extract-contacts.txt'),
  products: loadPrompt('extract-products.txt'),
  actions: loadPrompt('extract-actions.txt'),
  general: loadPrompt('extract-general.txt'),
};

interface ExtractionResult {
  entities: Array<Omit<Entity, 'id' | 'pageId' | 'embedding' | 'createdAt' | 'updatedAt'>>;
}

async function runExtraction(
  promptKey: string,
  content: string,
  domain: string,
  useCloud = false
): Promise<Entity[]> {
  const systemPrompt = PROMPTS[promptKey];
  let raw: string;

  try {
    raw = useCloud
      ? await escalateToCloud(systemPrompt, content)
      : await localInfer(systemPrompt, content);
  } catch (err) {
    console.warn(`[extract-entities] ${promptKey} inference failed, trying cloud fallback`);
    try {
      raw = await escalateToCloud(systemPrompt, content);
    } catch {
      console.error(`[extract-entities] ${promptKey} cloud fallback also failed`);
      return [];
    }
  }

  try {
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return [];

    const parsed: ExtractionResult = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    if (!Array.isArray(parsed.entities)) return [];

    return parsed.entities
      .filter(e => e && e.category && e.data)
      .map(e => ({
        ...e,
        domain,
        confidence: e.confidence ?? 0.5,
        searchableText: e.searchableText ?? '',
      })) as Entity[];
  } catch {
    console.warn(`[extract-entities] Failed to parse ${promptKey} response`);
    return [];
  }
}

export interface ExtractionInput {
  cleanedDom: string;
  url: string;
  domain: string;
  pageType: string;
  meta: Record<string, string>;
  confidence?: number;
}

export async function extractAllEntities(input: ExtractionInput): Promise<Entity[]> {
  const { cleanedDom, url, domain, pageType, meta, confidence = 1.0 } = input;

  const contentBlock = `URL: ${url}
Page type: ${pageType}
Title: ${meta.title || ''}
Description: ${meta.description || ''}

Page content:
${cleanedDom.slice(0, 8000)}`;

  const useCloud = confidence < 0.7;

  // Run targeted extractors based on page type, plus general for org/location/event/review
  const extractorMap: Record<string, string[]> = {
    // People-heavy pages
    contact_page:          ['contacts', 'general'],
    staff_directory:       ['contacts', 'general'],
    about_page:            ['contacts', 'general'],
    // Product/service pages
    product_landing:       ['products', 'actions', 'general'],
    product_listing:       ['products', 'general'],
    product_catalog:       ['products', 'general'],
    pricing_page:          ['products', 'actions'],
    business_service_landing: ['contacts', 'actions', 'general'],
    business_service_hub:  ['contacts', 'products', 'general'],
    // Action-heavy pages
    booking_page:          ['actions', 'general'],
    calculator_page:       ['actions'],
    checkout_page:         ['actions'],
    // Wide-spectrum pages
    homepage:              ['contacts', 'products', 'actions', 'general'],
    // Content pages (extract org/location/event/review context)
    blog_article:          ['general'],
    news_article:          ['general'],
    case_study:            ['contacts', 'general'],
    faq_page:              ['general'],
    review_page:           ['general'],
    resource_hub:          ['general'],
    // Specialised
    government_regulation: ['general'],
    government_directory:  ['contacts', 'general'],
    event_page:            ['general'],
    course_listing:        ['actions', 'general'],
  };

  const extractors = extractorMap[pageType] ?? ['contacts', 'products', 'actions', 'general'];

  const results = await Promise.allSettled(
    extractors.map(key => runExtraction(key, contentBlock, domain, useCloud))
  );

  const allEntities: Entity[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allEntities.push(...result.value);
    }
  }

  // Deduplicate by searchableText similarity (simple exact-match dedup)
  const seen = new Set<string>();
  return allEntities.filter(e => {
    const key = `${e.category}:${e.searchableText.slice(0, 60).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
