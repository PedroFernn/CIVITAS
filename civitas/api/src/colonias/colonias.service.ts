import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FiltrosColonias } from './filtros';

const ORDEN_SQL: Record<FiltrosColonias['orden'], string> = {
  nombre: 'c.nombre ASC, c.id',
  comercios: 'COALESCE(a.num_comercios,0) DESC, c.id',
  paradas: 'COALESCE(a.num_paradas,0) DESC, c.id',
};

// Campos comunes (RF-1.1) + origen del dato (RNF trazabilidad)
const CAMPOS = `
  c.id, c.nombre, c.ciudad, c.tipo_unidad, c.clave_geo, c.estado, c.es_piloto,
  a.area_km2::float AS area_km2,
  COALESCE(a.num_comercios,0)::int AS num_comercios,
  COALESCE(a.num_comercios_mayoreo,0)::int AS num_comercios_mayoreo,
  COALESCE(a.num_comercios_menudeo,0)::int AS num_comercios_menudeo,
  COALESCE(a.num_unidades_economicas,0)::int AS num_unidades_economicas,
  COALESCE(a.num_paradas,0)::int AS num_paradas,
  a.densidad_comercios_km2::float AS densidad_comercios_km2,
  a.densidad_paradas_km2::float AS densidad_paradas_km2,
  cd.fuente_clave AS fuente_geom, cd.modo AS modo_datos, cd.iniciada_en AS fecha_carga`;

const DESDE = `FROM colonias c
  LEFT JOIN zona_atributos a ON a.zona_id = c.id
  LEFT JOIN cargas_datos cd ON cd.id = c.carga_id`;

function where(f: FiltrosColonias, params: unknown[]): string {
  const w: string[] = [];
  if (f.piloto) w.push('c.es_piloto');
  if (f.ciudad) { params.push(f.ciudad); w.push(`c.ciudad ILIKE $${params.length}`); }
  if (f.minComercios !== undefined) { params.push(f.minComercios); w.push(`COALESCE(a.num_comercios,0) >= $${params.length}`); }
  if (f.minParadas !== undefined) { params.push(f.minParadas); w.push(`COALESCE(a.num_paradas,0) >= $${params.length}`); }
  if (f.bbox) {
    const base = params.length;
    params.push(...f.bbox);
    w.push(`c.geom && ST_MakeEnvelope($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, 4326)`);
  }
  return w.length ? `WHERE ${w.join(' AND ')}` : '';
}

@Injectable()
export class ColoniasService {
  constructor(private readonly db: DatabaseService) {}

  async listar(f: FiltrosColonias) {
    const params: unknown[] = [];
    const w = where(f, params);
    params.push(f.limit, f.offset);
    const rows = await this.db.query<any>(
      `SELECT ${CAMPOS}, count(*) OVER()::int AS total ${DESDE} ${w}
       ORDER BY ${ORDEN_SQL[f.orden]} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { total: rows[0]?.total ?? 0, limit: f.limit, offset: f.offset, items: rows.map(({ total, ...r }) => r) };
  }

  /** FeatureCollection para el mapa. Con ≤ cientos de zonas basta GeoJSON; a escala se usa MVT (ver TilesController). */
  async geojson(f: FiltrosColonias) {
    const params: unknown[] = [];
    const w = where(f, params);
    params.push(f.limit);
    const rows = await this.db.query<any>(
      `SELECT ${CAMPOS}, ST_AsGeoJSON(c.geom, 6)::json AS geometry ${DESDE} ${w}
       ORDER BY ${ORDEN_SQL[f.orden]} LIMIT $${params.length}`, params);
    return {
      type: 'FeatureCollection',
      features: rows.map(({ geometry, ...props }) => ({ type: 'Feature', id: props.id, properties: props, geometry })),
    };
  }

  async detalle(id: string) {
    const rows = await this.db.query<any>(
      `SELECT ${CAMPOS}, c.cve_ent, c.cve_mun, c.carga_id, ST_AsGeoJSON(c.geom, 6)::json AS geometry ${DESDE} WHERE c.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('Zona no encontrada');
    const { geometry, ...props } = rows[0];
    return { ...props, geometry };
  }
}
