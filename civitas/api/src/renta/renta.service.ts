import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { esNumeroCorto, escaparLike } from '../zonas/busqueda';
import { FiltrosListados, MIN_LISTADOS_ESTADISTICA, OrdenListados } from './filtros-renta';

const ORDEN_SQL: Record<OrdenListados, string> = {
  reciente: 'l.publicado_en DESC NULLS LAST, l.id DESC',
  antiguo: 'l.publicado_en ASC NULLS LAST, l.id',
  precio: 'l.precio_mxn DESC, l.id',
  barato: 'l.precio_mxn ASC, l.id',
  precio_m2: 'l.precio_m2 DESC NULLS LAST, l.id',
  superficie: 'l.superficie_m2 DESC NULLS LAST, l.id',
  recamaras: 'l.recamaras DESC NULLS LAST, l.id',
};

// Solo datos del inmueble y su procedencia: la tabla no tiene teléfono, anunciante ni texto libre (RNF Privacidad).
const CAMPOS = `
  l.id::text AS id, l.fuente_clave, l.id_fuente, l.url, l.tipo_inmueble,
  l.precio_mxn::float AS precio_mxn, l.superficie_m2::float AS superficie_m2, l.recamaras, l.precio_m2::float AS precio_m2,
  to_char(l.publicado_en, 'YYYY-MM-DD') AS publicado_en,
  ST_Y(l.geom) AS lat, ST_X(l.geom) AS lon,
  l.zona_id, z.nombre AS zona_nombre, z.clave_geo AS zona_clave_geo, z.ciudad AS zona_municipio, cd.modo AS modo_datos,
  a.etiqueta AS anomalia, a.z_robusto::float AS anomalia_z`;

const DESDE = `FROM listados_renta l
  LEFT JOIN colonias z ON z.id = l.zona_id
  LEFT JOIN cargas_datos cd ON cd.id = l.carga_id
  LEFT JOIN listados_anomalias a ON a.listado_id = l.id`;

function where(f: FiltrosListados, params: unknown[]): string {
  const w: string[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  if (f.zonaId) w.push(`l.zona_id = ${p(f.zonaId)}`);
  if (f.conZona !== undefined) w.push(f.conZona ? 'l.zona_id IS NOT NULL' : 'l.zona_id IS NULL');
  if (f.tipo) w.push(`l.tipo_inmueble = ${p(f.tipo)}`);
  if (f.anomalia) w.push(`a.etiqueta = ${p(f.anomalia)}`);
  if (f.recamaras !== undefined) w.push(`l.recamaras = ${p(f.recamaras)}`);
  if (f.minPrecio !== undefined) w.push(`l.precio_mxn >= ${p(f.minPrecio)}`);
  if (f.maxPrecio !== undefined) w.push(`l.precio_mxn <= ${p(f.maxPrecio)}`);
  if (f.q.length) {
    // Mismo criterio que la búsqueda de zonas: sin acentos ni mayúsculas, y todos los términos deben coincidir.
    // Un número de 1–3 dígitos solo se busca en el nombre de la zona (en el id del anuncio coincidiría con casi todo).
    const sinAcentos = (x: string) => `translate(lower(${x}), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')`;
    const patrones = (ts: string[]) => p(ts.map((t) => `%${escaparLike(t)}%`));
    const generales = f.q.filter((t) => !esNumeroCorto(t)), numeros = f.q.filter(esNumeroCorto);
    if (generales.length) {
      w.push(`${sinAcentos(`COALESCE(z.nombre,'') || ' ' || COALESCE(z.ciudad,'') || ' ' || COALESCE(z.clave_geo,'') || ' ' || COALESCE(l.id_fuente,'') || ' ' || l.tipo_inmueble`)} LIKE ALL (${patrones(generales)}::text[])`);
    }
    if (numeros.length) w.push(`${sinAcentos(`COALESCE(z.nombre,'')`)} LIKE ALL (${patrones(numeros)}::text[])`);
  }
  return w.length ? `WHERE ${w.join(' AND ')}` : '';
}

@Injectable()
export class RentaService {
  constructor(private readonly db: DatabaseService) {}

  async listar(f: FiltrosListados) {
    const params: unknown[] = [];
    const w = where(f, params);
    params.push(f.limit, f.offset);
    const rows = await this.db.query<any>(
      `SELECT ${CAMPOS}, count(*) OVER()::int AS total ${DESDE} ${w}
       ORDER BY ${ORDEN_SQL[f.orden]} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { total: rows[0]?.total ?? 0, limit: f.limit, offset: f.offset, items: rows.map(({ total, ...r }) => r) };
  }

  /** Resumen por zona. Con menos de MIN_LISTADOS_ESTADISTICA listados la zona aparece, pero sin medianas ni cuartiles. */
  async resumenZonas(limit: number) {
    const rows = await this.db.query<any>(
      `SELECT r.zona_id, r.nombre, c.ciudad AS municipio, r.clave_geo, r.es_piloto, r.n_listados, (r.n_listados < $1) AS estadistica_suprimida,
              CASE WHEN r.n_listados >= $1 THEN r.renta_mediana::float END AS renta_mediana,
              CASE WHEN r.n_listados >= $1 THEN r.renta_p25::float END AS renta_p25,
              CASE WHEN r.n_listados >= $1 THEN r.renta_p75::float END AS renta_p75,
              CASE WHEN r.n_listados >= $1 THEN r.precio_m2_mediano::float END AS precio_m2_mediano,
              count(*) OVER()::int AS total
       FROM v_renta_zona r JOIN colonias c ON c.id = r.zona_id ORDER BY r.n_listados DESC, r.nombre LIMIT $2`, [MIN_LISTADOS_ESTADISTICA, limit]);
    return { total: rows[0]?.total ?? 0, min_listados_estadistica: MIN_LISTADOS_ESTADISTICA, items: rows.map(({ total, ...r }) => r) };
  }

  async ultimoReporte() {
    const [r] = await this.db.query<any>('SELECT resumen FROM reportes_calidad ORDER BY carga_id DESC LIMIT 1');
    return r?.resumen ?? null;
  }

  async ultimaValidacion() {
    const [r] = await this.db.query<any>('SELECT id, ejecutada_en, aprobada, modo, resultados FROM mvp3_validaciones ORDER BY id DESC LIMIT 1');
    return r ?? null;
  }
}


