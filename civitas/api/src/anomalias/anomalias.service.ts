import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** MVP-6 · H6: lectura del motor de anomalías (el cálculo vive en el ETL: `etl mvp6`). */
@Injectable()
export class AnomaliasService {
  constructor(private readonly db: DatabaseService) {}

  async resumen() {
    const [filas, niveles, meta, [val]] = await Promise.all([
      this.db.query<any>('SELECT etiqueta, count(*)::int AS n FROM listados_anomalias GROUP BY etiqueta'),
      this.db.query<any>('SELECT nivel, count(*)::int AS n FROM listados_anomalias GROUP BY nivel'),
      this.db.query<any>('SELECT max(umbral)::float AS umbral, max(calculado_en) AS calculado_en, count(*)::int AS total FROM listados_anomalias'),
      this.db.query<any>('SELECT id, ejecutada_en, aprobada, modo, resultados FROM mvp6_validaciones ORDER BY id DESC LIMIT 1'),
    ]);
    const total = meta[0]?.total ?? 0;
    if (!total) return null;
    const conteo = { justo: 0, inflado: 0, subprecio: 0, ...Object.fromEntries(filas.map((f) => [f.etiqueta, f.n])) };
    return {
      total, conteo, niveles: Object.fromEntries(niveles.map((f) => [f.nivel, f.n])),
      umbral: meta[0].umbral, calculado_en: meta[0].calculado_en, validacion: val ?? null,
    };
  }
}
