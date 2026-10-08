import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class Db implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  query<T = any>(text: string, params: unknown[] = []) {
    return this.pool.query(text, params).then(r => r.rows as T[]);
  }
  onModuleDestroy() { return this.pool.end(); }
}
