import { Pool } from 'pg';
import pgvector from 'pgvector/pg';

let pool: Pool | null = null;
let pgvectorRegistered = false;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://webdex:webdex@localhost:5432/webdex',
      max: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
    });

    pool.on('connect', async (client) => {
      if (pgvectorRegistered) {
        try { await pgvector.registerType(client); } catch { /* vector ext not yet installed */ }
        return;
      }
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        await pgvector.registerType(client);
        pgvectorRegistered = true;
      } catch {
        console.warn('[db] pgvector extension not available — vector operations will fail');
      }
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
