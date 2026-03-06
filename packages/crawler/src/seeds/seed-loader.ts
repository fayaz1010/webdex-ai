import { readFileSync, existsSync } from 'fs';
import { addBulkCrawlJobs, type CrawlJobData } from '../scheduler/crawl-queue.js';
import { extractDomain } from '@webdex/shared';

export async function loadSeedsFromFile(filePath: string, source: 'seed' | 'discovered' = 'seed'): Promise<number> {
  if (!existsSync(filePath)) throw new Error(`Seed file not found: ${filePath}`);

  const content = readFileSync(filePath, 'utf-8');
  const urls = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && l.startsWith('http'));

  const jobs: CrawlJobData[] = urls.map(url => ({
    url,
    domain: extractDomain(url),
    priority: source === 'seed' ? 3 : 6,
    source,
  }));

  await addBulkCrawlJobs(jobs);
  return jobs.length;
}

export async function loadSeedsFromArray(urls: string[], source: 'seed' | 'on-demand' | 'personal' = 'seed', userId?: string): Promise<number> {
  const jobs: CrawlJobData[] = urls.map(url => ({
    url,
    domain: extractDomain(url),
    priority: source === 'personal' ? 1 : source === 'on-demand' ? 2 : 3,
    source,
    userId,
  }));

  await addBulkCrawlJobs(jobs);
  return jobs.length;
}
