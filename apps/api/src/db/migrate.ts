import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { loadEnv } from '../config/env';

async function ensureMigrationsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function hasMigration(pool: Pool, id: string) {
  const res = await pool.query('SELECT 1 FROM _migrations WHERE id=$1', [id]);
  return (res.rowCount ?? 0) > 0;
}

async function markMigration(pool: Pool, id: string) {
  await pool.query(
    'INSERT INTO _migrations (id) VALUES ($1) ON CONFLICT DO NOTHING',
    [id],
  );
}

export async function runMigrations() {
  const env = loadEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL });

  try {
    await ensureMigrationsTable(pool);

    // ts-node: __dirname = src/db   → ../../drizzle = apps/api/drizzle ✓
    // dist:    __dirname = dist/src/db → ../../../drizzle = /app/drizzle (Docker) ✓
    const candidates = [
      path.resolve(__dirname, '../../drizzle'),
      path.resolve(__dirname, '../../../drizzle'),
    ];
    const dir = candidates.find(existsSync);
    if (!dir) throw new Error(`Migrations folder not found. Tried: ${candidates.join(', ')}`);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith('.sql'))
      .map((e) => e.name)
      .sort();

    for (const f of files) {
      if (await hasMigration(pool, f)) continue;

      const fullPath = path.join(dir, f);
      const sql = await fs.readFile(fullPath, 'utf8');
      if (!sql.trim()) {
        await markMigration(pool, f);
        continue;
      }

      await pool.query('BEGIN');
      try {
        await pool.query(sql);
        await markMigration(pool, f);
        await pool.query('COMMIT');
        // eslint-disable-next-line no-console
        console.log(`[migrate] applied ${f}`);
      } catch (e) {
        await pool.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[migrate] failed', e);
    process.exit(1);
  });
}
