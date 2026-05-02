import { Pool } from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
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

    // In dist build, __dirname is dist/src/db.
    // We copy migrations to /app/drizzle in the container, which resolves here:
    // dist/src/db -> dist/src -> dist -> (project root)
    const dir = path.resolve(__dirname, '../../../drizzle');
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
