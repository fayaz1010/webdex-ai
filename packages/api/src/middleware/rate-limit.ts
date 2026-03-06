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

export function rateLimit(maxRequests: number, windowSeconds: number) {
  return async (c: Context, next: Next) => {
    const client = getRedis();

    // Gracefully skip rate limiting if Redis is unavailable
    if (!client) return next();

    try {
      const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
      const key = `webdex:ratelimit:${ip}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;

      const current = await client.incr(key);
      if (current === 1) await client.expire(key, windowSeconds);

      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', Math.max(0, maxRequests - current).toString());

      if (current > maxRequests) {
        return c.json({ error: 'Rate limit exceeded', retry_after: windowSeconds }, 429);
      }
    } catch {
      redisAvailable = false;
      redis = null;
    }

    return next();
  };
}
