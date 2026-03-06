/**
 * Cloud inference fallback.
 * Tries the free API cascade first; only pays for Claude if everything else fails.
 */
import { cascadeInfer } from './free-api-cascade.js';

export async function escalateToCloud(systemPrompt: string, userMessage: string): Promise<string> {
  return cascadeInfer(systemPrompt, userMessage);
}
