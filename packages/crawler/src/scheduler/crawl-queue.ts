import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

export const crawlQueue = new Queue('webdex:crawl', { connection });

export interface CrawlJobData {
  url: string;
  domain: string;
  priority: number;
  source: 'seed' | 'discovered' | 're-crawl' | 'on-demand' | 'personal';
  userId?: string;
  personalIndexId?: string;
}

export async function addCrawlJob(data: CrawlJobData): Promise<string> {
  const job = await crawlQueue.add('crawl-page', data, {
    priority: data.priority,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 10000 },
    removeOnFail: { count: 5000 },
  });
  return job.id || '';
}

export async function addBulkCrawlJobs(jobs: CrawlJobData[]): Promise<void> {
  await crawlQueue.addBulk(
    jobs.map(j => ({
      name: 'crawl-page',
      data: j,
      opts: { priority: j.priority, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    }))
  );
}

export function createCrawlWorker(processor: (job: Job<CrawlJobData>) => Promise<void>): Worker {
  return new Worker('webdex:crawl', processor, {
    connection,
    concurrency: parseInt(process.env.CRAWL_CONCURRENCY || '5'),
    limiter: { max: 10, duration: 1000 },
  });
}

export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    crawlQueue.getWaitingCount(),
    crawlQueue.getActiveCount(),
    crawlQueue.getCompletedCount(),
    crawlQueue.getFailedCount(),
    crawlQueue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
