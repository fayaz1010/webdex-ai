import * as cheerio from 'cheerio';

export interface PageMeta {
  title: string;
  description: string;
  h1: string;
  h2s: string[];
  canonical: string;
  robots: string;
  lang: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  twitterCard: string;
  structuredData: Record<string, unknown>[];
  author: string;
  publishedAt: string;
  modifiedAt: string;
  cmsHints: string[];
}

export function extractMeta(html: string, baseUrl: string): PageMeta {
  const $ = cheerio.load(html);

  const h2s: string[] = [];
  $('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text) h2s.push(text);
  });

  // Detect CMS hints from class names, meta tags, or generator
  const cmsHints: string[] = [];
  const generator = $('meta[name="generator"]').attr('content') || '';
  if (/wordpress/i.test(generator)) cmsHints.push('wordpress');
  if (/wix/i.test(generator)) cmsHints.push('wix');
  if (/squarespace/i.test(generator)) cmsHints.push('squarespace');
  if (/shopify/i.test(html)) cmsHints.push('shopify');
  if (/hubspot/i.test(html)) cmsHints.push('hubspot');
  if ($('[class*="wp-"]').length > 5) cmsHints.push('wordpress');
  if ($('[data-react]').length > 0 || $('[data-reactroot]').length > 0) cmsHints.push('react');
  if ($('[ng-app]').length > 0 || $('[data-ng-app]').length > 0) cmsHints.push('angular');
  if ($('#__nuxt').length > 0) cmsHints.push('nuxt');
  if ($('#__next').length > 0) cmsHints.push('nextjs');

  // Extract structured data (JSON-LD)
  const structuredData: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || '{}');
      if (parsed && typeof parsed === 'object') {
        structuredData.push(parsed);
      }
    } catch {}
  });

  return {
    title: $('title').first().text().trim(),
    description: $('meta[name="description"]').attr('content') || '',
    h1: $('h1').first().text().trim(),
    h2s: h2s.slice(0, 10),
    canonical: $('link[rel="canonical"]').attr('href') || baseUrl,
    robots: $('meta[name="robots"]').attr('content') || '',
    lang: $('html').attr('lang') || '',
    ogTitle: $('meta[property="og:title"]').attr('content') || '',
    ogDescription: $('meta[property="og:description"]').attr('content') || '',
    ogImage: $('meta[property="og:image"]').attr('content') || '',
    ogType: $('meta[property="og:type"]').attr('content') || '',
    twitterCard: $('meta[name="twitter:card"]').attr('content') || '',
    structuredData,
    author: $('meta[name="author"]').attr('content') || $('[rel="author"]').first().text().trim() || '',
    publishedAt: $('meta[property="article:published_time"]').attr('content') || $('time[datetime]').first().attr('datetime') || '',
    modifiedAt: $('meta[property="article:modified_time"]').attr('content') || '',
    cmsHints: [...new Set(cmsHints)],
  };
}
