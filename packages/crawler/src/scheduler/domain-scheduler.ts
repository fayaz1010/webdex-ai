import IORedis from 'ioredis';
const RedisClass = (IORedis as any).default || IORedis;

let redis: InstanceType<typeof RedisClass> | null = null;

function getRedis(): InstanceType<typeof RedisClass> {
  if (!redis) {
    redis = new RedisClass(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 200, 3000),
    });
  }
  return redis;
}

const DEFAULT_DELAY_MS = parseInt(process.env.CRAWL_DEFAULT_DELAY_MS || '1000');

export async function canCrawlDomain(domain: string): Promise<boolean> {
  const key = `webdex-domain-${domain}-last_crawl`;
  const last = await getRedis().get(key);
  if (!last) return true;

  const delayKey = `webdex-domain-${domain}-delay`;
  const delay = parseInt((await getRedis().get(delayKey)) || String(DEFAULT_DELAY_MS));
  return Date.now() - parseInt(last) >= delay;
}

export async function markDomainCrawled(domain: string): Promise<void> {
  const key = `webdex-domain-${domain}-last_crawl`;
  await getRedis().set(key, Date.now().toString(), 'EX', 3600);
}

export async function setDomainDelay(domain: string, delayMs: number): Promise<void> {
  const key = `webdex-domain-${domain}-delay`;
  await getRedis().set(key, delayMs.toString(), 'EX', 86400);
}

export async function getDomainStats(domain: string) {
  const [crawlCount, lastCrawl] = await Promise.all([
    getRedis().get(`webdex-domain-${domain}-count`),
    getRedis().get(`webdex-domain-${domain}-last_crawl`),
  ]);
  return {
    domain,
    crawlCount: parseInt(crawlCount || '0'),
    lastCrawl: lastCrawl ? new Date(parseInt(lastCrawl)) : null,
  };
}

export async function incrementDomainCount(domain: string): Promise<void> {
  await getRedis().incr(`webdex-domain-${domain}-count`);
}
