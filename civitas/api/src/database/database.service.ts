import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';

/**
 * Acceso a PostgreSQL/PostGIS. En MVP-2 la API es de solo lectura sobre datos abiertos agregados.
 * (Cuando llegue auth, ver ARQUITECTURA_TECNICA.md §3.2: propagar el JWT del usuario para respetar RLS.)
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://civitas:civitas@localhost:5432/civitas',
    max: Number(process.env.PG_POOL_MAX ?? 10),
    statement_timeout: 10_000,
  });

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.pool.query<T>(sql, params as any[]);
    return res.rows;
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
