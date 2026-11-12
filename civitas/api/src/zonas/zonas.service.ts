import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MIN_LISTADOS_ESTADISTICA } from '../renta/filtros-renta';
import { esNumeroCorto, escaparLike, ordenarPorRelevancia } from './busqueda';
import { armarComparacion, MIN_ZONAS_REFERENCIA } from './comparar';
import { FiltrosZonas, OrdenZonas } from './filtros-zonas';

const MIN = MIN_LISTADOS_ESTADISTICA; // constante del código (entero): se interpola, no viene del usuario
/** Una zona con menos de MIN listados aparece, pero sin mediana ni cuartiles (misma regla que /listados-renta/resumen-zonas); la mediana por m² exige MIN datos de m². */
const publicable = (col: string, n = 'v.n_listados') => `CASE WHEN COALESCE(${n},0) >= ${MIN} THEN ${col} END`;

const CAMPOS = `
  c.id, c.nombre, c.ciudad, c.tipo_unidad, c.clave_geo, c.es_piloto, c.cve_mun, c.localidad, c.poblacion, c.viviendas,
  a.area_km2::float AS area_km2,
  COALESCE(a.num_comercios,0)::int AS num_comercios,
  COALESCE(a.num_comercios_mayoreo,0)::int AS num_comercios_mayoreo,
  COALESCE(a.num_comercios_menudeo,0)::int AS num_comercios_menudeo,
  COALESCE(a.num_paradas,0)::int AS num_paradas,
  a.densidad_comercios_km2::float AS densidad_comercios_km2,
  (c.poblacion / NULLIF(a.area_km2, 0))::float AS densidad_hab_km2,
  (CASE WHEN c.poblacion > 0 THEN round(COALESCE(a.num_comercios,0) * 1000.0 / c.poblacion, 1) END)::float AS comercios_por_1000_hab,
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
    // mismo criterio que normalizar(): sin acentos y en minúsculas, sobre nombre + CVEGEO + municipio + localidad
    const sinAcentos = (x: string) => `translate(lower(${x}), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')`;
    const patrones = (ts: string[]) => p(ts.map((t) => `%${escaparLike(t)}%`));
    const generales = f.q.filter((t) => !esNumeroCorto(t)), numeros = f.q.filter(esNumeroCorto);
    if (generales.length) w.push(`${sinAcentos(`c.nombre || ' ' || COALESCE(c.clave_geo,'') || ' ' || COALESCE(c.ciudad,'') || ' ' || COALESCE(c.localidad,'')`)} LIKE ALL (${patrones(generales)}::text[])`);
    if (numeros.length) w.push(`${sinAcentos('c.nombre')} LIKE ALL (${patrones(numeros)}::text[])`);
  }
  if (f.conPrecio) w.push(`COALESCE(v.n_listados,0) >= ${MIN}`);
  if (f.minRenta !== undefined) w.push(`v.renta_mediana >= ${p(f.minRenta)}`);
  if (f.maxRenta !== undefined) w.push(`v.renta_mediana <= ${p(f.maxRenta)}`);
  if (f.minParadas !== undefined) w.push(`COALESCE(a.num_paradas,0) >= ${p(f.minParadas)}`);
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
      const rows = await this.db.query<any>(`SELECT ${CAMPOS} ${DESDE} ${w} LIMIT 3000`, params);
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
    const rows = await this.db.query<any>(`SELECT ${CAMPOS} ${DESDE} ${w} ORDER BY ${ORDEN_SQL[f.q.length ? 'nombre' : 'listados']} LIMIT 3000`, params);
    const orden = f.q.length ? ordenarPorRelevancia(rows, f.q) : rows;
    return { q: f.q.join(' '), sugeridas: f.q.length === 0, total: orden.length, items: orden.slice(0, f.limit) };
  }

  /** FeatureCollection para el mapa Leaflet: mismas propiedades que la lista, sin paginar. */
  async geojson(f: FiltrosZonas) {
    const params: unknown[] = [];
    const w = where(f, params);
    const orden = f.orden === 'relevancia' ? 'nombre' : f.orden;
    params.push(f.limit, f.simplificar ?? 0.0002);
    // Con todo el estado (2,500 zonas) el contorno completo pesa megas: se simplifica en PostGIS (conserva la topología) y se recorta a 5 decimales (~1 m).
    const rows = await this.db.query<any>(
      `SELECT ${CAMPOS}, ST_AsGeoJSON(CASE WHEN $${params.length}::float8 > 0 THEN ST_SimplifyPreserveTopology(c.geom, $${params.length}::float8) ELSE c.geom END, 5)::json AS geometry
       ${DESDE} ${w} ORDER BY ${ORDEN_SQL[orden]} LIMIT $${params.length - 1}`, params);
    return {
      type: 'FeatureCollection',
      min_listados_estadistica: MIN,
      features: rows.map(({ geometry, ...props }) => ({ type: 'Feature', id: props.id, properties: props, geometry })),
    };
  }

  /** Ficha de zona (P-03): atributos, mediana por m² (con la regla de supresión), referencia de la ciudad, trazabilidad y últimos listados. */
  async detalle(id: string) {
    const [z] = await this.db.query<any>(
      `SELECT ${CAMPOS}, c.cve_ent, cd.fuente_clave AS fuente_geom, cd.modo AS modo_datos, cd.iniciada_en AS fecha_carga,
              ST_AsGeoJSON(c.geom, 6)::json AS geometry
       ${DESDE} LEFT JOIN cargas_datos cd ON cd.id = c.carga_id WHERE c.id = $1`, [id]);
    if (!z) throw new NotFoundException('Zona no encontrada');
    const { geometry, fuente_geom, modo_datos, fecha_carga, cve_ent, cve_mun, ...zona } = z;

    const [porTipo, [refs], [pos], recientes, [fresc], [anom], [mun]] = await Promise.all([
      this.db.query<any>(
        `SELECT tipo_inmueble AS tipo, count(*)::int AS n,
                CASE WHEN count(*) >= ${MIN} THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY precio_mxn)::float END AS renta_mediana,
                CASE WHEN count(precio_m2) >= ${MIN} THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY precio_m2)::float END AS precio_m2_mediano
         FROM listados_renta WHERE zona_id = $1 GROUP BY tipo_inmueble ORDER BY n DESC, tipo_inmueble`, [id]),
      // referencia de precio: el municipio de la zona y, de respaldo, todo el estado (un municipio chico no sirve de referencia)
      this.db.query<any>(
        `SELECT (count(*) FILTER (WHERE cz.ciudad = $1))::int AS m_listados, (count(DISTINCT l.zona_id) FILTER (WHERE cz.ciudad = $1))::int AS m_zonas,
                (percentile_cont(0.5) WITHIN GROUP (ORDER BY l.precio_mxn) FILTER (WHERE cz.ciudad = $1))::float AS m_renta,
                (percentile_cont(0.5) WITHIN GROUP (ORDER BY l.precio_m2) FILTER (WHERE cz.ciudad = $1))::float AS m_m2,
                count(*)::int AS e_listados, count(DISTINCT l.zona_id)::int AS e_zonas,
                (percentile_cont(0.5) WITHIN GROUP (ORDER BY l.precio_mxn))::float AS e_renta,
                (percentile_cont(0.5) WITHIN GROUP (ORDER BY l.precio_m2))::float AS e_m2
         FROM listados_renta l JOIN colonias cz ON cz.id = l.zona_id`, [zona.ciudad]),
      zona.precio_m2_mediano === null ? Promise.resolve([null]) : this.db.query<any>(
        `SELECT (count(*) FILTER (WHERE cz.ciudad = $2 AND v.precio_m2_mediano > $1) + 1)::int AS lugar_m, (count(*) FILTER (WHERE cz.ciudad = $2))::int AS de_m,
                (count(*) FILTER (WHERE v.precio_m2_mediano > $1) + 1)::int AS lugar_e, count(*)::int AS de_e
         FROM v_zona_precios v JOIN colonias cz ON cz.id = v.zona_id WHERE v.n_precio_m2 >= ${MIN}`, [zona.precio_m2_mediano, zona.ciudad]),
      this.db.query<any>(
        `SELECT l.id::text AS id, l.tipo_inmueble, l.precio_mxn::float AS precio_mxn, l.superficie_m2::float AS superficie_m2,
                l.recamaras, l.precio_m2::float AS precio_m2, to_char(l.publicado_en, 'YYYY-MM-DD') AS publicado_en,
                a.etiqueta AS anomalia, a.z_robusto::float AS anomalia_z, a.nivel AS anomalia_nivel
         FROM listados_renta l LEFT JOIN listados_anomalias a ON a.listado_id = l.id
         WHERE l.zona_id = $1 ORDER BY l.publicado_en DESC NULLS LAST, l.id DESC LIMIT 6`, [id]),
      this.db.query<any>(
        `SELECT (SELECT max(l.actualizado_en) FROM listados_renta l WHERE l.zona_id = $1) AS precios_actualizados_en,
                (SELECT max(finalizada_en) FROM cargas_datos WHERE estado = 'ok' AND comando LIKE '%recaptura%') AS ultima_recaptura_en`, [id]),
      this.db.query<any>(
        `SELECT (count(*) FILTER (WHERE a.etiqueta = 'inflado'))::int AS inflados, (count(*) FILTER (WHERE a.etiqueta = 'subprecio'))::int AS subprecio,
                (count(*) FILTER (WHERE a.etiqueta = 'justo'))::int AS justos
         FROM listados_anomalias a JOIN listados_renta l ON l.id = a.listado_id WHERE l.zona_id = $1`, [id]),
      this.db.query<any>(
        `SELECT m.nombre, m.cve_mun, m.poblacion, m.viviendas, (SELECT count(*)::int FROM colonias WHERE cve_ent = m.cve_ent AND cve_mun = m.cve_mun) AS n_zonas
         FROM municipios m WHERE m.cve_ent = $1 AND m.cve_mun = $2`, [cve_ent, cve_mun]),
    ]);

    const local = !!refs && refs.m_zonas >= MIN_ZONAS_REFERENCIA;
    const referencia = !refs || !refs.e_listados ? null : local
      ? { ciudad: zona.ciudad, ambito: 'municipio', n_listados: refs.m_listados, zonas: refs.m_zonas, renta_mediana: refs.m_renta, precio_m2_mediano: refs.m_m2 }
      : { ciudad: 'todo el estado', ambito: 'estado', n_listados: refs.e_listados, zonas: refs.e_zonas, renta_mediana: refs.e_renta, precio_m2_mediano: refs.e_m2 };
    const posicion = !pos ? null : pos.de_m >= MIN_ZONAS_REFERENCIA ? { lugar: pos.lugar_m, de: pos.de_m, ambito: 'municipio' } : { lugar: pos.lugar_e, de: pos.de_e, ambito: 'estado' };

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
        posicion_precio_m2: posicion,
        anomalias: anom ?? { inflados: 0, subprecio: 0, justos: 0 },
      },
      municipio: mun ?? null,
      ciudad_referencia: referencia,
      trazabilidad: {
        fuente_geom, modo_datos, fecha_carga,
        precios_actualizados_en: fresc?.precios_actualizados_en ?? null,
        ultima_recaptura_en: fresc?.ultima_recaptura_en ?? null,
      },
      listados_recientes: recientes,
    };
  }

  /**
   * Comparador (P-07, RF-1.4): hasta 3 zonas lado a lado, en el orden pedido. Misma regla de supresión que la ficha:
   * una zona con menos de MIN listados aparece, pero sin mediana ni cuartiles (y sin diferencia contra la ciudad).
   */
  async comparar(ids: string[]) {
    const filas = await this.db.query<any>(
      `SELECT ${CAMPOS}, ST_AsGeoJSON(ST_SimplifyPreserveTopology(c.geom, 0.00005), 5)::json AS geometry,
              CASE WHEN pos.de_m >= ${MIN_ZONAS_REFERENCIA} THEN pos.lugar_m ELSE pos.lugar_e END AS lugar,
              CASE WHEN pos.de_m >= ${MIN_ZONAS_REFERENCIA} THEN pos.de_m ELSE pos.de_e END AS de,
              CASE WHEN pos.de_m >= ${MIN_ZONAS_REFERENCIA} THEN 'municipio' ELSE 'estado' END AS ambito_pos
       ${DESDE}
       LEFT JOIN LATERAL (
         SELECT (count(*) FILTER (WHERE cz.ciudad = c.ciudad AND v2.precio_m2_mediano > v.precio_m2_mediano) + 1)::int AS lugar_m,
                (count(*) FILTER (WHERE cz.ciudad = c.ciudad))::int AS de_m,
                (count(*) FILTER (WHERE v2.precio_m2_mediano > v.precio_m2_mediano) + 1)::int AS lugar_e, count(*)::int AS de_e
         FROM v_zona_precios v2 JOIN colonias cz ON cz.id = v2.zona_id WHERE v2.n_precio_m2 >= ${MIN}
       ) pos ON v.n_precio_m2 >= ${MIN}
       WHERE c.id = ANY($1::uuid[])`, [ids]);
    const pedido = new Map(ids.map((id, i) => [id.toLowerCase(), i]));
    const hallados = new Set(filas.map((f) => String(f.id).toLowerCase()));
    const falta = ids.find((id) => !hallados.has(id.toLowerCase()));
    if (falta) throw new NotFoundException(`Zona no encontrada: ${falta}`);
    filas.sort((a, b) => pedido.get(String(a.id).toLowerCase())! - pedido.get(String(b.id).toLowerCase())!);

    const ciudades = await this.db.query<any>(
      `SELECT cz.ciudad, count(*)::int AS n_listados, count(DISTINCT l.zona_id)::int AS zonas,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY l.precio_mxn)::float AS renta_mediana,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY l.precio_m2)::float AS precio_m2_mediano
       FROM listados_renta l JOIN colonias cz ON cz.id = l.zona_id WHERE cz.ciudad = ANY($1::text[]) GROUP BY cz.ciudad`,
      [[...new Set(filas.map((f) => f.ciudad as string))]]);
    const [estado] = await this.db.query<any>(
      `SELECT 'todo el estado' AS ciudad, count(*)::int AS n_listados, count(DISTINCT zona_id)::int AS zonas,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY precio_mxn)::float AS renta_mediana,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY precio_m2)::float AS precio_m2_mediano
       FROM listados_renta WHERE zona_id IS NOT NULL`);
    return armarComparacion(filas, ciudades, estado?.n_listados ? estado : null, MIN);
  }

  async ultimaValidacion() {
    const [r] = await this.db.query<any>('SELECT id, ejecutada_en, aprobada, modo, resultados FROM mvp4_validaciones ORDER BY id DESC LIMIT 1');
    return r ?? null;
  }
}


