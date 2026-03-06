import { chromium, type Browser, type Page } from 'playwright';
import type { CrawlResult, ExtractedForm, ExtractedLink, ExtractedImage, ExtractedVideo, DiscoveredApi } from '@webdex/shared';
import { detectCaptcha, attemptCloudflareBypass } from './captcha-detector.js';
import { USER_AGENTS, sleep } from './retry-strategy.js';

export interface BrowserFetchOptions {
  userAgent?: string;
  attempt?: number;
  timeoutMs?: number;
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
  }
  return browser;
}

export async function browserFetch(url: string, opts: BrowserFetchOptions = {}): Promise<CrawlResult> {
  const b = await getBrowser();
  const userAgent = opts.userAgent || USER_AGENTS[opts.attempt || 0];

  const context = await b.newContext({
    userAgent,
    viewport: { width: 1280, height: 800 },
    // Spoof automation detection
    extraHTTPHeaders: {
      'Accept-Language': 'en-AU,en-US;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  const page = await context.newPage();
  const apiEndpoints: DiscoveredApi[] = [];
  const startTime = Date.now();

  // Intercept network requests for API discovery
  page.on('request', (request) => {
    const reqUrl = request.url();
    const method = request.method();
    if (
      (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') &&
      reqUrl.includes(new URL(url).hostname)
    ) {
      apiEndpoints.push({
        url: reqUrl,
        method,
        discoveredVia: 'xhr_intercept',
        contentType: request.headers()['content-type'] || undefined,
      });
    }
  });

  // Remove navigator.webdriver property to avoid bot detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: opts.timeoutMs || 45_000 });

  // Detect and handle Cloudflare challenges
  const html_initial = await page.content();
  const captchaCheck = detectCaptcha(html_initial, await page.title().catch(() => ''));
  if (captchaCheck.detected && captchaCheck.type === 'cloudflare_challenge' && captchaCheck.autoResolvable) {
    console.log(`[browser-fetch] Cloudflare challenge detected on ${url}, waiting for auto-bypass...`);
    await attemptCloudflareBypass(page, url);
  }
  const loadTimeMs = Date.now() - startTime;

  // Get accessibility tree
  const a11ySnapshot = await page.accessibility.snapshot();
  const accessibilityTree = JSON.stringify(a11ySnapshot, null, 2);
  const accessibilityTreeNodes = JSON.stringify(a11ySnapshot).split('"role"').length - 1;

  // Get page HTML after JS rendering
  const html = await page.content();

  // Extract forms via page evaluation
  const forms: ExtractedForm[] = await page.evaluate(() => {
    const results: any[] = [];
    document.querySelectorAll('form').forEach((form) => {
      const fields: any[] = [];
      form.querySelectorAll('input, select, textarea').forEach((field: any) => {
        const name = field.getAttribute('name');
        if (!name) return;

        const options: string[] = [];
        if (field.tagName === 'SELECT') {
          field.querySelectorAll('option').forEach((opt: any) => {
            if (opt.textContent?.trim()) options.push(opt.textContent.trim());
          });
        }

        fields.push({
          name,
          type: field.getAttribute('type') || field.tagName.toLowerCase(),
          required: field.hasAttribute('required'),
          label: document.querySelector(`label[for="${field.id}"]`)?.textContent?.trim() || field.placeholder || '',
          placeholder: field.placeholder || undefined,
          options: options.length > 0 ? options : undefined,
          pattern: field.getAttribute('pattern') || undefined,
        });
      });

      results.push({
        action: form.getAttribute('action') || '',
        method: (form.getAttribute('method') || 'GET').toUpperCase(),
        fields,
        submitLabel: (form.querySelector('button[type="submit"], input[type="submit"]') as any)?.textContent?.trim() || 'Submit',
        encoding: form.getAttribute('enctype') || undefined,
      });
    });
    return results;
  });

  // Extract links
  const links: ExtractedLink[] = await page.evaluate((baseUrl) => {
    const results: any[] = [];
    document.querySelectorAll('a[href]').forEach((a: any) => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      const isNav = !!a.closest('nav, header, [role="navigation"]');
      const isFooter = !!a.closest('footer');

      let fullHref = href;
      try { fullHref = new URL(href, baseUrl).toString(); } catch {}

      let isExternal = false;
      try {
        isExternal = new URL(fullHref).hostname !== new URL(baseUrl).hostname;
      } catch {}

      results.push({
        href: fullHref,
        text: (a.textContent || '').trim().slice(0, 200),
        location: isNav ? 'nav' : isFooter ? 'footer' : 'body',
        isExternal,
      });
    });
    return results;
  }, url);

  // Extract images
  const images: ExtractedImage[] = await page.evaluate((baseUrl) => {
    const results: any[] = [];
    document.querySelectorAll('img[src]').forEach((img: any) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:image/svg')) return;
      let fullSrc = src;
      try { fullSrc = new URL(src, baseUrl).toString(); } catch {}

      results.push({
        src: fullSrc,
        alt: img.getAttribute('alt') || undefined,
        width: img.naturalWidth || parseInt(img.getAttribute('width') || '0') || undefined,
        height: img.naturalHeight || parseInt(img.getAttribute('height') || '0') || undefined,
        caption: img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || undefined,
      });
    });
    return results;
  }, url);

  // Extract videos
  const videos: ExtractedVideo[] = await page.evaluate(() => {
    const results: any[] = [];
    // YouTube iframes
    document.querySelectorAll('iframe[src*="youtube"], iframe[src*="youtu.be"]').forEach((iframe: any) => {
      const src = iframe.getAttribute('src') || '';
      const match = src.match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      results.push({
        platform: 'youtube',
        videoId: match ? match[1] : undefined,
        src,
        title: iframe.getAttribute('title') || undefined,
      });
    });
    // Vimeo
    document.querySelectorAll('iframe[src*="vimeo"]').forEach((iframe: any) => {
      results.push({ platform: 'vimeo', src: iframe.getAttribute('src') || '' });
    });
    // HTML5 video
    document.querySelectorAll('video[src], video source[src]').forEach((video: any) => {
      results.push({
        platform: 'self_hosted',
        src: video.getAttribute('src') || '',
        title: video.getAttribute('title') || undefined,
      });
    });
    return results;
  });

  // Detect JS-heavy pages
  const domNodes = await page.evaluate(() => document.querySelectorAll('*').length);

  const headers: Record<string, string> = {};
  if (response) {
    response.headers().forEach ? Object.entries(response.headers()).forEach(([k, v]) => { headers[k] = v; }) : null;
  }

  // Cleaned DOM (after JS rendering)
  const cleanedDom = await page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    return clone.innerHTML;
  });

  await context.close();

  return {
    url,
    status: response?.status() || 0,
    html,
    htmlSizeBytes: new TextEncoder().encode(html).length,
    domNodes,
    accessibilityTreeNodes,
    networkRequestsCaptured: apiEndpoints.length,
    loadTimeMs,
    requiresJs: true,
    headers,
    forms,
    links,
    images,
    videos,
    apiEndpoints,
    cleanedDom,
    accessibilityTree,
  };
}

/**
 * Stealth fetch — slower, more human-like navigation with random delays.
 * Used after multiple normal attempts have failed.
 */
export async function browserFetchStealth(url: string, opts: BrowserFetchOptions = {}): Promise<CrawlResult> {
  const b = await getBrowser();
  const userAgent = opts.userAgent || USER_AGENTS[(opts.attempt || 4) % USER_AGENTS.length];

  const context = await b.newContext({
    userAgent,
    viewport: { width: 1366 + Math.floor(Math.random() * 200), height: 768 + Math.floor(Math.random() * 100) },
    locale: 'en-AU',
    timezoneId: 'Australia/Perth',
    extraHTTPHeaders: {
      'Accept-Language': 'en-AU,en-US;q=0.9,en;q=0.8',
    },
  });

  const page = await context.newPage();

  // Spoof automation signals
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-AU', 'en'] });
    (window as any).chrome = { runtime: {} };
  });

  // Random pre-navigation delay (simulates human hesitation)
  await sleep(500 + Math.random() * 2000);

  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs || 60_000 });

  // Wait for page to fully settle
  await sleep(1000 + Math.random() * 3000);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  // Cloudflare bypass attempt
  const html_check = await page.content();
  const captchaCheck = detectCaptcha(html_check, await page.title().catch(() => ''));
  if (captchaCheck.detected && captchaCheck.autoResolvable) {
    await attemptCloudflareBypass(page, url, 20_000);
  }

  // Simulate light scroll to trigger lazy-loads
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await sleep(500);

  const html = await page.content();
  const cleanedDom = await page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    return clone.innerHTML;
  });

  await context.close();

  return {
    url,
    status: response?.status() || 0,
    html,
    htmlSizeBytes: new TextEncoder().encode(html).length,
    domNodes: await context.pages().length > 0 ? 0 : 0, // context closed
    accessibilityTreeNodes: 0,
    networkRequestsCaptured: 0,
    loadTimeMs: 0,
    requiresJs: true,
    headers: response ? Object.fromEntries(Object.entries(response.headers())) : {},
    forms: [],
    links: [],
    images: [],
    videos: [],
    apiEndpoints: [],
    cleanedDom,
    accessibilityTree: '',
  };
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
