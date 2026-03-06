import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATIONS = [
  '001_initial.sql',
  '002_indexes.sql',
  '003_materialized_views.sql',
  '004_personal_index.sql',
  '005_action_approvals.sql',
];

async function ensureMigrationsTable(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(pool: ReturnType<typeof getPool>): Promise<Set<string>> {
  const result = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((r: { filename: string }) => r.filename));
}

async function migrate() {
  const pool = getPool();
  console.log('🗄  Running migrations...');

  await ensureMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);

  for (const filename of MIGRATIONS) {
    if (applied.has(filename)) {
      console.log(`⏭  ${filename} already applied, skipping`);
      continue;
    }

    const filePath = join(__dirname, 'schema', 'migrations', filename);
    if (!existsSync(filePath)) {
      console.warn(`⚠  Migration file not found: ${filename}`);
      continue;
    }

    const sql = readFileSync(filePath, 'utf-8');

    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await pool.query('COMMIT');
      console.log(`✅ ${filename} applied`);
    } catch (error: any) {
      await pool.query('ROLLBACK');
      if (error.message?.includes('already exists')) {
        console.log(`ℹ  ${filename} partially applied (objects already exist), recording as done`);
        try {
          await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [filename]);
        } catch {}
      } else {
        console.error(`❌ Failed to apply ${filename}:`, error.message);
        throw error;
      }
    }
  }

  await closePool();
  console.log('🗄  Migrations complete');
}

migrate().catch(console.error);
