import * as cheerio from 'cheerio';
import type { CrawlResult, ExtractedForm, ExtractedLink, ExtractedImage } from '@webdex/shared';
import { USER_AGENTS } from './retry-strategy.js';

export interface HttpFetchOptions {
  userAgent?: string;
  timeoutMs?: number;
}

export async function httpFetch(url: string, opts: HttpFetchOptions = {}): Promise<CrawlResult> {
  const startTime = Date.now();
  const userAgent = opts.userAgent || USER_AGENTS[0];

  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-AU,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(opts.timeoutMs || 30_000),
  });

  const html = await response.text();
  const loadTimeMs = Date.now() - startTime;
  const $ = cheerio.load(html);

  // Strip non-content elements
  $('script, style, noscript, iframe[src*="ads"], .cookie-banner, .gdpr').remove();

  const cleanedDom = $('body').html() || '';
  const domNodes = $('*').length;

  // Extract forms
  const forms: ExtractedForm[] = [];
  $('form').each((_, el) => {
    const $form = $(el);
    const fields: ExtractedForm['fields'] = [];

    $form.find('input, select, textarea').each((_, field) => {
      const $field = $(field);
      const name = $field.attr('name');
      if (!name || $field.attr('type') === 'hidden') return;

      const options: string[] = [];
      if (field.tagName === 'select') {
        $field.find('option').each((_, opt) => {
          const val = $(opt).text().trim();
          if (val) options.push(val);
        });
      }

      fields.push({
        name,
        type: $field.attr('type') || field.tagName.toLowerCase(),
        required: $field.attr('required') !== undefined,
        label: $form.find(`label[for="${$field.attr('id')}"]`).text().trim() ||
               $field.attr('placeholder') || '',
        placeholder: $field.attr('placeholder') || undefined,
        options: options.length > 0 ? options : undefined,
        pattern: $field.attr('pattern') || undefined,
      });
    });

    // Also capture hidden fields separately
    const hiddenFields: ExtractedForm['fields'] = [];
    $form.find('input[type="hidden"]').each((_, field) => {
      const $f = $(field);
      const name = $f.attr('name');
      if (name) {
        hiddenFields.push({
          name,
          type: 'hidden',
          required: false,
          label: $f.attr('value') || '',
        });
      }
    });

    forms.push({
      action: $form.attr('action') || '',
      method: ($form.attr('method') || 'GET').toUpperCase(),
      fields: [...fields, ...hiddenFields],
      submitLabel: $form.find('button[type="submit"], input[type="submit"]').text().trim() ||
                   $form.find('button[type="submit"], input[type="submit"]').attr('value') || 'Submit',
      encoding: $form.attr('enctype') || undefined,
    });
  });

  // Extract links
  const links: ExtractedLink[] = [];
  $('a[href]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    const isNav = !!$a.closest('nav, header, [role="navigation"]').length;
    const isFooter = !!$a.closest('footer').length;
    const isSidebar = !!$a.closest('aside, [role="complementary"]').length;

    let isExternal = false;
    try {
      const linkDomain = new URL(href, url).hostname;
      const pageDomain = new URL(url).hostname;
      isExternal = linkDomain !== pageDomain;
    } catch {}

    links.push({
      href: href.startsWith('http') ? href : new URL(href, url).toString(),
      text: $a.text().trim().slice(0, 200),
      location: isNav ? 'nav' : isFooter ? 'footer' : isSidebar ? 'sidebar' : 'body',
      isExternal,
      rel: $a.attr('rel') || undefined,
    });
  });

  // Extract images
  const images: ExtractedImage[] = [];
  $('img[src]').each((_, el) => {
    const $img = $(el);
    const src = $img.attr('src');
    if (!src || src.startsWith('data:image/svg') || src.includes('pixel') || src.includes('tracking')) return;

    images.push({
      src: src.startsWith('http') ? src : new URL(src, url).toString(),
      alt: $img.attr('alt') || undefined,
      width: parseInt($img.attr('width') || '0') || undefined,
      height: parseInt($img.attr('height') || '0') || undefined,
      caption: $img.closest('figure').find('figcaption').text().trim() || undefined,
      context: $img.closest('section, article, div[class]').attr('class')?.slice(0, 100) || undefined,
    });
  });

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => { headers[key] = value; });

  return {
    url,
    status: response.status,
    html,
    htmlSizeBytes: new TextEncoder().encode(html).length,
    domNodes,
    accessibilityTreeNodes: 0, // HTTP-only doesn't get a11y tree
    networkRequestsCaptured: 0,
    loadTimeMs,
    requiresJs: false,
    headers,
    forms,
    links,
    images,
    videos: [],
    apiEndpoints: [],
    cleanedDom,
    accessibilityTree: '',
  };
}
