import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
const Redis = (IORedis as any).default || IORedis;

let connection: InstanceType<typeof Redis> | null = null;
let _crawlQueue: Queue | null = null;

function getConnection() {
  if (!connection) {
    connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return connection;
}

function getCrawlQueue(): Queue {
  if (!_crawlQueue) {
    _crawlQueue = new Queue('webdex-crawl', { connection: getConnection() });
  }
  return _crawlQueue;
}

export { getCrawlQueue as crawlQueue };

export interface CrawlJobData {
  url: string;
  domain: string;
  priority: number;
  source: 'seed' | 'discovered' | 're-crawl' | 'on-demand' | 'personal';
  userId?: string;
  personalIndexId?: string;
}

export async function addCrawlJob(data: CrawlJobData): Promise<string> {
  const queue = getCrawlQueue();
  const job = await queue.add('crawl-page', data, {
    priority: data.priority,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 10000 },
    removeOnFail: { count: 5000 },
  });
  return job.id || '';
}

export async function addBulkCrawlJobs(jobs: CrawlJobData[]): Promise<void> {
  const queue = getCrawlQueue();
  await queue.addBulk(
    jobs.map(j => ({
      name: 'crawl-page',
      data: j,
      opts: { priority: j.priority, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    }))
  );
}

export function createCrawlWorker(processor: (job: Job<CrawlJobData>) => Promise<void>): Worker {
  return new Worker('webdex-crawl', processor, {
    connection: getConnection(),
    concurrency: parseInt(process.env.CRAWL_CONCURRENCY || '5'),
    limiter: { max: 10, duration: 1000 },
  });
}

export async function getQueueStats() {
  const queue = getCrawlQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
