import { httpFetch } from './http-fetcher.js';
import { browserFetch, browserFetchStealth, closeBrowser } from './browser-fetcher.js';
import { detectCaptcha } from './captcha-detector.js';
import { withRetry, getStrategy, getRotatedUA } from './retry-strategy.js';
import type { CrawlResult } from '@webdex/shared';

const JS_HEAVY_INDICATORS = [
  'react', 'angular', 'vue', '__NEXT_DATA__', '__NUXT__',
  'ng-app', 'data-reactroot', 'window.__INITIAL_STATE__',
  'ember', 'backbone', 'knockout',
];

function isJsHeavy(html: string, domNodes: number, contentLen: number): boolean {
  const hasFramework = JS_HEAVY_INDICATORS.some(i => html.toLowerCase().includes(i.toLowerCase()));
  return hasFramework || domNodes < 50 || contentLen < 500;
}

export async function smartFetch(url: string, maxAttempts = 5): Promise<CrawlResult> {
  return withRetry(async (ctx) => {
    const { strategy, userAgent, attempt } = ctx;

    if (strategy === 'http') {
      const result = await httpFetch(url, { userAgent });

      // Check for bot challenges in HTTP response
      const captcha = detectCaptcha(result.html, result.html.match(/<title>(.*?)<\/title>/i)?.[1]);
      if (captcha.detected) {
        if (captcha.autoResolvable) {
          // Cloudflare JS challenge — escalate to browser which can auto-bypass
          console.log(`[smart-router] CF challenge detected on ${url} — escalating to browser`);
          return await browserFetch(url, { userAgent, attempt });
        }
        if (captcha.needsService) {
          throw new Error(`CAPTCHA_DETECTED:${captcha.type} — ${url}`);
        }
        throw new Error(`BOT_PROTECTION:${captcha.type} — ${url}`);
      }

      // Check if content needs JS
      if (isJsHeavy(result.html, result.domNodes, result.cleanedDom.length)) {
        console.log(`[smart-router] Thin/JS content on ${url} — escalating to browser`);
        return await browserFetch(url, { userAgent, attempt });
      }

      return result;
    }

    if (strategy === 'browser') {
      return await browserFetch(url, { userAgent, attempt });
    }

    // browser-stealth: slower timing, extra waits, human-like behaviour
    return await browserFetchStealth(url, { userAgent, attempt });

  }, { maxAttempts, baseDelayMs: 1500, maxDelayMs: 30_000, jitter: true });
}

export { closeBrowser };
