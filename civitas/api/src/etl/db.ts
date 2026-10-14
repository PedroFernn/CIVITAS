import { createHash } from 'node:crypto';
import { createReadStream, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { MIGRATIONS } from './config';

export type Fila = Record<string, any>;

/** Conexión del ETL: un solo cliente con transacciones explícitas (equivale al commit por fase del ETL original). */
export class Conn {
  constructor(readonly client: Client) {}

  async query<T extends Fila = Fila>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.client.query(sql, params as any[])).rows as T[];
  }
  async one<T extends Fila = Fila>(sql: string, params: unknown[] = []): Promise<T> {
    return (await this.query<T>(sql, params))[0];
  }
  begin() { return this.client.query('BEGIN'); }
  commit() { return this.client.query('COMMIT'); }
  rollback() { return this.client.query('ROLLBACK'); }
  close() { return this.client.end(); }

  /** Ejecuta fn dentro de una transacción; confirma al terminar o revierte si falla. */
  async tx<T>(fn: () => Promise<T>): Promise<T> {
    await this.begin();
    try {
      const r = await fn();
      await this.commit();
      return r;
    } catch (e) {
      await this.rollback();
      throw e;
    }
  }
}

export async function conectar(url: string): Promise<Conn> {
  const client = new Client({ connectionString: url });
  await client.connect();
  return new Conn(client);
}

/** Borra TODO el esquema public. Sólo en hosts locales o con CIVITAS_ALLOW_RESET=1. */
export async function resetTotal(conn: Conn, url: string, permitido: boolean): Promise<void> {
  const host = new URL(url).hostname;
  if (!(permitido || ['localhost', '127.0.0.1', 'db', 'postgres'].includes(host))) {
    throw new Error(`--desde-cero rechazado para host '${host}'. Define CIVITAS_ALLOW_RESET=1 si es intencional.`);
  }
  await conn.tx(async () => {
    await conn.query('DROP SCHEMA public CASCADE');
    await conn.query('CREATE SCHEMA public');
  });
  console.warn('Esquema public recreado (desde cero)');
}

/** Aplica db/migrations/*.sql en orden, una sola vez cada una (checksum registrado). */
export async function migrar(conn: Conn, dir = MIGRATIONS): Promise<string[]> {
  await conn.query(
    'CREATE TABLE IF NOT EXISTS schema_migraciones (' +
      'version TEXT PRIMARY KEY, checksum TEXT NOT NULL, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now())',
  );
  const aplicadas = new Map((await conn.query('SELECT version, checksum FROM schema_migraciones')).map((r) => [r.version, r.checksum]));
  const nuevas: string[] = [];
  for (const nombre of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(path.join(dir, nombre), 'utf8');
    const chk = createHash('sha256').update(sql).digest('hex');
    if (aplicadas.has(nombre)) {
      if (aplicadas.get(nombre) !== chk) {
        throw new Error(`La migración ${nombre} ya aplicada fue modificada (checksum distinto). Crea una nueva.`);
      }
      continue;
    }
    await conn.tx(async () => {
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migraciones (version, checksum) VALUES ($1, $2)', [nombre, chk]);
    });
    nuevas.push(nombre);
    console.info(`Migración aplicada: ${nombre}`);
  }
  return nuevas;
}

export function sha256Archivo(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(file).on('data', (b) => h.update(b)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}
