import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MIN_LISTADOS_ESTADISTICA } from '../renta/filtros-renta';
import { esNumeroCorto, escaparLike, ordenarPorRelevancia } from './busqueda';
import { FiltrosZonas, OrdenZonas } from './filtros-zonas';

const MIN = MIN_LISTADOS_ESTADISTICA; // constante del código (entero): se interpola, no viene del usuario
/** Una zona con menos de MIN listados aparece, pero sin mediana ni cuartiles (misma regla que /listados-renta/resumen-zonas); la mediana por m² exige MIN datos de m². */
const publicable = (col: string, n = 'v.n_listados') => `CASE WHEN COALESCE(${n},0) >= ${MIN} THEN ${col} END`;

const CAMPOS = `
  c.id, c.nombre, c.ciudad, c.tipo_unidad, c.clave_geo, c.es_piloto,
  a.area_km2::float AS area_km2,
  COALESCE(a.num_comercios,0)::int AS num_comercios,
  COALESCE(a.num_comercios_mayoreo,0)::int AS num_comercios_mayoreo,
  COALESCE(a.num_comercios_menudeo,0)::int AS num_comercios_menudeo,
  COALESCE(a.num_paradas,0)::int AS num_paradas,
  a.densidad_comercios_km2::float AS densidad_comercios_km2,
  COALESCE(v.n_listados,0)::int AS n_listados,
  COALESCE(v.n_precio_m2,0)::int AS n_precio_m2,
  (COALESCE(v.n_listados,0) < ${MIN}) AS estadistica_suprimida,
  ${publicable('v.renta_mediana')}::float AS renta_mediana,
  ${publicable('v.renta_p25')}::float AS renta_p25,
  ${publicable('v.renta_p75')}::float AS renta_p75,
  ${publicable('v.precio_m2_mediano', 'v.n_precio_m2')}::float AS precio_m2_mediano`;

const DESDE = `FROM colonias c
  LEFT JOIN zona_atributos a ON a.zona_id = c.id
  LEFT JOIN v_zona_precios v ON v.zona_id = c.id`;

const ORDEN_SQL: Record<Exclude<OrdenZonas, 'relevancia'>, string> = {
  nombre: 'c.nombre ASC, c.id',
  renta: `${publicable('v.renta_mediana')} DESC NULLS LAST, c.nombre, c.id`,
  precio_m2: `${publicable('v.precio_m2_mediano', 'v.n_precio_m2')} DESC NULLS LAST, c.nombre, c.id`,
  comercios: 'COALESCE(a.num_comercios,0) DESC, c.nombre, c.id',
  paradas: 'COALESCE(a.num_paradas,0) DESC, c.nombre, c.id',
  listados: 'COALESCE(v.n_listados,0) DESC, c.nombre, c.id',
};

function where(f: Omit<FiltrosZonas, 'orden' | 'limit' | 'offset'>, params: unknown[]): string {
  const w: string[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  if (f.piloto) w.push('c.es_piloto');
  if (f.ciudad) w.push(`c.ciudad ILIKE ${p(f.ciudad)}`);
  if (f.q.length) {
    // mismo criterio que normalizar(): sin acentos y en minúsculas, sobre nombre + CVEGEO + ciudad
    const sinAcentos = (x: string) => `translate(lower(${x}), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')`;
    const patrones = (ts: string[]) => p(ts.map((t) => `%${escaparLike(t)}%`));
    const generales = f.q.filter((t) => !esNumeroCorto(t)), numeros = f.q.filter(esNumeroCorto);
    if (generales.length) w.push(`${sinAcentos(`c.nombre || ' ' || COALESCE(c.clave_geo,'') || ' ' || COALESCE(c.ciudad,'')`)} LIKE ALL (${patrones(generales)}::text[])`);
    if (numeros.length) w.push(`${sinAcentos('c.nombre')} LIKE ALL (${patrones(numeros)}::text[])`);
  }
  if (f.conPrecio) w.push(`COALESCE(v.n_listados,0) >= ${MIN}`);
  if (f.minRenta !== undefined) w.push(`v.renta_mediana >= ${p(f.minRenta)}`);
  if (f.maxRenta !== undefined) w.push(`v.renta_mediana <= ${p(f.maxRenta)}`);
  return w.length ? `WHERE ${w.join(' AND ')}` : '';
}

const quitarTotal = ({ total, ...r }: any) => r;

@Injectable()
export class ZonasService {
  constructor(private readonly db: DatabaseService) {}

  /** Lista paginada (P-02). Con q y orden=relevancia se ordena por coincidencia (ver busqueda.ts). */
  async listar(f: FiltrosZonas) {
    const params: unknown[] = [];
    const w = where(f, params);
    if (f.orden === 'relevancia') {
      const rows = await this.db.query<any>(`SELECT ${CAMPOS} ${DESDE} ${w} LIMIT 500`, params);
      const orden = ordenarPorRelevancia(rows, f.q);
      return { total: orden.length, limit: f.limit, offset: f.offset, min_listados_estadistica: MIN, items: orden.slice(f.offset, f.offset + f.limit) };
    }
    params.push(f.limit, f.offset);
    const rows = await this.db.query<any>(
      `SELECT ${CAMPOS}, count(*) OVER()::int AS total ${DESDE} ${w}
       ORDER BY ${ORDEN_SQL[f.orden]} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { total: rows[0]?.total ?? 0, limit: f.limit, offset: f.offset, min_listados_estadistica: MIN, items: rows.map(quitarTotal) };
  }

  /** Autocompletado de la barra de la navbar. Sin texto: las zonas con más listados como sugerencia. */
  async buscar(f: FiltrosZonas) {
    const params: unknown[] = [];
    const w = where({ ...f, conPrecio: false }, params);
    const rows = await this.db.query<any>(`SELECT ${CAMPOS} ${DESDE} ${w} ORDER BY ${ORDEN_SQL[f.q.length ? 'nombre' : 'listados']} LIMIT 500`, params);
    const orden = f.q.length ? ordenarPorRelevancia(rows, f.q) : rows;
    return { q: f.q.join(' '), sugeridas: f.q.length === 0, total: orden.length, items: orden.slice(0, f.limit) };
  }

  /** FeatureCollection para el mapa Leaflet: mismas propiedades que la lista, sin paginar. */
  async geojson(f: FiltrosZonas) {
    const params: unknown[] = [];
    const w = where(f, params);
    const orden = f.orden === 'relevancia' ? 'nombre' : f.orden;
    params.push(f.limit);
    const rows = await this.db.query<any>(
      `SELECT ${CAMPOS}, ST_AsGeoJSON(c.geom, 6)::json AS geometry ${DESDE} ${w} ORDER BY ${ORDEN_SQL[orden]} LIMIT $${params.length}`, params);
    return {
      type: 'FeatureCollection',
      min_listados_estadistica: MIN,
      features: rows.map(({ geometry, ...props }) => ({ type: 'Feature', id: props.id, properties: props, geometry })),
    };
  }

  /** Ficha de zona (P-03): atributos, mediana por m² (con la regla de supresión), referencia de la ciudad, trazabilidad y últimos listados. */
  async detalle(id: string) {
    const [z] = await this.db.query<any>(
      `SELECT ${CAMPOS}, c.cve_ent, c.cve_mun, cd.fuente_clave AS fuente_geom, cd.modo AS modo_datos, cd.iniciada_en AS fecha_carga,
              ST_AsGeoJSON(c.geom, 6)::json AS geometry
       ${DESDE} LEFT JOIN cargas_datos cd ON cd.id = c.carga_id WHERE c.id = $1`, [id]);
    if (!z) throw new NotFoundException('Zona no encontrada');
    const { geometry, fuente_geom, modo_datos, fecha_carga, cve_ent, cve_mun, ...zona } = z;

    const [porTipo, [ciudad], [pos], recientes, [fresc]] = await Promise.all([
      this.db.query<any>(
        `SELECT tipo_inmueble AS tipo, count(*)::int AS n,
                CASE WHEN count(*) >= ${MIN} THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY precio_mxn)::float END AS renta_mediana,
                CASE WHEN count(precio_m2) >= ${MIN} THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY precio_m2)::float END AS precio_m2_mediano
         FROM listados_renta WHERE zona_id = $1 GROUP BY tipo_inmueble ORDER BY n DESC, tipo_inmueble`, [id]),
      this.db.query<any>(
        `SELECT count(*)::int AS n_listados, count(DISTINCT l.zona_id)::int AS zonas,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY l.precio_mxn)::float AS renta_mediana,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY l.precio_m2)::float AS precio_m2_mediano
         FROM listados_renta l JOIN colonias cz ON cz.id = l.zona_id WHERE cz.ciudad = $1`, [zona.ciudad]),
      zona.precio_m2_mediano === null ? Promise.resolve([null]) : this.db.query<any>(
        `SELECT (count(*) FILTER (WHERE precio_m2_mediano > $1) + 1)::int AS lugar, count(*)::int AS de
         FROM v_zona_precios WHERE n_precio_m2 >= ${MIN}`, [zona.precio_m2_mediano]),
      this.db.query<any>(
        `SELECT l.id::text AS id, l.tipo_inmueble, l.precio_mxn::float AS precio_mxn, l.superficie_m2::float AS superficie_m2,
                l.recamaras, l.precio_m2::float AS precio_m2, to_char(l.publicado_en, 'YYYY-MM-DD') AS publicado_en
         FROM listados_renta l WHERE l.zona_id = $1 ORDER BY l.publicado_en DESC NULLS LAST, l.id DESC LIMIT 6`, [id]),
      this.db.query<any>(
        `SELECT (SELECT max(l.actualizado_en) FROM listados_renta l WHERE l.zona_id = $1) AS precios_actualizados_en,
                (SELECT max(finalizada_en) FROM cargas_datos WHERE estado = 'ok' AND comando LIKE '%recaptura%') AS ultima_recaptura_en`, [id]),
    ]);

    return {
      ...zona,
      cve_ent, cve_mun,
      geometry,
      renta: {
        n_listados: zona.n_listados,
        estadistica_suprimida: zona.estadistica_suprimida,
        min_listados_estadistica: MIN,
        mediana: zona.renta_mediana, p25: zona.renta_p25, p75: zona.renta_p75, precio_m2_mediano: zona.precio_m2_mediano,
        por_tipo: porTipo,
        posicion_precio_m2: pos ? { lugar: pos.lugar, de: pos.de } : null,
      },
      ciudad_referencia: ciudad ? { ciudad: zona.ciudad, ...ciudad } : null,
      trazabilidad: {
        fuente_geom, modo_datos, fecha_carga,
        precios_actualizados_en: fresc?.precios_actualizados_en ?? null,
        ultima_recaptura_en: fresc?.ultima_recaptura_en ?? null,
      },
      listados_recientes: recientes,
    };
  }

  async ultimaValidacion() {
    const [r] = await this.db.query<any>('SELECT id, ejecutada_en, aprobada, modo, resultados FROM mvp4_validaciones ORDER BY id DESC LIMIT 1');
    return r ?? null;
  }
}
