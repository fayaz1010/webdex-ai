import { query as dbQuery } from '@webdex/database';
import { contentHash } from '@webdex/shared';

export interface ChangeResult {
  url: string;
  hasChanged: boolean;
  previousHash?: string;
  newHash: string;
  previousVersion?: number;
}

export async function detectChange(url: string, newContent: string): Promise<ChangeResult> {
  const newHash = contentHash(newContent);
  const existing = await dbQuery('SELECT content_hash, version FROM pages WHERE url = $1', [url]);

  if (existing.rows.length === 0) {
    return { url, hasChanged: true, newHash };
  }

  const { content_hash: previousHash, version } = existing.rows[0];
  return {
    url,
    hasChanged: previousHash !== newHash,
    previousHash,
    newHash,
    previousVersion: version,
  };
}

export async function getStalePages(maxAgeDays: number, limit: number = 100) {
  const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString();
  const result = await dbQuery(
    `SELECT url, domain, last_crawled, crawl_frequency
     FROM pages
     WHERE last_crawled < $1 OR last_crawled IS NULL
     ORDER BY last_crawled ASC NULLS FIRST
     LIMIT $2`,
    [cutoff, limit]
  );
  return result.rows;
}
