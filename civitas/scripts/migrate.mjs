// Runner de migraciones SQL puras: aplica db/migrations/*.sql en orden, una transacción por archivo.
// Uso: DATABASE_URL=postgres://... node scripts/migrate.mjs [--seed]
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../api/package.json'));
const { Client } = require('pg');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const url = process.env.DATABASE_URL;
if (!url) { console.error('Falta DATABASE_URL'); process.exit(1); }

const db = new Client({ connectionString: url });
await db.connect();
try {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const hechas = new Set((await db.query('SELECT version FROM schema_migrations')).rows.map(r => r.version));
  const dir = path.join(root, 'db/migrations');
  for (const f of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
    if (hechas.has(f)) continue;
    const sql = await readFile(path.join(dir, f), 'utf8');
    try {
      await db.query('BEGIN');
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [f]);
      await db.query('COMMIT');
      console.log('✔ migración aplicada:', f);
    } catch (e) {
      await db.query('ROLLBACK');
      console.error('✘ falló', f, '→', e.message);
      process.exit(1);
    }
  }
  if (process.argv.includes('--seed')) {
    await db.query(await readFile(path.join(root, 'db/seed/dev.sql'), 'utf8'));
    console.log('✔ seed de desarrollo aplicado');
  }
} finally {
  await db.end();
}
