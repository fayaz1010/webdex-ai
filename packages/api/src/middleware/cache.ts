import { type Context, type Next } from 'hono';
import IORedis from 'ioredis';

let redis: IORedis | null = null;
let redisAvailable = true;

function getRedis(): IORedis | null {
  if (!redisAvailable) return null;
  if (!redis) {
    redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    redis.on('error', () => {
      redisAvailable = false;
      redis = null;
    });
  }
  return redis;
}

export function queryCache(ttlSeconds: number = 300) {
  return async (c: Context, next: Next) => {
    if (c.req.method !== 'GET') return next();

    const client = getRedis();

    // Gracefully skip caching if Redis is unavailable
    if (!client) {
      c.header('X-Cache', 'SKIP');
      return next();
    }

    try {
      const cacheKey = `webdex:cache:${c.req.url}`;
      const cached = await client.get(cacheKey);

      if (cached) {
        c.header('X-Cache', 'HIT');
        return c.json(JSON.parse(cached));
      }

      await next();

      if (c.res.status === 200) {
        const body = await c.res.clone().text();
        await client.setex(cacheKey, ttlSeconds, body);
        c.header('X-Cache', 'MISS');
      }
    } catch {
      redisAvailable = false;
      redis = null;
      return next();
    }
  };
}
