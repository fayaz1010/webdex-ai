import { Pool } from 'pg';
import pgvector from 'pgvector/pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://webdex:webdex@localhost:5432/webdex',
      max: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
    });

    pool.on('connect', async (client) => {
      await pgvector.registerType(client);
    });
  }
  return pool;
}

export async function query(text: string, params?: unknown[]) {
  const pool = getPool();
  return pool.query(text, params);
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
