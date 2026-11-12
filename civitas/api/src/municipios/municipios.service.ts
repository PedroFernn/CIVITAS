import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** MVP-6: los 217 municipios de INEGI (forma del estado, población y filtro por municipio). */
@Injectable()
export class MunicipiosService {
  constructor(private readonly db: DatabaseService) {}

  /** Municipios con al menos una zona, con su población del Censo 2020 y cuántas zonas tienen. */
  async listar() {
    return this.db.query<any>(
      `SELECT m.cve_mun, m.nombre, m.poblacion, m.viviendas, count(c.id)::int AS n_zonas
       FROM municipios m LEFT JOIN colonias c ON c.cve_ent = m.cve_ent AND c.cve_mun = m.cve_mun
       GROUP BY m.cve_ent, m.cve_mun, m.nombre, m.poblacion, m.viviendas
       HAVING count(c.id) > 0 ORDER BY m.nombre`);
  }

  /** Contorno de los municipios, simplificado en PostGIS (por defecto ~220 m: basta para dibujar el estado). */
  async geojson(tolerancia: number) {
    const rows = await this.db.query<any>(
      `SELECT m.cve_mun, m.nombre, m.poblacion, m.viviendas,
              (SELECT count(*)::int FROM colonias c WHERE c.cve_ent = m.cve_ent AND c.cve_mun = m.cve_mun) AS n_zonas,
              ST_AsGeoJSON(CASE WHEN $1::float8 > 0 THEN ST_SimplifyPreserveTopology(m.geom, $1::float8) ELSE m.geom END, 4)::json AS geometry
       FROM municipios m ORDER BY m.nombre`, [tolerancia]);
    return {
      type: 'FeatureCollection',
      features: rows.map(({ geometry, ...props }) => ({ type: 'Feature', id: props.cve_mun, properties: props, geometry })),
    };
  }
}
