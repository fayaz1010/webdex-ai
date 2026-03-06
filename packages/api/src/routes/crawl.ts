import { Hono } from 'hono';
import { addCrawlJob, addBulkCrawlJobs, getQueueStats } from '@webdex/crawler';
import { getProviderStatus } from '@webdex/interpreter';
import { extractDomain } from '@webdex/shared';

export const crawlRoutes = new Hono();

crawlRoutes.post('/crawl', async (c) => {
  const body = await c.req.json();
  const { url, priority, deep } = body;

  if (!url) return c.json({ error: 'url is required' }, 400);

  const jobId = await addCrawlJob({
    url,
    domain: extractDomain(url),
    priority: priority || 2,
    source: 'on-demand',
  });

  return c.json({ queued: true, job_id: jobId, url, message: 'Crawl job queued.' });
});

crawlRoutes.post('/crawl/bulk', async (c) => {
  const body = await c.req.json();
  const { urls, priority } = body;
  if (!Array.isArray(urls) || urls.length === 0) return c.json({ error: 'urls array is required' }, 400);
  if (urls.length > 500) return c.json({ error: 'Max 500 URLs per bulk request' }, 400);

  const jobs = urls.map((url: string) => ({
    url,
    domain: extractDomain(url),
    priority: priority || 2,
    source: 'on-demand' as const,
  }));

  await addBulkCrawlJobs(jobs);
  return c.json({ queued: true, count: urls.length });
});

crawlRoutes.get('/crawl/stats', async (c) => {
  const stats = await getQueueStats();
  return c.json(stats);
});

crawlRoutes.get('/crawl/providers', async (c) => {
  return c.json({ providers: getProviderStatus() });
});
