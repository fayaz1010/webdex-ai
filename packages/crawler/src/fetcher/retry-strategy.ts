/**
 * Multi-strategy retry with exponential backoff.
 * Rotates User-Agents, escalates from HTTP→Browser, changes browser profiles.
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
}

// Realistic browser UA pool — rotated across retry attempts
export const USER_AGENTS = [
  // Chrome Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  // Chrome Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Firefox Linux
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Safari Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  // Chrome Android (mobile)
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
  // Edge Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
];

export function getRotatedUA(attempt: number): string {
  return USER_AGENTS[attempt % USER_AGENTS.length];
}

/**
 * Calculates delay for a given attempt with full jitter (AWS style).
 * attempt=0 → immediate, attempt=1 → 0-2s, attempt=2 → 0-4s, etc.
 */
export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 30_000, jitter = true): number {
  const cap = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  return jitter ? Math.random() * cap : cap;
}

export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  strategy: 'http' | 'browser' | 'browser-stealth';
  userAgent: string;
  lastError?: string;
}

/**
 * Decides which fetch strategy to use for a given attempt number.
 * attempt 0-1: HTTP
 * attempt 2-3: Browser (Playwright) with rotated UA
 * attempt 4+:  Browser with stealth mode (slower navigation, human-like delays)
 */
export function getStrategy(attempt: number): RetryContext['strategy'] {
  if (attempt <= 1) return 'http';
  if (attempt <= 3) return 'browser';
  return 'browser-stealth';
}

/**
 * Wraps an async function with exponential backoff + strategy rotation.
 * The factory is called with the current RetryContext so callers can
 * switch their fetch method based on strategy.
 */
export async function withRetry<T>(
  factory: (ctx: RetryContext) => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 5,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    jitter = true,
  } = opts;

  let lastError: Error = new Error('No attempts made');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ctx: RetryContext = {
      attempt,
      totalAttempts: maxAttempts,
      strategy: getStrategy(attempt),
      userAgent: getRotatedUA(attempt),
      lastError: lastError.message,
    };

    if (attempt > 0) {
      const delay = backoffDelay(attempt - 1, baseDelayMs, maxDelayMs, jitter);
      console.log(`[retry] Attempt ${attempt + 1}/${maxAttempts}, strategy=${ctx.strategy}, delay=${Math.round(delay)}ms`);
      await sleep(delay);
    }

    try {
      return await factory(ctx);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();

      // Don't retry on definitive failures
      if (msg.includes('404') || msg.includes('not found') || msg.includes('gone')) {
        throw lastError;
      }

      console.warn(`[retry] Attempt ${attempt + 1} failed: ${lastError.message.slice(0, 100)}`);
    }
  }

  throw new Error(`All ${maxAttempts} attempts failed. Last error: ${lastError.message}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
