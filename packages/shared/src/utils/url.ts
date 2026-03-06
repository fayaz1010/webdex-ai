export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = '';
    url.searchParams.sort();
    let path = url.pathname.replace(/\/+$/, '') || '/';
    url.pathname = path;
    return url.toString();
  } catch {
    return raw;
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function isInternalLink(link: string, baseDomain: string): boolean {
  try {
    const domain = extractDomain(link);
    return domain === baseDomain || domain === `www.${baseDomain}`;
  } catch {
    return link.startsWith('/') || link.startsWith('#');
  }
}

export function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}
