import * as cheerio from 'cheerio';
import type { CrawlResult } from '@webdex/shared';

const NOISE_SELECTORS = [
  'script', 'style', 'noscript', 'svg', 'canvas',
  'iframe[src*="ads"]', 'iframe[src*="doubleclick"]',
  '[class*="cookie"]', '[class*="gdpr"]', '[id*="cookie"]',
  '[class*="popup"]', '[class*="modal"][aria-hidden="true"]',
  '[class*="ad-"]', '[class*="-ad"]', '[id*="google_ads"]',
];

export interface DomExtractionResult {
  cleanedDom: string;
  textContent: string;
  meta: Record<string, string>;
  headings: Array<{ level: number; text: string }>;
  domNodes: number;
}

export function extractDom(html: string, baseUrl: string): DomExtractionResult {
  const $ = cheerio.load(html);

  // Remove noise
  $(NOISE_SELECTORS.join(', ')).remove();

  const domNodes = $('*').length;

  // Extract meta
  const meta: Record<string, string> = {
    title: $('title').first().text().trim(),
    description: $('meta[name="description"]').attr('content') || '',
    h1: $('h1').first().text().trim(),
    canonical: $('link[rel="canonical"]').attr('href') || baseUrl,
    ogTitle: $('meta[property="og:title"]').attr('content') || '',
    ogDescription: $('meta[property="og:description"]').attr('content') || '',
    ogImage: $('meta[property="og:image"]').attr('content') || '',
    robots: $('meta[name="robots"]').attr('content') || '',
    lang: $('html').attr('lang') || '',
  };

  // Extract headings hierarchy
  const headings: Array<{ level: number; text: string }> = [];
  $('h1, h2, h3, h4').each((_, el) => {
    const level = parseInt(el.tagName.slice(1));
    const text = $(el).text().trim();
    if (text) headings.push({ level, text });
  });

  // Get cleaned HTML body
  const cleanedDom = $('body').html() || '';

  // Get plain text
  const textContent = $('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20000);

  return { cleanedDom, textContent, meta, headings, domNodes };
}

export function extractLinks(html: string, baseUrl: string): CrawlResult['links'] {
  const $ = cheerio.load(html);
  const links: CrawlResult['links'] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

    let absoluteHref = href;
    try {
      absoluteHref = new URL(href, baseUrl).toString();
    } catch {
      return;
    }

    if (seen.has(absoluteHref)) return;
    seen.add(absoluteHref);

    const isNav = !!$a.closest('nav, header, [role="navigation"]').length;
    const isFooter = !!$a.closest('footer').length;
    const isSidebar = !!$a.closest('aside, [role="complementary"]').length;

    let isExternal = false;
    try {
      isExternal = new URL(absoluteHref).hostname !== new URL(baseUrl).hostname;
    } catch {}

    links.push({
      href: absoluteHref,
      text: $a.text().trim().slice(0, 200),
      location: isNav ? 'nav' : isFooter ? 'footer' : isSidebar ? 'sidebar' : 'body',
      isExternal,
      rel: $a.attr('rel') || undefined,
    });
  });

  return links;
}

export function extractForms(html: string, baseUrl: string): CrawlResult['forms'] {
  const $ = cheerio.load(html);
  const forms: CrawlResult['forms'] = [];

  $('form').each((_, el) => {
    const $form = $(el);
    const fields: CrawlResult['forms'][number]['fields'] = [];

    $form.find('input, select, textarea').each((_, field) => {
      const $field = $(field);
      const name = $field.attr('name');
      if (!name) return;

      const type = $field.attr('type') || field.tagName.toLowerCase();
      const isHidden = type === 'hidden';

      const options: string[] = [];
      if (field.tagName.toLowerCase() === 'select') {
        $field.find('option').each((_, opt) => {
          const val = $(opt).text().trim();
          if (val && val !== 'Select...' && val !== '--') options.push(val);
        });
      }

      const fieldId = $field.attr('id');
      const label = fieldId
        ? $form.find(`label[for="${fieldId}"]`).text().trim()
        : $field.attr('placeholder') || '';

      fields.push({
        name,
        type,
        required: $field.attr('required') !== undefined,
        label: label || undefined,
        placeholder: $field.attr('placeholder') || undefined,
        options: options.length > 0 ? options : undefined,
        pattern: $field.attr('pattern') || undefined,
      });
    });

    let action = $form.attr('action') || '';
    if (action && !action.startsWith('http')) {
      try { action = new URL(action, baseUrl).toString(); } catch {}
    }

    forms.push({
      action,
      method: ($form.attr('method') || 'GET').toUpperCase(),
      fields,
      submitLabel: $form.find('[type="submit"]').first().text().trim() ||
                   $form.find('[type="submit"]').first().attr('value') || 'Submit',
      encoding: $form.attr('enctype') || undefined,
    });
  });

  return forms;
}
