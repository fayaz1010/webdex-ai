import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

const DEFAULT_DELAY_MS = parseInt(process.env.CRAWL_DEFAULT_DELAY_MS || '1000');

export async function canCrawlDomain(domain: string): Promise<boolean> {
  const key = `webdex:domain:${domain}:last_crawl`;
  const last = await redis.get(key);
  if (!last) return true;

  const delayKey = `webdex:domain:${domain}:delay`;
  const delay = parseInt((await redis.get(delayKey)) || String(DEFAULT_DELAY_MS));
  return Date.now() - parseInt(last) >= delay;
}

export async function markDomainCrawled(domain: string): Promise<void> {
  const key = `webdex:domain:${domain}:last_crawl`;
  await redis.set(key, Date.now().toString(), 'EX', 3600);
}

export async function setDomainDelay(domain: string, delayMs: number): Promise<void> {
  const key = `webdex:domain:${domain}:delay`;
  await redis.set(key, delayMs.toString(), 'EX', 86400);
}

export async function getDomainStats(domain: string) {
  const [crawlCount, lastCrawl] = await Promise.all([
    redis.get(`webdex:domain:${domain}:count`),
    redis.get(`webdex:domain:${domain}:last_crawl`),
  ]);
  return {
    domain,
    crawlCount: parseInt(crawlCount || '0'),
    lastCrawl: lastCrawl ? new Date(parseInt(lastCrawl)) : null,
  };
}

export async function incrementDomainCount(domain: string): Promise<void> {
  await redis.incr(`webdex:domain:${domain}:count`);
}
