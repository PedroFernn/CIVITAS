import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EntrevistaEntrada, resumirEntrevistas } from './validacion-entrevistas';

const CAMPOS = `e.id::text AS id, e.tipo, e.alias, to_char(e.realizada_en, 'YYYY-MM-DD') AS realizada_en, e.modalidad, e.duracion_min,
  e.zona_id::text AS zona_id, c.nombre AS zona_nombre, e.renta_actual_mxn, e.renta_justa_mxn, e.acepta_pagar, e.monto_dispuesto_mxn,
  e.notas, e.creada_por, e.creada_en, e.actualizada_en`;

const VALORES = (e: EntrevistaEntrada) => [
  e.tipo, e.alias, e.realizada_en, e.modalidad, e.duracion_min, e.zona_id, e.renta_actual_mxn, e.renta_justa_mxn, e.acepta_pagar, e.monto_dispuesto_mxn, e.notas,
];

/** MVP-5 · entrevistas de precio (negocio). Solo las usa el rol administrador; no guardan datos personales. */
@Injectable()
export class EntrevistasService {
  constructor(private readonly db: DatabaseService) {}

  async listar() {
    const items = await this.db.query<any>(
      `SELECT ${CAMPOS} FROM entrevistas_precio e LEFT JOIN colonias c ON c.id = e.zona_id ORDER BY e.realizada_en DESC, e.creada_en DESC`);
    return { items, resumen: resumirEntrevistas(items) };
  }

  async crear(e: EntrevistaEntrada, usuario: string) {
    try {
      const [r] = await this.db.query<any>(
        `INSERT INTO entrevistas_precio (tipo, alias, realizada_en, modalidad, duracion_min, zona_id, renta_actual_mxn, renta_justa_mxn, acepta_pagar, monto_dispuesto_mxn, notas, creada_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id::text AS id`, [...VALORES(e), usuario]);
      return { id: r.id };
    } catch (err) {
      throw this.traducir(err);
    }
  }

  async actualizar(id: string, e: EntrevistaEntrada) {
    try {
      const filas = await this.db.query<any>(
        `UPDATE entrevistas_precio SET tipo=$2, alias=$3, realizada_en=$4, modalidad=$5, duracion_min=$6, zona_id=$7, renta_actual_mxn=$8, renta_justa_mxn=$9,
                acepta_pagar=$10, monto_dispuesto_mxn=$11, notas=$12, actualizada_en=now()
         WHERE id = $1 RETURNING id::text AS id`, [id, ...VALORES(e)]);
      if (!filas.length) throw new NotFoundException('Entrevista no encontrada');
      return { id: filas[0].id };
    } catch (err) {
      throw this.traducir(err);
    }
  }

  async eliminar(id: string) {
    const filas = await this.db.query<any>('DELETE FROM entrevistas_precio WHERE id = $1 RETURNING id', [id]);
    if (!filas.length) throw new NotFoundException('Entrevista no encontrada');
  }

  async ultimaValidacion() {
    const [r] = await this.db.query<any>('SELECT id, ejecutada_en, aprobada, modo, resultados FROM mvp5_validaciones ORDER BY id DESC LIMIT 1');
    return r ?? null;
  }

  private traducir(err: unknown) {
    if ((err as any)?.code === '23503') return new BadRequestException('zona_id no corresponde a ninguna zona');
    return err as Error;
  }
}
